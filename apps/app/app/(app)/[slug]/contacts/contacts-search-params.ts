import { createListSearchParams } from "@/components/data-table/list-search-params";

export const contactsSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	tabId: "origin",
	facetIds: [
		"owner",
		"company",
		"title",
		"seniority",
		"persona",
		"activity",
	] as const,
});
