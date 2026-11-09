import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { allowedLinearIdentity, linearUserInfo } from "../src/linear";

const workspace = process.env.LINEAR_WORKSPACE_ID;
let request: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
afterEach(() => {
	request?.mockRestore();
	if (workspace === undefined) delete process.env.LINEAR_WORKSPACE_ID;
	else process.env.LINEAR_WORKSPACE_ID = workspace;
});
describe("Linear login identity", () => {
	it("requires exact email domain, active membership and the configured workspace ID", () => {
		process.env.LINEAR_WORKSPACE_ID = "workspace-id";
		expect(
			allowedLinearIdentity(
				"user@polygala.ai",
				true,
				"polygala",
				"workspace-id",
			),
		).toBe(true);
		for (const email of [
			"user@polylaga.ai",
			"user@sub.polygala.ai",
			"user@polygala.ai.evil.test",
			"user@gmail.com",
			"a@polygala.ai@evil.test",
		])
			expect(
				allowedLinearIdentity(email, true, "polygala", "workspace-id"),
			).toBe(false);
		expect(
			allowedLinearIdentity(
				"user@polygala.ai",
				false,
				"polygala",
				"workspace-id",
			),
		).toBe(false);
		expect(
			allowedLinearIdentity("user@polygala.ai", true, "polygala", "other-id"),
		).toBe(false);
		delete process.env.LINEAR_WORKSPACE_ID;
		expect(
			allowedLinearIdentity(
				"user@polygala.ai",
				true,
				"polygala",
				"workspace-id",
			),
		).toBe(false);
	});
	it("fails closed on a partial GraphQL error or unavailable Linear", async () => {
		request = spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ errors: [{ message: "no access" }] })),
			)
			.mockRejectedValueOnce(new Error("network"));
		expect(await linearUserInfo({ accessToken: "test-token" })).toBeNull();
		expect(await linearUserInfo({ accessToken: "test-token" })).toBeNull();
	});
});
