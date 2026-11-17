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

export const ORGANIZATION_DICTIONARIES = [
	{ key: "organization_type", label: "Organization type", description: "One colored label per organization, displayed beside its name." },
	{ key: "growth_channel", label: "Growth channel", description: "How the customer first heard about BoxLite. Select one channel." },
	{ key: "customer_region", label: "Customer region", description: "The customer's actual location, not the Cloud deployment region. Select one region." },
	{ key: "competitors", label: "Competitors in use", description: "Products the customer is testing or using. Select multiple products; leave empty when unknown." },
] as const;
export const organizationDictionaryKey = z.enum(["organization_type", "growth_channel", "customer_region", "competitors"]);
export type OrganizationDictionaryKey = z.infer<typeof organizationDictionaryKey>;
export const organizationDictionaryInput = z.object({ key: organizationDictionaryKey.default("organization_type") }).default({ key: "organization_type" });
export const organizationDictionaryOptionInput = organizationTypeInput.extend({ key: organizationDictionaryKey.default("organization_type") });
