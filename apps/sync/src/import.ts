import { db, type Prisma } from "@crm/db";
import { setField } from "./fields";
import {
	type Customer,
	type Member,
	normalizedEmail,
	type Star,
} from "./source";

async function updateRegistrationSource(
	tx: Prisma.TransactionClient,
	contactId: string,
) {
	const identities = await tx.importedRecord.findMany({
		where: { kind: "contact", recordId: contactId },
		select: { source: true },
	});
	const cloud = identities.some((item) => item.source === "cloud");
	const github = identities.some((item) => item.source === "github");
	await setField(tx, "CONTACT", contactId, "registration_source", {
		text: cloud && github ? "Cloud + GitHub" : cloud ? "Cloud" : "GitHub",
	});
}

async function identity(
	tx: Prisma.TransactionClient,
	source: string,
	externalId: string,
	kind: string,
) {
	return tx.importedRecord.findUnique({
		where: { source_externalId_kind: { source, externalId, kind } },
	});
}

async function remember(
	tx: Prisma.TransactionClient,
	source: string,
	externalId: string,
	kind: string,
	recordId: string,
) {
	await tx.importedRecord.create({
		data: { source, externalId, kind, recordId },
	});
}

export async function importCompany(
	customer: Customer,
	ownerId: string,
): Promise<string | null> {
	return db.$transaction(async (tx) => {
		const ref = await identity(tx, "cloud", customer.organizationId, "company");
		let company = ref
			? await tx.company.findUnique({ where: { id: ref.recordId } })
			: null;
		if (ref && (!company || company.archivedAt)) return null;
		if (!company) {
			company = await tx.company.create({
				data: {
					name: customer.name,
					email: normalizedEmail(customer.creator?.email ?? ""),
					ownerId,
					source: "IMPORT",
					enrichmentStatus: "SKIPPED",
				},
			});
			await remember(
				tx,
				"cloud",
				customer.organizationId,
				"company",
				company.id,
			);
		}
		const creatorEmail = normalizedEmail(customer.creator?.email ?? "");
		if (!company.email && creatorEmail)
			await tx.company.update({
				where: { id: company.id },
				data: { email: creatorEmail },
			});
		await setField(tx, "COMPANY", company.id, "cloud_organization_id", {
			text: customer.organizationId,
		});
		await setField(tx, "COMPANY", company.id, "cloud_registered_at", {
			date: new Date(customer.createdAt),
		});
		await setField(tx, "COMPANY", company.id, "cloud_member_count", {
			number: customer.memberCount,
		});
		await setField(tx, "COMPANY", company.id, "cloud_box_count", {
			number: customer.boxCount,
		});
		await setField(tx, "COMPANY", company.id, "cloud_synced_at", {
			date: new Date(),
		});
		return company.id;
	});
}

export async function importMember(
	customer: Customer,
	member: Member,
	companyId: string,
	ownerId: string,
): Promise<void> {
	await db.$transaction(async (tx) => {
		const ref = await identity(tx, "cloud", member.userId, "contact");
		let contact = ref
			? await tx.contact.findUnique({ where: { id: ref.recordId } })
			: null;
		if (ref && (!contact || contact.archivedAt)) return;
		const email = normalizedEmail(member.email);
		if (email && (await tx.suppressedContact.findUnique({ where: { email } })))
			return;
		if (!contact && email)
			contact = await tx.contact.findFirst({
				where: { email, archivedAt: null },
			});
		if (!contact)
			contact = await tx.contact.create({
				data: {
					firstName:
						member.displayName?.trim() ||
						email ||
						`Cloud user ${member.userId}`,
					email,
					companyId,
					ownerId,
					source: "IMPORT",
					enrichmentStatus: "SKIPPED",
				},
			});
		if (!ref) await remember(tx, "cloud", member.userId, "contact", contact.id);
		await updateRegistrationSource(tx, contact.id);
		await setField(tx, "CONTACT", contact.id, "cloud_user_id", {
			text: member.userId,
		});
		if (member.joinedAt)
			await setField(tx, "CONTACT", contact.id, "cloud_joined_at", {
				date: new Date(member.joinedAt),
			});
		const dealKey = `${customer.organizationId}:${member.userId}`;
		const previous = await identity(tx, "cloud", dealKey, "deal");
		if (previous) return;
		const deal = await tx.deal.create({
			data: {
				name: `${customer.name} · ${member.displayName?.trim() || email || member.userId}`,
				companyId,
				ownerId,
				stage: "NEW_SIGNUP",
				description:
					"Imported BoxLite Cloud membership. Signup is not a qualification or purchase. Deal amount is unknown.",
			},
		});
		await remember(tx, "cloud", dealKey, "deal", deal.id);
		if (contact.companyId === companyId)
			await tx.dealContact.create({
				data: {
					dealId: deal.id,
					contactId: contact.id,
					role: member.organizationRole,
				},
			});
		await setField(tx, "DEAL", deal.id, "cloud_user_id", {
			text: member.userId,
		});
		await setField(tx, "DEAL", deal.id, "cloud_organization_id", {
			text: customer.organizationId,
		});
		if (member.joinedAt)
			await setField(tx, "DEAL", deal.id, "cloud_joined_at", {
				date: new Date(member.joinedAt),
			});
	});
}

export async function importStar(
	star: Star,
	repository: string,
	ownerId: string,
): Promise<void> {
	await db.$transaction(async (tx) => {
		const externalId = String(star.user.id);
		const ref = await identity(tx, "github", externalId, "contact");
		let contact = ref
			? await tx.contact.findUnique({ where: { id: ref.recordId } })
			: null;
		if (ref && (!contact || contact.archivedAt)) return;
		if (!contact)
			contact = await tx.contact.findFirst({
				where: { githubUrl: star.user.html_url, archivedAt: null },
			});
		if (!contact)
			contact = await tx.contact.create({
				data: {
					firstName: star.user.login,
					githubUrl: star.user.html_url,
					imageUrl: star.user.avatar_url,
					ownerId,
					source: "IMPORT",
					enrichmentStatus: "SKIPPED",
				},
			});
		if (!ref) await remember(tx, "github", externalId, "contact", contact.id);
		await updateRegistrationSource(tx, contact.id);
		await setField(tx, "CONTACT", contact.id, "github_user_id", {
			text: externalId,
		});
		await setField(tx, "CONTACT", contact.id, "github_username", {
			text: star.user.login,
		});
		await setField(tx, "CONTACT", contact.id, "github_starred_at", {
			date: new Date(star.starred_at),
		});
		await setField(tx, "CONTACT", contact.id, "github_repository", {
			text: repository,
		});
	});
}
