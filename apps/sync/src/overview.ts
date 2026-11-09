import { db } from "@crm/db";
import {
	cloudOverviewEvidence,
	createdBoxInWindow,
	previousShanghaiDay,
} from "@crm/validation/cloud-overview";
import { z } from "zod";
import { SYNC } from "./config";
import { importCompany, importMember } from "./import";
import {
	backofficeHeaders,
	customerSnapshot,
	customers,
	members,
	request,
} from "./source";

export async function syncOverview(ownerId: string) {
	const { start, end, date } = previousShanghaiDay(new Date());
	const previous = await db.cloudDailyOverview.findUnique({ where: { date } });
	const prior = previous ? cloudOverviewEvidence.parse(previous.evidence) : {};
	const evidence: z.infer<typeof cloudOverviewEvidence> = {};
	let failed = 0;
	for await (const customer of customers()) {
		const createdAt = new Date(customer.createdAt);
		if (createdAt < start || createdAt >= end) continue;
		const companyId = await importCompany(customer, ownerId);
		const old = prior[customer.organizationId];
		const entry = {
			createdAt: customer.createdAt,
			createdBox: old?.createdBox ?? null,
			memberIds: old?.memberIds ?? null,
		};
		evidence[customer.organizationId] = entry;
		try {
			const snapshot = await customerSnapshot(customer.organizationId);
			if (entry.createdBox === null && snapshot.activation)
				entry.createdBox = createdBoxInWindow(
					snapshot.activation.lastBoxCreatedAt,
					start,
					end,
				);
			const memberIds: string[] = [];
			for await (const member of members(customer.organizationId, snapshot)) {
				if (companyId) await importMember(customer, member, companyId, ownerId);
				memberIds.push(member.userId);
			}
			entry.memberIds = [...new Set(memberIds)];
		} catch (error) {
			if (error instanceof Error && /HTTP (401|403)/.test(error.message))
				throw error;
			failed++;
		}
	}
	if (Object.values(evidence).some((entry) => entry.createdBox === null)) {
		const active = await activeOrganizations(start, end).catch(() => null);
		if (active) {
			for (const [id, entry] of Object.entries(evidence))
				if (entry.createdBox === null && active.has(id))
					entry.createdBox = true;
		}
	}
	await db.cloudDailyOverview.upsert({
		where: { date },
		create: { date, evidence },
		update: { evidence },
	});
	if (failed)
		throw new Error(
			`Overview sync incomplete for ${failed} organizations; retry scheduled.`,
		);
	return Object.keys(evidence).length;
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
