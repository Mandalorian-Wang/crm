import { afterAll, beforeAll, expect, test } from "bun:test";
import { db } from "@crm/db";
import { Test, type TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { companyListInput } from "../src/companies/companies.contracts";
import { CompaniesService } from "../src/companies/companies.service";
import { UsersService } from "../src/users/users.service";

const prefix = `personal-${crypto.randomUUID()}`;
const alice = `${prefix}-alice`,
	bob = `${prefix}-bob`;
let module: TestingModule;
let users: UsersService;
let companies: CompaniesService;
let first: string, second: string;
beforeAll(async () => {
	module = await Test.createTestingModule({ imports: [AppModule] }).compile();
	users = module.get(UsersService);
	companies = module.get(CompaniesService);
	for (const id of [alice, bob])
		await db.user.create({
			data: { id, name: id, email: `${id}@example.test` },
		});
	first = (await db.company.create({ data: { name: `${prefix}-one` } })).id;
	second = (await db.company.create({ data: { name: `${prefix}-two` } })).id;
});
afterAll(async () => {
	await db.company.deleteMany({ where: { id: { in: [first, second] } } });
	await db.user.deleteMany({ where: { id: { in: [alice, bob] } } });
	await module?.close();
});
test("column preferences persist per account and per table", async () => {
	expect(
		(await users.tablePreference(alice, "companies")).hiddenColumns,
	).toBeNull();
	await users.saveTablePreference(alice, "companies", [
		"domain",
		"domain",
		"field:linear_url",
	]);
	expect(
		(await users.tablePreference(alice, "companies")).hiddenColumns,
	).toEqual(["domain", "field:linear_url"]);
	expect(
		(await users.tablePreference(bob, "companies")).hiddenColumns,
	).toBeNull();
	expect(
		(await users.tablePreference(alice, "contacts")).hiddenColumns,
	).toBeNull();
	await users.saveTablePreference(alice, "companies", []);
	expect(
		(await users.tablePreference(alice, "companies")).hiddenColumns,
	).toEqual([]);
});
test("favorites belong to each user and filter before pagination", async () => {
	await users.setCompanyFavorite(alice, first, true);
	await users.setCompanyFavorite(alice, first, true);
	await users.setCompanyFavorite(alice, second, true);
	await users.setCompanyFavorite(bob, second, true);
	const input = companyListInput.parse({
		q: prefix,
		favorites: "mine",
		pageSize: 1,
		sort: "name",
		dir: "asc",
	});
	const a = await companies.list(input, alice);
	expect(a.total).toBe(2);
	expect(a.rows[0]?.id).toBe(first);
	expect(a.rows[0]?.isFavorite).toBe(true);
	const next = await companies.list({ ...input, page: 2 }, alice);
	expect(next.rows[0]?.id).toBe(second);
	const b = await companies.list(input, bob);
	expect(b.total).toBe(1);
	expect(b.rows[0]?.id).toBe(second);
	await users.setCompanyFavorite(alice, second, false);
	expect((await companies.list(input, alice)).total).toBe(1);
	expect((await companies.list(input, bob)).total).toBe(1);
	const all = await companies.list(
		{ ...input, favorites: "all", pageSize: 25 },
		bob,
	);
	expect(all.rows.find((row) => row.id === first)?.isFavorite).toBe(false);
});
