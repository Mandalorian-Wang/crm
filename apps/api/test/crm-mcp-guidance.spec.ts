import { expect, test } from "bun:test";
import { z } from "zod";
import {
	assertNoDiscardedKeys,
	operationGuidance,
	validateFieldFilters,
} from "../src/mcp/crm-mcp-guidance";

test("MCP rejects ignored properties before a partial update can report false success", () => {
	const schema = z.object({ data: z.object({ name: z.string().optional() }) });
	const input = { data: { nmae: "Acme" } };
	expect(() => assertNoDiscardedKeys(input, schema.parse(input))).toThrow(
		"input.data.nmae",
	);
	const valid = { data: { name: "Acme" } };
	expect(() => assertNoDiscardedKeys(valid, schema.parse(valid))).not.toThrow();
});

test("MCP rejects unknown, non-filterable fields and option labels", () => {
	const fields = [
		{
			key: "organization_type",
			label: "Type",
			type: "SELECT" as const,
			readOnly: false,
			filterable: true,
			options: [{ id: "startup-id", label: "Startup", position: 0 }],
		},
	];
	expect(() =>
		validateFieldFilters({ fields: { box_count: ["min:4"] } }, fields),
	).toThrow("not filterable");
	expect(() =>
		validateFieldFilters(
			{ fields: { organization_type: ["Startup"] } },
			fields,
		),
	).toThrow("option IDs");
	expect(() =>
		validateFieldFilters(
			{ fields: { organization_type: ["startup-id"] } },
			fields,
		),
	).not.toThrow();
	expect(() =>
		validateFieldFilters(
			{ fields: { organization_type: ["startup-id"] } },
			fields.map((field) => ({ ...field, filterable: false })),
		),
	).toThrow("not filterable");
});

test("discovery gives identity-specific owner and integer box filter examples", () => {
	const guidance = operationGuidance("companies.list", "sales-user");
	expect(guidance.myCustomers).toEqual({ owner: ["sales-user"] });
	expect(guidance.moreThanThreeBoxes).toEqual({
		fields: { cloud_box_count: ["min:4"] },
	});
});
