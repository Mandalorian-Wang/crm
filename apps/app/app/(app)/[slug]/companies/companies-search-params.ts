import { createListSearchParams } from "@/components/data-table/list-search-params";

export const companiesSearchParams = createListSearchParams({
	tabId: "favorites",
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: ["owner", "industry", "enrichment", "activity"] as const,
});
