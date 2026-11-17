import { ConflictException } from "@nestjs/common";

export function assertActivityReplay(
	stored: {
		type: string;
		body: string | null;
		subject: string | null;
		createdBy: { id: string };
		contact: { id: string } | null;
		company: { id: string } | null;
		deal: { id: string } | null;
		occurredAt: Date | null;
		dueAt: Date | null;
	},
	requested: {
		type: string;
		body: string | null;
		subject: string | null;
		createdById: string;
		contactId: string | null;
		companyId: string | null;
		dealId: string | null;
		occurredAt?: Date | null;
		dueAt: Date | null;
	},
) {
	if (
		stored.type !== requested.type ||
		stored.body !== requested.body ||
		stored.subject !== requested.subject ||
		stored.createdBy.id !== requested.createdById ||
		(stored.contact?.id ?? null) !== requested.contactId ||
		(stored.company?.id ?? null) !== requested.companyId ||
		(stored.deal?.id ?? null) !== requested.dealId ||
		stored.dueAt?.getTime() !== requested.dueAt?.getTime() ||
		(requested.occurredAt &&
			stored.occurredAt?.getTime() !== requested.occurredAt.getTime())
	)
		throw new ConflictException(
			"This requestId already records a different activity. Read the existing note before retrying.",
		);
}
