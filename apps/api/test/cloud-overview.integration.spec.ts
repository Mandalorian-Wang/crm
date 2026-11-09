import { afterAll, beforeAll, expect, test } from "bun:test";
import { db } from "@crm/db";
import {
	cloudOverviewKey,
	createdBoxInWindow,
	previousShanghaiDay,
} from "@crm/validation/cloud-overview";
import { Test, type TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { DashboardService } from "../src/dashboard/dashboard.service";

const prefix = `cloud-overview-${crypto.randomUUID()}`;
const now = new Date("2001-01-02T04:00:00Z");
const { start, end, date } = previousShanghaiDay(now);
let module: TestingModule;
let dashboard: DashboardService;
const ids: string[] = [];
const companyIds: string[] = [];
const memberIds: string[] = [];
beforeAll(async () => {
	module = await Test.createTestingModule({ imports: [AppModule] }).compile();
	dashboard = module.get(DashboardService);
	for (let i = 0; i < 2; i++) {
		const company = await db.company.create({
			data: { name: `${prefix}-org-${i}` },
		});
		companyIds.push(company.id);
		await db.importedRecord.create({
			data: {
				source: "cloud",
				kind: "company",
				externalId: `${prefix}-org-${i}`,
				recordId: company.id,
			},
		});
	}
	for (let i = 0; i < 24; i++) {
		const contact = await db.contact.create({
			data: {
				firstName: `${prefix}-${i}`,
				archivedAt: i === 23 ? new Date() : null,
			},
		});
		ids.push(contact.id);
		memberIds.push(`${prefix}-user-${i}`);
		await db.importedRecord.create({
			data: {
				source: "cloud",
				kind: "contact",
				externalId: memberIds[i] as string,
				recordId: contact.id,
			},
		});
	}
	ids.push(
		(await db.contact.create({ data: { firstName: prefix, createdAt: start } }))
			.id,
	);
	await db.cloudDailyOverview.create({
		data: {
			date,
			evidence: {
				[`${prefix}-org-0`]: {
					createdAt: start.toISOString(),
					createdBox: true,
					memberIds,
				},
				[`${prefix}-org-1`]: {
					createdAt: start.toISOString(),
					createdBox: null,
					memberIds: [memberIds[0] as string],
				},
			},
		},
	});
});
afterAll(async () => {
	await db.cloudDailyOverview.deleteMany({
		where: {
			date: { in: [date, "1999-01-01", "2000-12-26:7", "2000-12-18:15"] },
		},
	});
	await db.importedRecord.deleteMany({
		where: { externalId: { startsWith: prefix } },
	});
	await db.contact.deleteMany({ where: { id: { in: ids } } });
	await db.company.deleteMany({ where: { id: { in: companyIds } } });
	await module?.close();
});
test("Shanghai day boundaries include year and leap transitions", () => {
	expect(previousShanghaiDay(new Date("2026-11-08T15:59:59.999Z")).date).toBe(
		"2026-11-07",
	);
	const after = previousShanghaiDay(new Date("2026-11-08T16:00:00Z"));
	expect(after.date).toBe("2026-11-08");
	expect(after.start.toISOString()).toBe("2026-11-07T16:00:00.000Z");
	expect(previousShanghaiDay(new Date("2027-01-01T00:00:00+08:00")).date).toBe(
		"2026-12-31",
	);
	expect(previousShanghaiDay(new Date("2024-03-01T00:00:00+08:00")).date).toBe(
		"2024-02-29",
	);
});
test("later creation is unknown rather than falsely inactive", () => {
	expect(createdBoxInWindow(start.toISOString(), start, end)).toBe(true);
	expect(
		createdBoxInWindow(new Date(end.getTime() - 1).toISOString(), start, end),
	).toBe(true);
	expect(createdBoxInWindow(end.toISOString(), start, end)).toBeNull();
	expect(createdBoxInWindow(null, start, end)).toBeNull();
});
test("cohort membership ignores CRM import date, deduplicates users, and paginates", async () => {
	const first = await dashboard.cloudOverview(1, now);
	const second = await dashboard.cloudOverview(2, now);
	expect(first.total).toBe(23);
	expect(first.rows).toHaveLength(20);
	expect(second.rows).toHaveLength(3);
	const rows = [...first.rows, ...second.rows];
	expect(new Set(rows.map((row) => row.id)).size).toBe(23);
	expect(rows.find((row) => row.id === ids[0])?.organizations).toHaveLength(2);
	expect(rows.some((row) => row.id === ids[24])).toBe(false);
});
test("unknown activity stays separate from exact rates and zero denominators", async () => {
	const result = await dashboard.cloudOverview(1, now);
	expect(result.newCloudUsers).toBe(2);
	expect(result.createdBoxUsers).toBe(1);
	expect(result.activationRate).toBeNull();
	expect(result.confirmedRate).toBe(0.5);
	expect(result.unknownOrganizations).toBe(1);
	const pending = await dashboard.cloudOverview(
		1,
		new Date("1999-01-02T04:00:00Z"),
	);
	expect(pending.metricsStatus).toBe("PENDING");
	expect(pending.newCloudUsers).toBeNull();
	await db.cloudDailyOverview.create({
		data: { date: "1999-01-01", evidence: {} },
	});
	const empty = await dashboard.cloudOverview(
		1,
		new Date("1999-01-02T04:00:00Z"),
	);
	expect(empty.newCloudUsers).toBe(0);
	expect(empty.activationRate).toBeNull();
});

test("7 and 15 day windows have independent reports and exclude today", async () => {
	for (const days of [7, 15] as const) {
		const window = previousShanghaiDay(now, days);
		expect(window.end).toEqual(end);
		expect(window.end.getTime() - window.start.getTime()).toBe(days * 86400000);
		await db.cloudDailyOverview.create({
			data: {
				date: cloudOverviewKey(window.date, days),
				evidence: {
					[`${prefix}-org-0`]: {
						createdAt: window.start.toISOString(),
						createdBox: true,
						memberIds,
						memberCount: 24,
					},
				},
			},
		});
		const report = await dashboard.cloudOverview(1, now, days);
		expect(report.days).toBe(days);
		expect(report.from).toBe(window.start.toISOString());
		expect(report.newCloudUsers).toBe(1);
		expect(report.activationRate).toBe(1);
		expect(report.total).toBe(23);
	}
});
