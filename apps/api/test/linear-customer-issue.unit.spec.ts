import { afterEach, expect, it, spyOn } from "bun:test";
import type { Db } from "@crm/db";
import { LinearService } from "../src/linear/linear.service";

const originalKey = process.env.LINEAR_API_KEY,
	originalSlug = process.env.LINEAR_WORKSPACE_SLUG;
let request: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
afterEach(() => {
	request?.mockRestore();
	if (originalKey === undefined) delete process.env.LINEAR_API_KEY;
	else process.env.LINEAR_API_KEY = originalKey;
	if (originalSlug === undefined) delete process.env.LINEAR_WORKSPACE_SLUG;
	else process.env.LINEAR_WORKSPACE_SLUG = originalSlug;
});
it("recovers a linked customer request after a lost mutation response without duplication", async () => {
	process.env.LINEAR_API_KEY = "unit-test-key";
	process.env.LINEAR_WORKSPACE_SLUG = "polygala";
	const issue = {
		id: crypto.randomUUID(),
		identifier: "BUI-286",
		url: "https://linear.app/polygala/issue/BUI-286",
	};
	const result = (data: {
		issue?: typeof issue;
		customerNeeds?: { nodes: { id: string }[] };
	}) =>
		new Response(
			JSON.stringify({
				data: { organization: { urlKey: "polygala" }, ...data },
			}),
		);
	request = spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(result({ issue }))
		.mockResolvedValueOnce(result({ customerNeeds: { nodes: [] } }))
		.mockResolvedValueOnce(result({}))
		.mockRejectedValueOnce(new Error("Response lost"))
		.mockResolvedValueOnce(
			result({ customerNeeds: { nodes: [{ id: "need" }] } }),
		)
		.mockResolvedValueOnce(result({ issue }))
		.mockResolvedValueOnce(
			result({ customerNeeds: { nodes: [{ id: "need" }] } }),
		);
	const service = new LinearService({} as Db);
	spyOn(service, "binding").mockResolvedValue({
		configured: true,
		customer: {
			id: "customer-id",
			name: "Customer",
			url: "https://linear.app/polygala/customer/customer",
		},
	});
	expect(await service.linkIssue("company-id", "BUI-286")).toEqual(issue);
	expect(await service.linkIssue("company-id", issue.url)).toEqual(issue);
	const calls = request.mock.calls.map((call) =>
		JSON.parse(String(call[1]?.body)),
	);
	const writes = calls.filter((call) => call.query.startsWith("mutation"));
	expect(writes).toHaveLength(1);
	expect(writes[0].variables.needInput.customerId).toBe("customer-id");
	expect(writes[0].variables.needInput.issueId).toBe(issue.id);
});
