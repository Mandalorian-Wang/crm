import { db, type FieldEntity, type Prisma } from "@crm/db";

const FIELDS = [
	[
		"COMPANY",
		"cloud_settled_usage_usd",
		"Settled usage (USD, this month)",
		"NUMBER",
		false,
	],
	[
		"COMPANY",
		"cloud_settled_usage_mtd",
		"Settled usage this month",
		"TEXT",
		true,
	],
	["COMPANY", "cloud_billing_window", "Usage window (UTC)", "TEXT", false],
	["COMPANY", "cloud_billing_synced_at", "Usage synced at", "DATE", false],
	["COMPANY", "linear_url", "Linear", "URL", true],
	["COMPANY", "cloud_synced_at", "Cloud data synced at", "DATE", false],
	["COMPANY", "cloud_members_sync_status", "Member sync status", "TEXT", false],
	["CONTACT", "registration_source", "Registration source", "TEXT", true],
	["CONTACT", "discord", "Discord", "TEXT", true],
	["CONTACT", "notion_document", "Notion document", "URL", true],
	["CONTACT", "cloud_user_id", "Cloud user ID", "TEXT", false],
	["CONTACT", "github_user_id", "GitHub user ID", "TEXT", false],
	["CONTACT", "github_username", "GitHub username", "TEXT", true],
	["CONTACT", "github_starred_at", "GitHub starred at", "DATE", true],
	["CONTACT", "github_repository", "GitHub repository", "TEXT", false],
	["CONTACT", "cloud_joined_at", "Cloud joined at", "DATE", true],
	["COMPANY", "cloud_organization_id", "Cloud organization ID", "TEXT", true],
	[
		"COMPANY",
		"cloud_registered_at",
		"Cloud organization created at",
		"DATE",
		true,
	],
	["COMPANY", "cloud_member_count", "Cloud members", "NUMBER", true],
	["COMPANY", "cloud_box_count", "Cloud boxes", "NUMBER", true],
	["DEAL", "cloud_user_id", "Cloud user ID", "TEXT", false],
	["DEAL", "cloud_organization_id", "Cloud organization ID", "TEXT", false],
	["DEAL", "cloud_joined_at", "Cloud joined at", "DATE", true],
] as const;

export async function ensureFields() {
	await db.fieldDefinition.updateMany({
		where: {
			entity: "COMPANY",
			key: "cloud_registered_at",
			label: "Cloud registered at",
		},
		data: { label: "Cloud organization created at" },
	});
	await db.fieldDefinition.updateMany({
		where: {
			entity: "COMPANY",
			key: {
				in: [
					"cloud_box_count",
					"cloud_registered_at",
					"cloud_settled_usage_usd",
				],
			},
		},
		data: { showOnFilter: true },
	});
	for (const [
		position,
		[entity, key, label, type, showOnTable],
	] of FIELDS.entries()) {
		await db.fieldDefinition.upsert({
			where: { entity_key: { entity, key } },
			create: {
				entity,
				key,
				label,
				type,
				agentFilled: false,
				showOnFilter:
					entity === "COMPANY" &&
					[
						"cloud_box_count",
						"cloud_registered_at",
						"cloud_settled_usage_usd",
					].includes(key),
				showOnSheet: true,
				showOnTable,
				position,
			},
			update: {},
		});
	}
}

export async function setField(
	tx: Prisma.TransactionClient,
	entity: FieldEntity,
	recordId: string,
	key: string,
	value:
		| { text: string }
		| { number: number | Prisma.Decimal }
		| { date: Date },
) {
	const field = await tx.fieldDefinition.findUniqueOrThrow({
		where: { entity_key: { entity, key } },
	});
	const data = value;
	if (entity === "COMPANY")
		await tx.fieldValue.upsert({
			where: { fieldId_companyId: { fieldId: field.id, companyId: recordId } },
			create: { fieldId: field.id, companyId: recordId, ...data },
			update: data,
		});
	if (entity === "CONTACT")
		await tx.fieldValue.upsert({
			where: { fieldId_contactId: { fieldId: field.id, contactId: recordId } },
			create: { fieldId: field.id, contactId: recordId, ...data },
			update: data,
		});
	if (entity === "DEAL")
		await tx.fieldValue.upsert({
			where: { fieldId_dealId: { fieldId: field.id, dealId: recordId } },
			create: { fieldId: field.id, dealId: recordId, ...data },
			update: data,
		});
}
