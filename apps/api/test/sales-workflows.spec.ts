import { expect, test } from "bun:test";
import { assertActivityReplay } from "../src/activities/activity-replay";
import { assertDailyNoteReplay } from "../src/companies/daily-notes.service";
import { assertContactLogReplay } from "../src/companies/follow-up.service";
import { operationGuidance } from "../src/mcp/crm-mcp-guidance";

const at = new Date("2026-11-17T02:00:00Z");
const stored = {
	type: "NOTE",
	body: "Confirmed: sent. Reply unknown.",
	subject: null,
	createdBy: { id: "sales" },
	contact: { id: "person" },
	company: { id: "org" },
	deal: null,
	occurredAt: at,
	dueAt: null,
};
const input = {
	type: "NOTE",
	body: stored.body,
	subject: null,
	createdById: "sales",
	contactId: "person",
	companyId: "org",
	dealId: null,
	dueAt: null,
};

test("inbound note retries preserve the original event and reject a changed intent", () => {
	expect(() => assertActivityReplay(stored, input)).not.toThrow();
	expect(() =>
		assertActivityReplay(stored, { ...input, occurredAt: at }),
	).not.toThrow();
	for (const change of [
		{ body: "Reply confirmed" },
		{ contactId: "other" },
		{ companyId: "other" },
		{ occurredAt: new Date(at.getTime() + 1000) },
	])
		expect(() => assertActivityReplay(stored, { ...input, ...change })).toThrow(
			"different activity",
		);
});

test("outreach retries never silently replace evidence or timestamps", () => {
	const existing = {
		companyId: "org",
		contactId: "person",
		channel: "Email",
		body: "SENT readback; reply unknown",
		occurredAt: at,
	};
	const request = {
		...existing,
		channel: "Email" as const,
		occurredAt: at.toISOString(),
		requestId: crypto.randomUUID(),
	};
	expect(() => assertContactLogReplay(existing, request)).not.toThrow();
	for (const change of [
		{ companyId: "other" },
		{ body: "Delivered" },
		{ contactId: null },
		{ occurredAt: "2026-11-18T02:00:00Z" },
	])
		expect(() =>
			assertContactLogReplay(existing, { ...request, ...change }),
		).toThrow("different contact event");
});

test("customer review guidance includes all note stores and explicit evidence boundaries", () => {
	expect(operationGuidance("companies.customerContext", "sales")).toMatchObject(
		{
			purpose: expect.stringContaining("outreach history"),
			completeness: expect.stringContaining("nextCursor"),
			evidence: expect.stringContaining("updatedAt alone"),
		},
	);
	expect(operationGuidance("companies.syncStatus", "sales")).toMatchObject({
		freshness: expect.stringContaining("RUNNING or INTERRUPTED"),
	});
	expect(operationGuidance("users.setCompanyFavorite", "sales")).toMatchObject({
		scope: expect.stringContaining("current API key user"),
	});
});

test("daily-note retries cannot silently discard changed content or attachments", () => {
	const request = {
		companyId: "org",
		requestId: crypto.randomUUID(),
		body: "Confirmed interview",
		mentions: [],
	};
	const stored = { body: request.body, mentions: [], images: [] };
	expect(() => assertDailyNoteReplay(stored, request)).not.toThrow();
	expect(() =>
		assertDailyNoteReplay(stored, { ...request, body: "New claim" }),
	).toThrow("different daily note");
	expect(() =>
		assertDailyNoteReplay({ ...stored, images: [{ id: "changed" }] }, request),
	).toThrow("different daily note");
});
