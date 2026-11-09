import { afterAll, beforeAll, expect, test } from "bun:test";
import { db } from "@crm/db";
import {
	DailyNotesService,
	noteDay,
} from "../src/companies/daily-notes.service";

const prefix = `daily-${crypto.randomUUID()}`;
const alice = `${prefix}-alice`,
	bob = `${prefix}-bob`;
const service = new DailyNotesService(db);
let companyId: string;
beforeAll(async () => {
	for (const id of [alice, bob])
		await db.user.create({
			data: { id, name: id, email: `${id}@example.test` },
		});
	companyId = (await db.company.create({ data: { name: prefix } })).id;
});
afterAll(async () => {
	await db.company.deleteMany({ where: { id: companyId } });
	await db.user.deleteMany({ where: { id: { in: [alice, bob] } } });
});
test("Beijing midnight defines the immutable day", () => {
	expect(noteDay(new Date("2026-11-09T15:59:59Z"))).toBe("2026-11-09");
	expect(noteDay(new Date("2026-11-09T16:00:00Z"))).toBe("2026-11-10");
});
test("append retries do not duplicate; editing records the last editor and rejects stale versions", async () => {
	const input = {
		companyId,
		mentions: [],
		requestId: crypto.randomUUID(),
		body: "First note",
	};
	await Promise.all([
		service.create(input, alice),
		service.create(input, alice),
	]);
	const rows = await service.list(companyId);
	expect(rows).toHaveLength(1);
	const note = rows[0];
	if (!note) throw new Error("Missing note");
	expect(note.editable).toBe(true);
	await service.update(
		{
			companyId,
			mentions: [],
			id: note.id,
			version: note.version,
			body: "Updated by Bob",
		},
		bob,
	);
	const updated = (await service.list(companyId))[0];
	if (!updated) throw new Error("Missing updated note");
	expect(updated.updatedBy).toBe(bob);
	expect(updated.version).toBe(2);
	await expect(
		service.update(
			{
				companyId,
				mentions: [],
				id: note.id,
				version: note.version,
				body: "Stale overwrite",
			},
			alice,
		),
	).rejects.toThrow("changed");
	expect((await service.list(companyId))[0]?.body).toBe("Updated by Bob");
});
test("past notes cannot be edited through the API even with the correct version", async () => {
	const id = `${prefix}-past`;
	await db.organizationDailyNote.create({
		data: {
			id,
			companyId,
			mentions: [],
			body: "Frozen",
			updatedById: alice,
			createdAt: new Date(Date.now() - 172800000),
		},
	});
	await expect(
		service.update(
			{ companyId, mentions: [], id, version: 1, body: "Changed" },
			bob,
		),
	).rejects.toThrow("frozen");
	const rows = await service.list(companyId);
	expect(rows.at(-1)?.id).toBe(id);
	expect(rows.at(-1)?.editable).toBe(false);
	expect(rows.at(-1)?.body).toBe("Frozen");
});

test("team member mentions persist by account ID and reject unknown members", async () => {
	const body = `Hello @${bob}`;
	const mentions = [{ id: bob, name: bob, start: 6, end: body.length }];
	const result = await service.create(
		{ companyId, requestId: crypto.randomUUID(), body, mentions },
		alice,
	);
	expect(result[0]?.mentions).toEqual(mentions);
	await expect(
		service.create(
			{
				companyId,
				requestId: crypto.randomUUID(),
				body,
				mentions: [
					{
						...mentions[0],
						id: "missing-member",
						name: bob,
						start: 6,
						end: body.length,
					},
				],
			},
			alice,
		),
	).rejects.toThrow("no longer available");
});
