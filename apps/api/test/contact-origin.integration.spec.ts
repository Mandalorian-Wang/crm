import { afterAll, beforeAll, expect, test } from "bun:test";
import { db } from "@crm/db";
import { Test, type TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { contactListInput } from "../src/contacts/contacts.contracts";
import { ContactsService } from "../src/contacts/contacts.service";

const prefix = `origin-test-${crypto.randomUUID()}`;
let module: TestingModule;
let service: ContactsService;
const ids: string[] = [];
beforeAll(async () => {
	module = await Test.createTestingModule({ imports: [AppModule] }).compile();
	service = module.get(ContactsService);
	const fields = await Promise.all(
		["cloud_user_id", "github_user_id"].map((key) =>
			db.fieldDefinition.upsert({
				where: { entity_key: { entity: "CONTACT", key } },
				create: {
					entity: "CONTACT",
					key,
					label: key,
					type: "TEXT",
					position: 0,
				},
				update: {},
			}),
		),
	);
	for (const [index, sources] of [[0], [1], [0, 1], []].entries()) {
		const contact = await db.contact.create({
			data: { firstName: `${prefix}-${index}` },
		});
		ids.push(contact.id);
		for (const source of sources) {
			const field = fields[source];
			if (!field) throw new Error("Missing test field");
			await db.fieldValue.create({
				data: {
					fieldId: field.id,
					contactId: contact.id,
					text: `${prefix}-${source}-${index}`,
				},
			});
		}
	}
});
afterAll(async () => {
	await db.contact.deleteMany({ where: { id: { in: ids } } });
	await module?.close();
});
test("source tabs include dual-source contacts and preserve all and pagination", async () => {
	const list = (origin: string, page = 1, pageSize = 25) =>
		service.list(contactListInput.parse({ origin, q: prefix, page, pageSize }));
	expect((await list("all")).total).toBe(4);
	expect((await list("cloud")).rows.map((r) => r.id).sort()).toEqual(
		[ids[0], ids[2]].filter((id): id is string => Boolean(id)).sort(),
	);
	expect((await list("github")).rows.map((r) => r.id).sort()).toEqual(
		[ids[1], ids[2]].filter((id): id is string => Boolean(id)).sort(),
	);
	expect((await list("github", 1, 1)).total).toBe(2);
	expect((await list("github", 2, 1)).rows.length).toBe(1);
	expect((await list("github", 3, 1)).rows.length).toBe(0);
});
