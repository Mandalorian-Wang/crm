import { z } from "zod";

const profile = z.object({
	data: z.object({
		organization: z.object({ id: z.string(), urlKey: z.string() }),
		viewer: z.object({
			id: z.string(),
			name: z.string(),
			email: z.email(),
			avatarUrl: z.string().nullable(),
			active: z.boolean(),
			createdAt: z.string(),
			updatedAt: z.string(),
		}),
	}),
	errors: z.array(z.unknown()).optional(),
});

export function allowedLinearIdentity(
	email: string,
	active: boolean,
	workspace: string,
	workspaceId: string,
): boolean {
	return (
		active &&
		/^[^@\s]+@polygala\.ai$/i.test(email.trim()) &&
		workspace === "polygala" &&
		Boolean(process.env.LINEAR_WORKSPACE_ID) &&
		workspaceId === process.env.LINEAR_WORKSPACE_ID
	);
}

export async function linearUserInfo(token: { accessToken?: string }) {
	if (!token.accessToken) return null;
	try {
		const response = await fetch("https://api.linear.app/graphql", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token.accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query:
					"{ organization { id urlKey } viewer { id name email avatarUrl active createdAt updatedAt } }",
			}),
			signal: AbortSignal.timeout(15000),
		});
		if (!response.ok) return null;
		const parsed = profile.safeParse(await response.json());
		if (!parsed.success || parsed.data.errors?.length) return null;
		const { viewer, organization } = parsed.data.data;
		if (
			!allowedLinearIdentity(
				viewer.email,
				viewer.active,
				organization.urlKey,
				organization.id,
			)
		)
			return null;
		return {
			user: {
				name: viewer.name,
				email: viewer.email.toLowerCase(),
				image: viewer.avatarUrl ?? undefined,
				emailVerified: false,
			},
			data: { ...viewer, avatarUrl: viewer.avatarUrl ?? undefined },
		};
	} catch {
		return null;
	}
}
