import { afterEach, describe, expect, it, spyOn } from "bun:test";
import type { Db } from "@crm/db";
import { z } from "zod";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { FieldsService } from "../src/fields/fields.service";
import type { linearNeedsOutput } from "../src/linear/linear.contracts";
import { LinearService } from "../src/linear/linear.service";
import { customerReference, linearRequest } from "../src/linear/linear-client";

const originalKey = process.env.LINEAR_API_KEY;
const originalWorkspace = process.env.LINEAR_WORKSPACE_SLUG;
let request: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
afterEach(() => {
	request?.mockRestore();
	if (originalKey === undefined) delete process.env.LINEAR_API_KEY;
	else process.env.LINEAR_API_KEY = originalKey;
	if (originalWorkspace === undefined) delete process.env.LINEAR_WORKSPACE_SLUG;
	else process.env.LINEAR_WORKSPACE_SLUG = originalWorkspace;
});
function configure() {
	process.env.LINEAR_API_KEY = "unit-test-key";
	process.env.LINEAR_WORKSPACE_SLUG = "polygala";
}
function response(
	data: Partial<z.infer<typeof linearNeedsOutput>> & {
		organization?: { urlKey: string };
		result?: string;
	},
) {
	return new Response(
		JSON.stringify({ data: { organization: { urlKey: "polygala" }, ...data } }),
	);
}

describe("Linear customer integration", () => {
	it("accepts customer references but rejects other workspaces and arbitrary URLs", () => {
		expect(
			customerReference(
				"https://linear.app/polygala/customer/acme-92e01519043f",
				"polygala",
			),
		).toBe("92e01519043f");
		for (const value of [
			"https://evil.test/polygala/customer/acme-92e01519043f",
			"https://linear.app/other/customer/acme-92e01519043f",
			"https://linear.app/polygala/issue/ABC-1",
			"http://localhost/",
		])
			expect(() => customerReference(value, "polygala")).toThrow();
	});
	it("fails closed on GraphQL errors and workspace mismatch", async () => {
		configure();
		request = spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ errors: [{ message: "upstream-private-detail" }] }),
				),
			)
			.mockResolvedValueOnce(
				response({ organization: { urlKey: "other" }, result: "x" }),
			);
		await expect(
			linearRequest("query", {}, z.object({ result: z.string() })),
		).rejects.toThrow("Linear could not read");
		await expect(
			linearRequest("query", {}, z.object({ result: z.string() })),
		).rejects.toThrow("different workspace");
	});
	it("treats missing configuration as unavailable without a network request", async () => {
		delete process.env.LINEAR_API_KEY;
		request = spyOn(globalThis, "fetch");
		await expect(linearRequest("query", {}, z.object({}))).rejects.toThrow(
			"not configured",
		);
		expect(request).not.toHaveBeenCalled();
	});
	it("reads all request pages and deduplicates issues while ignoring project-only requests", async () => {
		configure();
		const issue = {
			id: "issue-1",
			identifier: "BOX-1",
			title: "Example",
			url: "https://linear.app/polygala/issue/BOX-1",
			priorityLabel: "High",
			state: { name: "Todo" },
			assignee: null,
			updatedAt: "2026-11-09T00:00:00Z",
		};
		request = spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				response({
					customerNeeds: {
						nodes: [{ issue }, { issue: null }],
						pageInfo: { hasNextPage: true, endCursor: "next" },
					},
				}),
			)
			.mockResolvedValueOnce(
				response({
					customerNeeds: {
						nodes: [{ issue }],
						pageInfo: { hasNextPage: false, endCursor: null },
					},
				}),
			);
		const service = new LinearService({} as Db);
		spyOn(service, "binding").mockResolvedValue({
			configured: true,
			customer: {
				id: "customer-1",
				name: "Acme",
				url: "https://linear.app/polygala/customer/acme-92e01519043f",
			},
		});
		const result = await service.issues("company-1");
		expect(result.issues).toHaveLength(1);
		expect(
			JSON.parse(String(request.mock.calls[1]?.[1]?.body)).variables.after,
		).toBe("next");
	});
});

describe("source-managed field writes", () => {
	it("rejects a direct API value edit, including a mixed manual/source payload", async () => {
		const service = new FieldsService({} as Db, {} as AgentTriggerService);
		for (const fields of [
			{ cloud_organization_id: "replacement" },
			{ notion_document: "https://notion.so/test", cloud_box_count: 100 },
			{ registration_source: "Github" },
		]) {
			await expect(
				service.applyValues({} as Db, "COMPANY", "company-1", fields),
			).rejects.toThrow("read-only");
		}
	});
});
