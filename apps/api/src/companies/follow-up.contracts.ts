import { z } from "zod";
import { bulkIdsInput } from "../crm/bulk";

export const followUpStatus = z.enum([
	"NOT_CONTACTED",
	"CONTACTED",
	"WAITING",
	"COMPLETED",
]);
export const followUpData = z
	.object({
		status: followUpStatus.optional(),
		nextFollowUp: z.iso.date().nullable().optional(),
	})
	.refine(
		(value) => value.status !== undefined || value.nextFollowUp !== undefined,
		"Choose a status or follow-up date.",
	);
export const followUpInput = z.object({
	companyId: z.string(),
	data: followUpData,
});
export const followUpBulkInput = bulkIdsInput.extend({ data: followUpData });
export const contactLogInput = z.object({
	requestId: z.uuid(),
	companyId: z.string(),
	contactId: z.string().nullable().default(null),
	channel: z.enum(["Email", "Discord", "Call", "Meeting", "Other"]),
	body: z.string().trim().min(1).max(20000),
	occurredAt: z.iso.datetime({ offset: true }),
});
export const contactLogOutput = z.object({
	id: z.string(),
	channel: z.string(),
	body: z.string(),
	occurredAt: z.string(),
	author: z.string(),
	contact: z.string().nullable(),
});
export const followUpOutput = z.object({
	status: followUpStatus,
	nextFollowUp: z.string().nullable(),
	lastContacted: z.string().nullable(),
	logs: z.array(contactLogOutput),
});
export const followUpBulkOutput = z.object({
	succeeded: z.number(),
	failed: z.array(z.object({ id: z.string(), message: z.string() })),
});
export const syncStatusOutput = z.array(
	z.object({
		source: z.string(),
		status: z.string(),
		lastAttempt: z.string().nullable(),
		lastSuccess: z.string().nullable(),
	}),
);
