import type { Db } from "@crm/db";

export async function companyMemberIds(
	db: Pick<Db, "contact" | "importedRecord">,
	companyIds: string[],
) {
	const result = new Map(companyIds.map((id) => [id, new Set<string>()]));
	if (!companyIds.length) return result;
	const [direct, organizations] = await Promise.all([
		db.contact.findMany({
			where: { companyId: { in: companyIds }, archivedAt: null },
			select: { id: true, companyId: true },
		}),
		db.importedRecord.findMany({
			where: { source: "cloud", kind: "company", recordId: { in: companyIds } },
			select: { externalId: true, recordId: true },
		}),
	]);
	for (const contact of direct)
		if (contact.companyId) result.get(contact.companyId)?.add(contact.id);
	if (!organizations.length) return result;
	const memberships = await db.importedRecord.findMany({
		where: {
			source: "cloud",
			kind: "deal",
			OR: organizations.map((org) => ({
				externalId: { startsWith: `${org.externalId}:` },
			})),
		},
		select: { externalId: true },
	});
	const identities = memberships.map((row) => {
		const split = row.externalId.indexOf(":");
		return {
			org: row.externalId.slice(0, split),
			user: row.externalId.slice(split + 1),
		};
	});
	const contacts = await db.importedRecord.findMany({
		where: {
			source: "cloud",
			kind: "contact",
			externalId: { in: identities.map((row) => row.user) },
		},
		select: { externalId: true, recordId: true },
	});
	const active = new Set(
		(
			await db.contact.findMany({
				where: {
					id: { in: contacts.map((row) => row.recordId) },
					archivedAt: null,
				},
				select: { id: true },
			})
		).map((row) => row.id),
	);
	const organizationIds = new Map(
		organizations.map((row) => [row.externalId, row.recordId]),
	);
	const contactIds = new Map(
		contacts.map((row) => [row.externalId, row.recordId]),
	);
	for (const link of identities) {
		const companyId = organizationIds.get(link.org),
			contactId = contactIds.get(link.user);
		if (companyId && contactId && active.has(contactId))
			result.get(companyId)?.add(contactId);
	}
	return result;
}
