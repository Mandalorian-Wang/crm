import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { scheduledDay } from "../src/config";
import {
	customerSnapshot,
	customers,
	members,
	normalizedEmail,
} from "../src/source";

const originalKey = process.env.BACKOFFICE_API_KEY;
afterEach(() => {
	mock.restore();
	process.env.BACKOFFICE_API_KEY = originalKey;
});

describe("import boundaries", () => {
	test("08:00 Shanghai is the daily UTC boundary", () => {
		expect(scheduledDay(new Date("2026-11-09T07:59:59+08:00"))).toBe(
			"2026-11-08",
		);
		expect(scheduledDay(new Date("2026-11-09T08:00:00+08:00"))).toBe(
			"2026-11-09",
		);
	});
	test("missing or invalid emails remain unknown", () => {
		expect(normalizedEmail("")).toBeNull();
		expect(normalizedEmail("not-an-email")).toBeNull();
		expect(normalizedEmail(" Person@Example.com ")).toBe("person@example.com");
	});
	test("empty customer pages with cursors are not completion", async () => {
		process.env.BACKOFFICE_API_KEY = "test-key";
		const urls: string[] = [];
		spyOn(globalThis, "fetch").mockImplementation(
			Object.assign(
				async (url: RequestInfo | URL) => {
					urls.push(String(url));
					return Response.json({
						items: [],
						nextCursor: urls.length === 1 ? "opaque-next" : null,
					});
				},
				{ preconnect: fetch.preconnect },
			),
		);
		const rows = [];
		for await (const row of customers()) rows.push(row);
		expect(rows).toEqual([]);
		expect(urls).toHaveLength(2);
		expect(
			new URL(urls[1] ?? "https://invalid.test").searchParams.get("cursor"),
		).toBe("opaque-next");
	}, 10_000);
	test("member paging follows memberCursor, independently of boxes", async () => {
		process.env.BACKOFFICE_API_KEY = "test-key";
		const urls: string[] = [];
		spyOn(globalThis, "fetch").mockImplementation(
			Object.assign(
				async (url: RequestInfo | URL) => {
					urls.push(String(url));
					return Response.json({
						members: {
							items: [
								{
									userId: `u${urls.length}`,
									email: "",
									organizationRole: "member",
								},
							],
							nextCursor: urls.length === 1 ? "members-next" : null,
						},
						boxes: { nextCursor: "ignored" },
					});
				},
				{ preconnect: fetch.preconnect },
			),
		);
		const rows = [];
		for await (const row of members("org1")) rows.push(row);
		expect(rows).toHaveLength(2);
		expect(
			new URL(urls[1] ?? "https://invalid.test").searchParams.get(
				"memberCursor",
			),
		).toBe("members-next");
		expect(
			new URL(urls[1] ?? "https://invalid.test").searchParams.has("boxCursor"),
		).toBe(false);
	}, 10_000);
	test("forbidden access fails without advancing as empty success", async () => {
		process.env.BACKOFFICE_API_KEY = "test-key";
		spyOn(globalThis, "fetch").mockImplementation(
			Object.assign(async () => new Response("denied", { status: 403 }), {
				preconnect: fetch.preconnect,
			}),
		);
		await expect(customers().next()).rejects.toThrow("HTTP 403");
	});
});

test("optional activation does not prevent importing organization members", async () => {
	process.env.BACKOFFICE_API_KEY = "test-key";
	spyOn(globalThis, "fetch").mockImplementation(
		Object.assign(
			async () =>
				Response.json({
					members: {
						items: [
							{
								userId: "u1",
								email: "user@example.com",
								organizationRole: "owner",
							},
						],
						nextCursor: null,
					},
				}),
			{ preconnect: fetch.preconnect },
		),
	);
	const snapshot = await customerSnapshot("org1");
	expect(snapshot.activation).toBeUndefined();
	const rows = [];
	for await (const member of members("org1", snapshot)) rows.push(member);
	expect(rows.map((row) => row.userId)).toEqual(["u1"]);
});
