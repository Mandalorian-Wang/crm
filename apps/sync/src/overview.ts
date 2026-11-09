import { db } from "@crm/db";
import {
	cloudOverviewEvidence,
	cloudOverviewKey,
	createdBoxInWindow,
	previousShanghaiDay,
} from "@crm/validation/cloud-overview";
import { z } from "zod";
import { SYNC } from "./config";
import { importCompany, importMember } from "./import";
import {
	backofficeHeaders,
	type Customer,
	customerSnapshot,
	customers,
	members,
	request,
} from "./source";

export async function syncOverview(ownerId: string) {
	const now = new Date();
	const windows = await Promise.all(
		([1, 7, 15] as const).map(async (days) => {
			const window = previousShanghaiDay(now, days);
			const key = cloudOverviewKey(window.date, days);
			const previous = await db.cloudDailyOverview.findUnique({
				where: { date: key },
			});
			return {
				...window,
				key,
				prior: previous ? cloudOverviewEvidence.parse(previous.evidence) : {},
				evidence: {} as z.infer<typeof cloudOverviewEvidence>,
			};
		}),
	);
	const widest = previousShanghaiDay(now, 15);
	const directory = new Map<string, Customer>();
	for await (const customer of customers(widest)) {
		const createdAt = new Date(customer.createdAt);
		if (createdAt >= widest.start && createdAt < widest.end)
			directory.set(customer.organizationId, customer);
	}
	const save = async () => {
		for (const window of windows)
			await db.cloudDailyOverview.upsert({
				where: { date: window.key },
				create: { date: window.key, evidence: window.evidence },
				update: { evidence: window.evidence },
			});
	};
	for (const customer of directory.values()) {
		for (const window of windows) {
			if (new Date(customer.createdAt) < window.start) continue;
			const old = window.prior[customer.organizationId];
			window.evidence[customer.organizationId] = {
				createdAt: customer.createdAt,
				createdBox: old?.createdBox === true ? true : null,
				memberIds: old?.memberIds ?? [],
				memberCount: customer.memberCount,
			};
		}
	}
	const memberships = await db.importedRecord.findMany({
		where: { source: "cloud", kind: "deal" },
		select: { externalId: true },
	});
	for (const ref of memberships) {
		const separator = ref.externalId.indexOf(":");
		if (separator < 0) continue;
		const orgId = ref.externalId.slice(0, separator),
			userId = ref.externalId.slice(separator + 1);
		for (const window of windows) {
			const entry = window.evidence[orgId];
			if (entry && userId)
				entry.memberIds = [...new Set([...(entry.memberIds ?? []), userId])];
		}
	}

	await save();
	for (const window of windows) {
		const active = await activeOrganizations(window.start, window.end).catch(
			() => null,
		);
		if (active)
			for (const [id, entry] of Object.entries(window.evidence))
				if (active.has(id)) entry.createdBox = true;
	}
	await save();
	let failed = 0;
	const queue = [...directory.values()].filter(
		(customer) =>
			new Date(customer.createdAt) >= previousShanghaiDay(now).start,
	);
	for (let index = 0; index < queue.length; index += 2) {
		await Promise.all(
			queue.slice(index, index + 2).map(async (customer) => {
				const companyId = await importCompany(customer, ownerId);
				try {
					const snapshot = await customerSnapshot(customer.organizationId);
					for (const window of windows) {
						const entry = window.evidence[customer.organizationId];
						if (entry && entry.createdBox !== true && snapshot.activation)
							entry.createdBox = createdBoxInWindow(
								snapshot.activation.lastBoxCreatedAt,
								window.start,
								window.end,
							);
					}
					const memberIds: string[] = [];
					for await (const member of members(
						customer.organizationId,
						snapshot,
					)) {
						if (companyId)
							await importMember(customer, member, companyId, ownerId);
						memberIds.push(member.userId);
					}
					for (const window of windows) {
						const entry = window.evidence[customer.organizationId];
						if (entry) entry.memberIds = [...new Set(memberIds)];
					}
				} catch (error) {
					if (error instanceof Error && /HTTP (401|403)/.test(error.message))
						throw error;
					failed++;
				}
			}),
		);
		if (index % 20 === 0) await save();
	}
	await save();
	if (failed)
		throw new Error(
			`Overview sync incomplete for ${failed} organizations; retry scheduled.`,
		);
	return directory.size;
}

const usagePage = z.object({
	items: z.array(
		z.object({
			dimensions: z.object({ organizationId: z.string() }),
			values: z.object({
				computeVcpuSeconds: z.string().regex(/^\d+(\.\d+)?$/),
				storageByteSeconds: z.string().regex(/^\d+(\.\d+)?$/),
			}),
		}),
	),
	nextCursor: z.string().nullable(),
});
async function activeOrganizations(start: Date, end: Date) {
	const active = new Set<string>();
	const cursors = new Set<string>();
	let cursor: string | null = null;
	for (let page = 0; page < SYNC.maxPages; page++) {
		const url = new URL("/v1/usage", SYNC.backofficeOrigin);
		url.searchParams.set("from", start.toISOString());
		url.searchParams.set("to", end.toISOString());
		url.searchParams.set("granularity", "window");
		url.searchParams.set("groupBy", "organizationId");
		url.searchParams.set("metrics", "computeVcpuSeconds,storageByteSeconds");
		url.searchParams.set("limit", "200");
		if (cursor) url.searchParams.set("cursor", cursor);
		const result = usagePage.parse(
			await (await request(url, backofficeHeaders())).json(),
		);
		for (const row of result.items)
			if (
				/[1-9]/.test(
					row.values.computeVcpuSeconds + row.values.storageByteSeconds,
				)
			)
				active.add(row.dimensions.organizationId);
		cursor = result.nextCursor;
		if (!cursor) return active;
		if (cursors.has(cursor)) throw new Error("Usage repeated a cursor.");
		cursors.add(cursor);
	}
	throw new Error("Usage pagination exceeded the page limit.");
}
