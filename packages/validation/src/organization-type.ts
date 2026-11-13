import { z } from "zod";

export const ORGANIZATION_TYPE_KEY = "organization_type";
export const TAG_COLORS = [
	"gray",
	"blue",
	"green",
	"amber",
	"purple",
	"rose",
	"cyan",
	"orange",
] as const;
export const tagColor = z.enum(TAG_COLORS);
export const organizationTypeInput = z.object({
	id: z.string().optional(),
	label: z.string().trim().min(1, "Enter a type name.").max(40),
	color: tagColor,
	archived: z.boolean().default(false),
});
export const organizationTypeOutput = z.object({
	id: z.string(),
	label: z.string(),
	color: tagColor,
	archived: z.boolean(),
	position: z.number(),
});
export const organizationTypesOutput = z.object({
	canManage: z.boolean(),
	options: z.array(organizationTypeOutput),
});
