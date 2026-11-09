import { noteMentions, validNoteMentions } from "@crm/validation/daily-note";
import { z } from "zod";

export const dailyNoteCreateInput = z
	.object({
		companyId: z.string(),
		requestId: z.uuid(),
		body: z
			.string()
			.min(1)
			.max(20000)
			.refine((body) => body.trim().length > 0),
		mentions: noteMentions.default([]),
	})
	.refine(
		(input) => validNoteMentions(input.body, input.mentions),
		"Invalid member mentions.",
	);
export const dailyNoteUpdateInput = z
	.object({
		companyId: z.string(),
		id: z.string(),
		version: z.number().int().positive(),
		body: z
			.string()
			.min(1)
			.max(20000)
			.refine((body) => body.trim().length > 0),
		mentions: noteMentions.default([]),
	})
	.refine(
		(input) => validNoteMentions(input.body, input.mentions),
		"Invalid member mentions.",
	);
export const dailyNotesOutput = z.array(
	z.object({
		id: z.string(),
		body: z.string(),
		mentions: noteMentions,
		createdAt: z.string(),
		updatedAt: z.string(),
		updatedBy: z.string(),
		version: z.number(),
		editable: z.boolean(),
	}),
);
