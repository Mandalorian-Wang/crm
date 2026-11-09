import { db } from "@crm/db";
import { z } from "zod";
import { SYNC } from "./config";
import { setField } from "./fields";
import { backofficeHeaders, request } from "./source";

const billingPage = z.object({
	coverage: z.object({
		status: z.literal("unknown"),
		reason: z.literal("usage_settlement_may_be_delayed"),
	}),
	items: z.array(
		z.object({
			organizationId: z.string(),
			currency: z.string().regex(/^[A-Z]{3}$/i),
			settledUsageMinor: z.string().regex(/^\d+$/),
			ordinaryWalletFundedMinor: z.string().regex(/^\d+$/),
			quotaCoveredMinor: z.string().regex(/^\d+$/),
			invoiceCount: z.number().int().nonnegative(),
		}),
	),
	nextCursor: z.string().nullable(),
});

export function moneyFromMinor(currency: string, value: bigint): string {
	const digits =
		new Intl.NumberFormat("en", {
			style: "currency",
			currency,
		}).resolvedOptions().maximumFractionDigits ?? 2;
	const scale = 10n ** BigInt(digits);
	return `${currency.toUpperCase()} ${value / scale}${digits ? `.${String(value % scale).padStart(digits, "0")}` : ""}`;
}

export async function syncBilling(): Promise<number> {
	const to = new Date();
	const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
	const totals = new Map<string, Map<string, bigint>>();
	let cursor: string | null = null;
	const cursors = new Set<string>();
	let complete = false;
	for (let page = 0; page < SYNC.maxPages; page++) {
		const url = new URL("/v1/billing/usage", SYNC.backofficeOrigin);
		url.searchParams.set("from", from.toISOString());
		url.searchParams.set("to", to.toISOString());
		url.searchParams.set("granularity", "window");
		url.searchParams.set("limit", "200");
		if (cursor) url.searchParams.set("cursor", cursor);
		const result = billingPage.parse(
			await (await request(url, backofficeHeaders())).json(),
		);
		for (const row of result.items) {
			const currencies =
				totals.get(row.organizationId) ?? new Map<string, bigint>();
			const currency = row.currency.toUpperCase();
			currencies.set(
				currency,
				(currencies.get(currency) ?? 0n) + BigInt(row.settledUsageMinor),
			);
			totals.set(row.organizationId, currencies);
		}
		cursor = result.nextCursor;
		if (!cursor) {
			complete = true;
			break;
		}
		if (cursors.has(cursor)) throw new Error("Billing repeated a cursor.");
		cursors.add(cursor);
	}
	if (!complete) throw new Error("Billing pagination exceeded the page limit.");
	const companies = await db.importedRecord.findMany({
		where: { source: "cloud", kind: "company" },
	});
	let processed = 0;
	for (const ref of companies) {
		const company = await db.company.findUnique({
			where: { id: ref.recordId },
			select: { archivedAt: true },
		});
		if (!company || company.archivedAt) continue;
		const amounts = totals.get(ref.externalId);
		await db.$transaction(async (tx) => {
			await setField(tx, "COMPANY", ref.recordId, "cloud_settled_usage_mtd", {
				text: amounts
					? [...amounts]
							.map(([currency, amount]) => moneyFromMinor(currency, amount))
							.join("; ")
					: "No settled usage reported",
			});
			await setField(tx, "COMPANY", ref.recordId, "cloud_billing_window", {
				text: `${from.toISOString()} → ${to.toISOString()}`,
			});
			await setField(tx, "COMPANY", ref.recordId, "cloud_billing_synced_at", {
				date: new Date(),
			});
		});
		processed++;
	}
	return processed;
}
