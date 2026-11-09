import { createListSearchParams } from "@/components/data-table/list-search-params";

export const companiesSearchParams = createListSearchParams({
	tabId: "favorites",
	defaultSort: "field:cloud_registered_at",
	defaultDir: "desc",
	facetIds: [
		"owner",
		"industry",
		"enrichment",
		"activity",
		"followUpStatus",
		"followUpDue",
	] as const,
});
