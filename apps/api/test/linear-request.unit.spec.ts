import { afterEach, expect, it, spyOn } from "bun:test";
import type { Db } from "@crm/db";
import { LinearService } from "../src/linear/linear.service";

const keys = [
	"LINEAR_API_KEY",
	"LINEAR_WORKSPACE_SLUG",
	"LINEAR_CRM_PROJECT_ID",
	"LINEAR_CRM_TEAM_ID",
	"LINEAR_CRM_LABEL_ID",
] as const;
const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
let request: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
afterEach(() => {
	request?.mockRestore();
	for (const key of keys) {
		if (before[key] === undefined) delete process.env[key];
		else process.env[key] = before[key];
	}
});

it("recovers a committed issue after a lost response and retries without another mutation", async () => {
	for (const key of keys) process.env[key] = key;
	process.env.LINEAR_WORKSPACE_SLUG = "polygala";
	const issue = {
		id: "id",
		identifier: "POL-123",
		url: "https://linear.app/polygala/issue/POL-123",
	};
	const empty = () =>
		new Response(
			JSON.stringify({
				data: { organization: { urlKey: "polygala" }, issues: { nodes: [] } },
			}),
		);
	const found = () =>
		new Response(
			JSON.stringify({
				data: {
					organization: { urlKey: "polygala" },
					issues: { nodes: [issue] },
				},
			}),
		);
	request = spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(empty())
		.mockResolvedValueOnce(empty())
		.mockRejectedValueOnce(new Error("response lost"))
		.mockResolvedValueOnce(found())
		.mockResolvedValueOnce(found());
	const service = new LinearService({} as Db);
	const input = {
		requestId: crypto.randomUUID(),
		title: "Feature request",
		content: "Content",
	};
	const user = { id: "u1", name: "Test", email: "test@polygala.ai" };
	expect(await service.submitRequest(input, user)).toEqual(issue);
	expect(await service.submitRequest(input, user)).toEqual(issue);
	const calls = request.mock.calls.map((call) =>
		JSON.parse(String(call[1]?.body)),
	);
	const writes = calls.filter((call) => call.query.startsWith("mutation"));
	expect(writes).toHaveLength(1);
	expect(writes[0].variables.input.projectId).toBe("LINEAR_CRM_PROJECT_ID");
	expect(writes[0].variables.input.labelIds).toEqual(["LINEAR_CRM_LABEL_ID"]);
	expect(writes[0].variables.input.description).toContain(user.email);
});
