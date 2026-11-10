import { afterAll, afterEach, beforeAll, expect, spyOn, test } from "bun:test";
import { db } from "@crm/db";
import { LinearService } from "../src/linear/linear.service";

const key = process.env.LINEAR_API_KEY,
	slug = process.env.LINEAR_WORKSPACE_SLUG;
const service = new LinearService(db);
let companyId: string;
let request: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
beforeAll(async () => {
	companyId = (
		await db.company.create({
			data: { name: "Customer creation integration test" },
		})
	).id;
});
afterEach(() => {
	request?.mockRestore();
	if (key === undefined) delete process.env.LINEAR_API_KEY;
	else process.env.LINEAR_API_KEY = key;
	if (slug === undefined) delete process.env.LINEAR_WORKSPACE_SLUG;
	else process.env.LINEAR_WORKSPACE_SLUG = slug;
});
afterAll(async () => {
	await db.company.delete({ where: { id: companyId } });
});
test("creates and binds once; retries use stable external identity and do not replace an existing binding", async () => {
	process.env.LINEAR_API_KEY = "test-only-key";
	process.env.LINEAR_WORKSPACE_SLUG = "polygala";
	const customer = {
		id: crypto.randomUUID(),
		name: "Example customer",
		url: "https://linear.app/polygala/customer/example-123456789012",
	};
	const workspace = () =>
		new Response(
			JSON.stringify({ data: { organization: { urlKey: "polygala" } } }),
		);
	request = spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(workspace())
		.mockRejectedValueOnce(new Error("Response lost"))
		.mockResolvedValueOnce(workspace())
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					data: { customerUpsert: { success: true, customer } },
				}),
			),
		);
	await expect(
		service.createCustomer(companyId, customer.name),
	).rejects.toThrow("unreachable");
	expect((await service.binding(companyId)).customer).toBeNull();
	expect(
		(await service.createCustomer(companyId, customer.name)).customer,
	).toEqual(customer);
	expect(
		(await service.createCustomer(companyId, "Changed name")).customer,
	).toEqual(customer);
	const writes = request.mock.calls
		.map((call) => JSON.parse(String(call[1]?.body)))
		.filter((call) => call.query.startsWith("mutation"));
	expect(writes).toHaveLength(2);
	expect(writes[0].variables.customerInput).toEqual(
		writes[1].variables.customerInput,
	);
	expect(writes[0].variables.customerInput.externalId).toBe(
		`boxlite-crm:${companyId}`,
	);
	expect(request).toHaveBeenCalledTimes(4);
});
