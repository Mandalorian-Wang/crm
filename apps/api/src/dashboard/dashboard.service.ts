import { ActivityType, type Db, DealStage } from "@crm/db";
import { OPEN_DEAL_STAGES } from "@crm/db/deal-stage";
import { activityMeta } from "@crm/validation/activity-meta";
import {
	CLOUD_OVERVIEW as CLOUD_DASHBOARD,
	cloudOverviewEvidence,
	previousShanghaiDay,
} from "@crm/validation/cloud-overview";
import { Injectable } from "@nestjs/common";
import { toCents } from "../crm/values";
import { ConversionService } from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import type { DashboardSummaryInput } from "./dashboard.contracts";

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const TREND_MONTHS = 6;

const RATE_WINDOW_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short" });

function monthStart(from: Date, offset: number): Date {
	return new Date(from.getFullYear(), from.getMonth() + offset, 1);
}

function monthKey(date: Date): number {
	return date.getFullYear() * 12 + date.getMonth();
}

@Injectable()
export class DashboardService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly conversion: ConversionService,
	) {}

	async cloudOverview(page: number, now = new Date()) {
		const { start, end, date } = previousShanghaiDay(now);
		const report = await this.db.cloudDailyOverview.findUnique({
			where: { date },
		});
		const evidence = report ? cloudOverviewEvidence.parse(report.evidence) : {};
		const entries = Object.entries(evidence);
		const memberIds = [
			...new Set(entries.flatMap(([, entry]) => entry.memberIds ?? [])),
		];
		const [contactsRefs, companyRefs] = await Promise.all([
			this.db.importedRecord.findMany({
				where: {
					source: "cloud",
					kind: "contact",
					externalId: { in: memberIds },
				},
				select: { externalId: true, recordId: true },
			}),
			this.db.importedRecord.findMany({
				where: {
					source: "cloud",
					kind: "company",
					externalId: { in: entries.map(([id]) => id) },
				},
				select: { externalId: true, recordId: true },
			}),
		]);
		const where = {
			archivedAt: null,
			id: { in: [...new Set(contactsRefs.map((ref) => ref.recordId))] },
		};
		const [contacts, total, companies] = await Promise.all([
			this.db.contact.findMany({
				where,
				skip: (page - 1) * CLOUD_DASHBOARD.pageSize,
				take: CLOUD_DASHBOARD.pageSize,
				orderBy: [{ firstName: "asc" }, { id: "asc" }],
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					createdAt: true,
				},
			}),
			this.db.contact.count({ where }),
			this.db.company.findMany({
				where: {
					id: { in: companyRefs.map((ref) => ref.recordId) },
					archivedAt: null,
				},
				select: { id: true, name: true },
			}),
		]);
		const organizationByExternalId = new Map(
			companyRefs.map((ref) => [
				ref.externalId,
				companies.find((company) => company.id === ref.recordId),
			]),
		);
		const contactByExternalId = new Map(
			contactsRefs.map((ref) => [ref.externalId, ref.recordId]),
		);
		const linked = new Map<string, { id: string; name: string }[]>();
		for (const [orgId, entry] of entries) {
			const organization = organizationByExternalId.get(orgId);
			if (!organization) continue;
			for (const userId of entry.memberIds ?? []) {
				const contactId = contactByExternalId.get(userId);
				if (!contactId) continue;
				const groups = linked.get(contactId) ?? [];
				if (!groups.some((group) => group.id === organization.id))
					groups.push(organization);
				linked.set(contactId, groups);
			}
		}
		const active = entries.filter(
			([, entry]) => entry.createdBox === true,
		).length;
		const unknown = entries.filter(
			([, entry]) => entry.createdBox === null,
		).length;
		const pendingMemberships = entries.filter(
			([, entry]) => entry.memberIds === null,
		).length;
		const rate = entries.length ? active / entries.length : null;
		return {
			date,
			timezone: CLOUD_DASHBOARD.timezone,
			from: start.toISOString(),
			to: end.toISOString(),
			newCloudUsers: report ? entries.length : null,
			createdBoxUsers: report ? active : null,
			activationRate: report && unknown === 0 ? rate : null,
			confirmedRate: report ? rate : null,
			unknownOrganizations: unknown,
			pendingMemberships,
			syncedAt: report?.syncedAt.toISOString() ?? null,
			metricsStatus: !report
				? ("PENDING" as const)
				: unknown || pendingMemberships
					? ("PARTIAL" as const)
					: ("READY" as const),
			page,
			pageSize: CLOUD_DASHBOARD.pageSize,
			total,
			rows: contacts.map((contact) => ({
				id: contact.id,
				name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
				email: contact.email,
				organizations: linked.get(contact.id) ?? [],
				addedAt: contact.createdAt.toISOString(),
				source: "Cloud",
			})),
		};
	}

	async summary(actingUserId: string, input: DashboardSummaryInput) {
		const mine = input.scope === "me";
		const owned = mine ? { ownerId: actingUserId } : {};

		const now = new Date();
		const startOfMonth = monthStart(now, 0);
		const startOfNextMonth = monthStart(now, 1);
		const startOfPrevMonth = monthStart(now, -1);
		const trendStart = monthStart(now, -(TREND_MONTHS - 1));
		const rateStart = new Date(now.getTime() - RATE_WINDOW_DAYS * DAY_MS);

		const base = await this.conversion.reportingCurrency();
		const counted = this.conversion.countedWhere(base);

		const [
			openByStage,
			openValueByStage,
			recentDeals,
			closingThisMonthTotals,
			biggestOpen,
			overdueTasks,
			recentActivity,
			unconverted,
		] = await Promise.all([
			this.db.deal.groupBy({
				by: ["stage"],
				where: { ...owned, stage: { in: [...OPEN_DEAL_STAGES] } },
				_count: { _all: true },
			}),
			this.db.deal.groupBy({
				by: ["stage"],
				where: {
					AND: [{ ...owned, stage: { in: [...OPEN_DEAL_STAGES] } }, counted],
				},
				_sum: { baseAmount: true },
			}),
			this.db.deal.findMany({
				where: {
					...owned,
					OR: [
						{ createdAt: { gte: trendStart } },
						{ closedAt: { gte: trendStart } },
					],
				},
				select: {
					baseAmount: true,
					baseCurrency: true,
					stage: true,
					createdAt: true,
					closedAt: true,
				},
			}),
			this.db.deal.aggregate({
				where: {
					AND: [
						{
							...owned,
							stage: { in: [...OPEN_DEAL_STAGES] },
							expectedCloseDate: { gte: startOfMonth, lt: startOfNextMonth },
						},
						counted,
					],
				},
				_count: { _all: true },
				_sum: { baseAmount: true },
			}),
			this.db.deal.findMany({
				where: { ...owned, stage: { in: [...OPEN_DEAL_STAGES] } },
				orderBy: [
					{ baseAmount: { sort: "desc", nulls: "last" } },
					{ expectedCloseDate: "asc" },
				],
				take: 6,
				select: {
					id: true,
					name: true,
					stage: true,
					amount: true,
					currency: true,
					baseAmount: true,
					baseCurrency: true,
					expectedCloseDate: true,
					stageChangedAt: true,
					company: {
						select: {
							id: true,
							name: true,
							iconUrl: true,
							iconDarkUrl: true,
							iconTone: true,
						},
					},
					owner: { select: OWNER_SELECT },
				},
			}),
			this.db.activity.findMany({
				where: {
					type: ActivityType.TASK,
					completedAt: null,
					dueAt: { lt: now },
					createdById: actingUserId,
				},
				orderBy: [{ dueAt: "asc" }],
				take: 10,
				select: {
					id: true,
					subject: true,
					dueAt: true,
					company: { select: { id: true, name: true } },
					deal: { select: { id: true, name: true } },
				},
			}),
			this.db.activity.findMany({
				where: mine ? { createdById: actingUserId } : {},
				orderBy: [{ createdAt: "desc" }],
				take: 12,
				select: {
					id: true,
					type: true,
					subject: true,
					body: true,
					createdAt: true,
					meta: true,
					createdBy: { select: OWNER_SELECT },
					company: { select: { id: true, name: true } },
					deal: { select: { id: true, name: true } },
				},
			}),
			this.conversion.unconverted(owned),
		]);

		const stages = OPEN_DEAL_STAGES.map((stage) => {
			const group = openByStage.find((row) => row.stage === stage);
			const value = openValueByStage.find((row) => row.stage === stage);
			return {
				stage: stage as DealStage,
				count: group?._count._all ?? 0,
				valueCents: toCents(value?._sum.baseAmount ?? null) ?? 0,
			};
		});

		const firstBucket = monthKey(trendStart);
		const trend = Array.from({ length: TREND_MONTHS }, (_, index) => ({
			month: MONTH_LABEL.format(monthStart(trendStart, index)),
			won: 0,
			created: 0,
		}));

		const wonThisMonth = { count: 0, valueCents: 0 };
		const wonPrevMonth = { count: 0, valueCents: 0 };
		let wins = 0;
		let losses = 0;
		let valuedWins = 0;
		let wonCents = 0;
		let cycleDays = 0;

		for (const deal of recentDeals) {
			const valued =
				deal.baseCurrency === base ? toCents(deal.baseAmount) : null;
			const cents = valued ?? 0;

			const created = trend[monthKey(deal.createdAt) - firstBucket];
			if (created) created.created += cents;

			const { closedAt, stage } = deal;
			if (!closedAt) continue;
			const won = stage === DealStage.CLOSED_WON;

			if (won) {
				const closed = trend[monthKey(closedAt) - firstBucket];
				if (closed) closed.won += cents;

				if (closedAt >= startOfMonth && closedAt < startOfNextMonth) {
					wonThisMonth.count += 1;
					wonThisMonth.valueCents += cents;
				} else if (closedAt >= startOfPrevMonth && closedAt < startOfMonth) {
					wonPrevMonth.count += 1;
					wonPrevMonth.valueCents += cents;
				}
			}

			if (closedAt < rateStart) continue;
			if (won) {
				wins += 1;
				if (valued !== null) {
					valuedWins += 1;
					wonCents += cents;
				}
				cycleDays += (closedAt.getTime() - deal.createdAt.getTime()) / DAY_MS;
			} else if (stage === DealStage.CLOSED_LOST) {
				losses += 1;
			}
		}

		const decided = wins + losses;

		return {
			scope: input.scope,
			reportingCurrency: base,
			unconverted,
			pipeline: {
				stages,
				totalCents: stages.reduce((total, s) => total + s.valueCents, 0),
				totalDeals: stages.reduce((total, s) => total + s.count, 0),
			},
			wonThisMonth,
			wonPrevMonth,
			performance: {
				windowDays: RATE_WINDOW_DAYS,
				wins,
				losses,
				winRate: decided === 0 ? null : wins / decided,
				avgDealCents:
					valuedWins === 0 ? null : Math.round(wonCents / valuedWins),
				avgCycleDays: wins === 0 ? null : Math.round(cycleDays / wins),
			},
			trend,
			closingThisMonthTotal: {
				count: closingThisMonthTotals._count._all,
				valueCents: toCents(closingThisMonthTotals._sum.baseAmount) ?? 0,
			},
			biggestOpen: biggestOpen
				.map(
					({
						amount,
						baseAmount,
						baseCurrency,
						expectedCloseDate,
						stageChangedAt,
						...deal
					}) => ({
						...deal,
						amountCents: toCents(amount),
						baseAmountCents: baseCurrency === base ? toCents(baseAmount) : null,
						expectedCloseDate: expectedCloseDate?.toISOString() ?? null,
						stageChangedAt: stageChangedAt.toISOString(),
					}),
				)
				.sort((a, b) => (b.baseAmountCents ?? -1) - (a.baseAmountCents ?? -1)),
			overdueTasks: overdueTasks.map(({ dueAt, ...task }) => ({
				...task,
				dueAt: dueAt?.toISOString() ?? null,
			})),
			recentActivity: recentActivity.map(({ createdAt, meta, ...entry }) => ({
				...entry,
				createdAt: createdAt.toISOString(),
				meta: activityMeta.parse(meta),
			})),
		};
	}
}
