import { afterAll, beforeAll, expect, test } from "bun:test";
import { db } from "@crm/db";
import { Test, type TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { companyListInput } from "../src/companies/companies.contracts";
import { CompaniesService } from "../src/companies/companies.service";

const prefix = `cloud-filter-${crypto.randomUUID()}`;
let module: TestingModule;
let companies: CompaniesService;
const ids: string[] = [];
const fields: string[] = [];
const keys = {
	boxes: `${prefix}-boxes`,
	usage: `${prefix}-usage`,
	date: `${prefix}-date`,
};
beforeAll(async () => {
	module = await Test.createTestingModule({ imports: [AppModule] }).compile();
	companies = module.get(CompaniesService);
	await db.user.create({
		data: { id: prefix, name: prefix, email: `${prefix}@example.test` },
	});
	for (const [key, type] of [
		[keys.boxes, "NUMBER"],
		[keys.usage, "NUMBER"],
		[keys.date, "DATE"],
	] as const) {
		const field = await db.fieldDefinition.create({
			data: {
				entity: "COMPANY",
				key,
				label: key,
				type,
				position: 0,
				showOnFilter: true,
			},
		});
		fields.push(field.id);
	}
	for (let i = 0; i < 5; i++) {
		const company = await db.company.create({
			data: { name: `${prefix}-${i}` },
		});
		ids.push(company.id);
		await db.fieldValue.create({
			data: {
				companyId: company.id,
				fieldId: fields[0] as string,
				number: i === 1 ? 0 : 3,
			},
		});
		if (i !== 4)
			await db.fieldValue.create({
				data: {
					companyId: company.id,
					fieldId: fields[1] as string,
					number: i === 2 ? 0 : "12.3400",
				},
			});
		await db.fieldValue.create({
			data: {
				companyId: company.id,
				fieldId: fields[2] as string,
				date: new Date(
					i === 3 ? "2026-11-08T16:00:00Z" : "2026-11-07T16:00:00Z",
				),
			},
		});
	}
	for (const archivedAt of [null, new Date()])
		await db.deal.create({
			data: {
				companyId: ids[0] as string,
				name: prefix,
				stage: "NEW_SIGNUP",
				ownerId: prefix,
				archivedAt,
			},
		});
});
afterAll(async () => {
	await db.deal.deleteMany({ where: { name: prefix } });
	await db.company.deleteMany({ where: { id: { in: ids } } });
	await db.fieldDefinition.deleteMany({ where: { id: { in: fields } } });
	await db.user.deleteMany({ where: { id: prefix } });
	await module?.close();
});
test("numeric and Shanghai registration ranges combine with AND before pagination", async () => {
	const result = await companies.list(
		companyListInput.parse({
			q: prefix,
			pageSize: 1,
			fields: {
				[keys.boxes]: ["min:1"],
				[keys.usage]: ["min:10", "max:20"],
				[keys.date]: ["min:2026-11-08", "max:2026-11-08"],
			},
		}),
	);
	expect(result.total).toBe(1);
	expect(result.rows[0]?.id).toBe(ids[0]);
	expect(result.rows[0]?.openDealCount).toBe(1);
});
test("unknown money is excluded from a numeric range including zero", async () => {
	const result = await companies.list(
		companyListInput.parse({ q: prefix, fields: { [keys.usage]: ["min:0"] } }),
	);
	expect(result.total).toBe(4);
	expect(result.rows.some((row) => row.id === ids[4])).toBe(false);
});
test("invalid and reversed ranges fail rather than silently broadening the list", async () => {
	for (const fields of [
		{ [keys.date]: ["min:2026-02-30"] },
		{ [keys.boxes]: ["min:8", "max:2"] },
		{ [keys.date]: ["min:2026-11-09", "max:2026-11-08"] },
		{ [keys.usage]: ["min:1 OR 1=1"] },
	]) {
		await expect(
			companies.list(companyListInput.parse({ q: prefix, fields })),
		).rejects.toThrow();
	}
});
