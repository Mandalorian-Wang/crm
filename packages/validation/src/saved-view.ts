import { z } from "zod";
import { parse } from "./index";

export const savedViewFilters = z.object({
	hiddenColumns: z.array(z.string().max(200)).max(300).optional(),
	columnOrder: z.array(z.string().max(200)).max(300).optional(),
	q: z.string().default(""),
	sort: z.string().default(""),
	dir: z.enum(["asc", "desc"]).default("asc"),
	archived: z.boolean().default(false),
	filters: z.record(z.string(), z.array(z.string())).default({}),
});

export type SavedViewFilters = z.infer<typeof savedViewFilters>;

export function parseSavedViewFilters(value: unknown): SavedViewFilters {
	return parse(savedViewFilters, value, "saved view filters");
}
