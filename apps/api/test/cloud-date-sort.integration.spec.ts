import { afterAll, beforeAll, expect, test } from "bun:test";
import { db } from "@crm/db";
import { Test, type TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { companyListInput } from "../src/companies/companies.contracts";
import { CompaniesService } from "../src/companies/companies.service";

const prefix = `date-sort-${crypto.randomUUID()}`;
let module: TestingModule;
let service: CompaniesService;
const ids: string[] = [];
beforeAll(async () => {
	module = await Test.createTestingModule({ imports: [AppModule] }).compile();
	service = module.get(CompaniesService);
	const field = await db.fieldDefinition.upsert({
		where: { entity_key: { entity: "COMPANY", key: "cloud_registered_at" } },
		create: {
			entity: "COMPANY",
			key: "cloud_registered_at",
			label: "Cloud organization created at",
			type: "DATE",
			position: 0,
		},
		update: {},
	});
	for (const [index, date] of [
		"2026-01-01T00:00:00Z",
		"2026-03-01T00:00:00Z",
		null,
	].entries()) {
		const company = await db.company.create({
			data: { name: `${prefix}-${index}` },
		});
		ids.push(company.id);
		if (date)
			await db.fieldValue.create({
				data: {
					fieldId: field.id,
					companyId: company.id,
					date: new Date(date),
				},
			});
	}
});
afterAll(async () => {
	await db.company.deleteMany({ where: { id: { in: ids } } });
	await module?.close();
});
test("Cloud date sorts before pagination and leaves missing dates last", async () => {
	const list = (dir: "asc" | "desc", page: number) =>
		service.list(
			companyListInput.parse({
				q: prefix,
				sort: "field:cloud_registered_at",
				dir,
				page,
				pageSize: 1,
			}),
		);
	expect((await list("asc", 1)).rows.map((r) => r.id)).toEqual(ids.slice(0, 1));
	expect((await list("asc", 2)).rows.map((r) => r.id)).toEqual(ids.slice(1, 2));
	expect((await list("desc", 1)).rows.map((r) => r.id)).toEqual(
		ids.slice(1, 2),
	);
	expect((await list("desc", 2)).rows.map((r) => r.id)).toEqual(
		ids.slice(0, 1),
	);
	expect((await list("desc", 3)).rows.map((r) => r.id)).toEqual(
		ids.slice(2, 3),
	);
	expect((await list("asc", 4)).rows).toEqual([]);
});
