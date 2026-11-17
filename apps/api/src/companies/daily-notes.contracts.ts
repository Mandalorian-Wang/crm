import { REQUEST_IMAGES, requestImage } from "@crm/validation/crm-request";
import { noteMentions, validNoteMentions } from "@crm/validation/daily-note";
import { z } from "zod";

export const dailyNoteCreateInput = z
	.object({
		companyId: z.string(),
		requestId: z.uuid(),
		body: z.string().max(20000),
		mentions: noteMentions.default([]),
		images: z.array(requestImage).max(REQUEST_IMAGES.maxCount).optional(),
	})
	.refine(
		(input) =>
			validNoteMentions(input.body, input.mentions) &&
			(input.body.trim().length > 0 || (input.images?.length ?? 0) > 0),
		"Add text or an image, and use valid member mentions.",
	);
export const dailyNoteUpdateInput = z
	.object({
		companyId: z.string(),
		id: z.string(),
		version: z.number().int().positive(),
		body: z.string().max(20000),
		mentions: noteMentions.default([]),
		images: z.array(requestImage).max(REQUEST_IMAGES.maxCount).optional(),
	})
	.refine(
		(input) =>
			validNoteMentions(input.body, input.mentions) &&
			(input.body.trim().length > 0 || (input.images?.length ?? 0) > 0),
		"Add text or an image, and use valid member mentions.",
	);
export const dailyNotesOutput = z.array(
	z.object({
		id: z.string(),
		body: z.string(),
		mentions: noteMentions,
		images: z.array(requestImage),
		createdAt: z.string(),
		updatedAt: z.string(),
		updatedBy: z.string(),
		version: z.number(),
		editable: z.boolean(),
	}),
);
