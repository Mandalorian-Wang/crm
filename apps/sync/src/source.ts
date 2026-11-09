import { z } from "zod";
import { SYNC } from "./config";

export const creatorSchema = z.object({
	userId: z.string(),
	email: z.string().nullable(),
	displayName: z.string().optional(),
});
export const customerSchema = z.object({
	organizationId: z.string(),
	name: z.string(),
	createdAt: z.string().datetime({ offset: true }),
	createdBy: z.string(),
	creator: creatorSchema.nullable(),
	memberCount: z.number(),
	boxCount: z.number(),
	impactState: z.string(),
});
export const memberSchema = z.object({
	userId: z.string(),
	email: z.string(),
	displayName: z.string().optional(),
	organizationRole: z.string(),
	joinedAt: z.string().datetime({ offset: true }).optional(),
});
const customerPage = z.object({
	items: z.array(customerSchema),
	nextCursor: z.string().nullable(),
});
const detailSchema = z.object({
	members: z.object({
		items: z.array(memberSchema),
		nextCursor: z.string().nullable(),
	}),
});
const starsSchema = z.array(
	z.object({
		starred_at: z.string().datetime({ offset: true }),
		user: z.object({
			id: z.number().int(),
			login: z.string(),
			html_url: z.string().url(),
			avatar_url: z.string().url(),
		}),
	}),
);
export type Customer = z.infer<typeof customerSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Star = z.infer<typeof starsSchema>[number];

export async function request(
	url: URL,
	headers: HeadersInit,
): Promise<Response> {
	for (let attempt = 0; attempt < 4; attempt++) {
		await Bun.sleep(SYNC.requestIntervalMs);
		const response = await fetch(url, {
			headers,
			redirect: "error",
			signal: AbortSignal.timeout(SYNC.requestTimeoutMs),
		}).catch(() => null);
		if (!response) {
			if (attempt < 3) continue;
			throw new Error(
				`${url.hostname}${url.pathname}: source network unavailable`,
			);
		}
		if (response.ok) return response;
		if (attempt < 3 && (response.status === 429 || response.status >= 500)) {
			const retry = Number(response.headers.get("retry-after"));
			await Bun.sleep(
				Math.min(
					120_000,
					Number.isFinite(retry) && retry > 0
						? retry * 1000
						: (attempt + 1) * 5000,
				),
			);
			continue;
		}
		throw new Error(`${url.hostname}${url.pathname}: HTTP ${response.status}`);
	}
	throw new Error("Source request exhausted its retry budget.");
}

export function backofficeHeaders(): HeadersInit {
	const key = process.env.BACKOFFICE_API_KEY;
	if (!key) throw new Error("BACKOFFICE_API_KEY is required for Cloud sync.");
	return { Authorization: `Bearer ${key}` };
}

export async function* customers(): AsyncGenerator<Customer> {
	let cursor: string | null = null;
	const cursors = new Set<string>();
	for (let page = 0; page < SYNC.maxPages; page++) {
		const url = new URL("/v1/customers", SYNC.backofficeOrigin);
		url.searchParams.set("limit", "200");
		if (cursor) url.searchParams.set("cursor", cursor);
		const result = customerPage.parse(
			await (await request(url, backofficeHeaders())).json(),
		);
		yield* result.items;
		cursor = result.nextCursor;
		if (!cursor) return;
		if (cursors.has(cursor))
			throw new Error("Backoffice repeated a customer cursor.");
		cursors.add(cursor);
	}
	throw new Error("Customer pagination exceeded the page limit.");
}

export async function* members(organizationId: string): AsyncGenerator<Member> {
	let cursor: string | null = null;
	const cursors = new Set<string>();
	for (let page = 0; page < SYNC.maxPages; page++) {
		const url = new URL(
			`/v1/customers/${encodeURIComponent(organizationId)}`,
			SYNC.backofficeOrigin,
		);
		url.searchParams.set("sectionLimit", "200");
		if (cursor) url.searchParams.set("memberCursor", cursor);
		const result = detailSchema.parse(
			await (await request(url, backofficeHeaders())).json(),
		);
		yield* result.members.items;
		cursor = result.members.nextCursor;
		if (!cursor) return;
		if (cursors.has(cursor))
			throw new Error("Backoffice repeated a member cursor.");
		cursors.add(cursor);
	}
	throw new Error("Member pagination exceeded the page limit.");
}

export async function* stargazers(): AsyncGenerator<Star> {
	if (!/^[\w.-]+\/[\w.-]+$/.test(SYNC.githubRepository))
		throw new Error("Invalid GITHUB_STAR_REPOSITORY.");
	for (let page = 1; page <= SYNC.maxPages; page++) {
		const url = new URL(
			`https://api.github.com/repos/${SYNC.githubRepository}/stargazers`,
		);
		url.searchParams.set("per_page", "100");
		url.searchParams.set("page", String(page));
		const headers = new Headers({
			Accept: "application/vnd.github.star+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "BoxLite-CRM-Sync",
		});
		if (process.env.GITHUB_TOKEN)
			headers.set("Authorization", `Bearer ${process.env.GITHUB_TOKEN}`);
		const response = await request(url, headers);
		yield* starsSchema.parse(await response.json());
		if (!response.headers.get("link")?.includes('rel="next"')) return;
	}
	throw new Error("GitHub pagination exceeded the page limit.");
}

export function normalizedEmail(value: string): string | null {
	const parsed = z.email().safeParse(value.trim().toLowerCase());
	return parsed.success ? parsed.data : null;
}
