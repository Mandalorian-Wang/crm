import { afterAll, expect, test } from "bun:test";
import { db } from "@crm/db";
import { ensureFields, setField } from "../src/fields";
import { importCompany, importMember, importStar } from "../src/import";

const prefix = `sync-test-${crypto.randomUUID()}`;
const customer = {
	organizationId: prefix,
	name: "Synthetic organization",
	createdAt: "2026-01-01T00:00:00Z",
	createdBy: prefix,
	creator: { userId: prefix, email: `creator-${prefix}@example.test` },
	memberCount: 1,
	boxCount: 0,
	impactState: "active",
};
const member = {
	userId: prefix,
	email: `${prefix}@example.test`,
	displayName: "Synthetic Person",
	organizationRole: "owner",
	joinedAt: "2026-01-02T00:00:00Z",
};
afterAll(async () => {
	await db.importedRecord.deleteMany({
		where: {
			OR: [
				{ externalId: { contains: prefix } },
				{ source: "github", externalId: "-9999999" },
			],
		},
	});
	await db.deal.deleteMany({ where: { ownerId: prefix } });
	await db.contact.deleteMany({ where: { ownerId: prefix } });
	await db.company.deleteMany({ where: { ownerId: prefix } });
	await db.user.deleteMany({ where: { id: prefix } });
	await db.$disconnect();
});
test("retry preserves manual fields, stages and archived contacts", async () => {
	await db.user.create({
		data: {
			id: prefix,
			name: "Synthetic owner",
			email: `owner-${prefix}@example.test`,
		},
	});
	await ensureFields();
	const companyId = await importCompany(customer, prefix);
	expect(companyId).toBeTruthy();
	if (!companyId) throw new Error("Synthetic company was not created");
	expect(
		(await db.company.findUniqueOrThrow({ where: { id: companyId } })).email,
	).toBe(customer.creator.email);
	await db.company.update({
		where: { id: companyId },
		data: { email: `manual-${prefix}@example.test` },
	});
	await importMember(customer, member, companyId, prefix);
	const contact = await db.contact.findFirstOrThrow({
		where: { ownerId: prefix },
	});
	const deal = await db.deal.findFirstOrThrow({ where: { ownerId: prefix } });
	await db.$transaction(async (tx) => {
		await setField(tx, "CONTACT", contact.id, "notion_document", {
			text: "https://notion.so/manual-document",
		});
	});
	await db.contact.update({
		where: { id: contact.id },
		data: { firstName: "Manual name" },
	});
	await db.deal.update({
		where: { id: deal.id },
		data: { stage: "CLOSED_WON", amount: 123 },
	});
	await importCompany(customer, prefix);
	expect(
		(await db.company.findUniqueOrThrow({ where: { id: companyId } })).email,
	).toBe(`manual-${prefix}@example.test`);
	await importMember(customer, member, companyId, prefix);
	expect(await db.contact.count({ where: { ownerId: prefix } })).toBe(1);
	expect(await db.deal.count({ where: { ownerId: prefix } })).toBe(1);
	expect(
		(await db.contact.findUniqueOrThrow({ where: { id: contact.id } }))
			.firstName,
	).toBe("Manual name");
	expect(
		(await db.deal.findUniqueOrThrow({ where: { id: deal.id } })).stage,
	).toBe("CLOSED_WON");
	expect(
		(
			await db.fieldValue.findFirstOrThrow({
				where: { contactId: contact.id, field: { key: "notion_document" } },
			})
		).text,
	).toBe("https://notion.so/manual-document");
	await db.contact.update({
		where: { id: contact.id },
		data: { archivedAt: new Date() },
	});
	await importMember(customer, member, companyId, prefix);
	expect(await db.contact.count({ where: { ownerId: prefix } })).toBe(1);
	const star = {
		starred_at: "2026-01-01T00:00:00Z",
		user: {
			id: -9999999,
			login: prefix,
			html_url: `https://github.com/${prefix}`,
			avatar_url: "https://github.com/avatar.png",
		},
	};
	await importStar(star, "boxlite-ai/boxlite", prefix);
	await importStar(star, "boxlite-ai/boxlite", prefix);
	expect(await db.contact.count({ where: { ownerId: prefix } })).toBe(2);
	expect(
		(
			await db.contact.findFirstOrThrow({
				where: { githubUrl: star.user.html_url },
			})
		).email,
	).toBeNull();
});
