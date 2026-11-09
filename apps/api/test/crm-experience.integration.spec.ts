import { afterAll, beforeAll, expect, test } from "bun:test";
import { db } from "@crm/db";
import { savedViewFilters } from "@crm/validation/saved-view";
import { companyMemberIds } from "../src/companies/company-members";
import { FollowUpService } from "../src/companies/follow-up.service";
import { SavedViewsService } from "../src/saved-views/saved-views.service";

const prefix = `experience-${crypto.randomUUID()}`;
const alice = `${prefix}-alice`,
	bob = `${prefix}-bob`;
let first: string, second: string, contactId: string;
const follow = new FollowUpService(db),
	views = new SavedViewsService(db);
beforeAll(async () => {
	for (const id of [alice, bob])
		await db.user.create({
			data: { id, name: id, email: `${id}@example.test` },
		});
	first = (await db.company.create({ data: { name: prefix } })).id;
	second = (await db.company.create({ data: { name: prefix } })).id;
	contactId = (
		await db.contact.create({ data: { firstName: "Member", companyId: first } })
	).id;
	await db.importedRecord.createMany({
		data: [
			{
				source: "cloud",
				kind: "company",
				externalId: prefix,
				recordId: second,
			},
			{
				source: "cloud",
				kind: "contact",
				externalId: `${prefix}-user`,
				recordId: contactId,
			},
			{
				source: "cloud",
				kind: "deal",
				externalId: `${prefix}:${prefix}-user`,
				recordId: "historical-membership",
			},
		],
	});
});
afterAll(async () => {
	await db.importedRecord.deleteMany({
		where: { externalId: { startsWith: prefix } },
	});
	await db.company.deleteMany({ where: { id: { in: [first, second] } } });
	await db.contact.deleteMany({ where: { id: contactId } });
	await db.user.deleteMany({ where: { id: { in: [alice, bob] } } });
});
test("membership includes secondary organizations and excludes archived users", async () => {
	const members = await companyMemberIds(db, [first, second]);
	expect(members.get(first)?.has(contactId)).toBe(true);
	expect(members.get(second)?.has(contactId)).toBe(true);
	await db.contact.update({
		where: { id: contactId },
		data: { archivedAt: new Date() },
	});
	expect((await companyMemberIds(db, [second])).get(second)?.size).toBe(0);
	await db.contact.update({
		where: { id: contactId },
		data: { archivedAt: null },
	});
});
test("follow-up logs accept secondary members and retries; bulk reports partial failure", async () => {
	const input = {
		companyId: second,
		requestId: crypto.randomUUID(),
		contactId,
		channel: "Email" as const,
		body: "Contacted",
		occurredAt: new Date(Date.now() - 60000).toISOString(),
	};
	await Promise.all([follow.log(input, alice), follow.log(input, alice)]);
	const result = await follow.read(second);
	expect(result.status).toBe("CONTACTED");
	expect(result.logs).toHaveLength(1);
	const bulk = await follow.bulk([first, second, "missing-id"], {
		status: "WAITING",
		nextFollowUp: "2026-12-01",
	});
	expect(bulk.succeeded).toBe(2);
	expect(bulk.failed.map((row) => row.id)).toEqual(["missing-id"]);
	expect((await follow.read(first)).nextFollowUp).toBe("2026-12-01");
});
test("default saved views honor account access and preserve column preferences", async () => {
	const view = await views.create(
		{
			entity: "COMPANY",
			name: prefix,
			shared: false,
			filters: savedViewFilters.parse({
				hiddenColumns: ["phone"],
				columnOrder: ["name", "email"],
			}),
		},
		alice,
	);
	await views.setDefault("COMPANY", view.id, alice);
	expect(
		(await views.defaultView("COMPANY", alice))?.filters.columnOrder,
	).toEqual(["name", "email"]);
	expect(await views.defaultView("COMPANY", bob)).toBeNull();
	await expect(views.setDefault("COMPANY", view.id, bob)).rejects.toThrow(
		"not available",
	);
	await views.update(view.id, { shared: true }, alice);
	await views.setDefault("COMPANY", view.id, bob);
	await views.delete(view.id, alice);
	expect(await views.defaultView("COMPANY", bob)).toBeNull();
});
