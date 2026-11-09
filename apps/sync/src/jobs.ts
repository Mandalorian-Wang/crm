import { db, Prisma } from "@crm/db";
import { syncBilling } from "./billing";
import { SYNC, scheduledDay } from "./config";
import { ensureFields, setField } from "./fields";
import { importCompany, importMember, importStar } from "./import";
import { syncOverview } from "./overview";
import { type Customer, customers, members, stargazers } from "./source";

export async function runSource(
	source: "cloud" | "github" | "billing" | "overview",
	force = false,
) {
	if (source === "github" && !SYNC.githubEnabled) return;
	return db.$transaction(
		async (lock) => {
			const acquired = await lock.$queryRaw<{ acquired: boolean }[]>(
				Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtext(${`boxlite-crm:${source}`})) AS acquired`,
			);
			if (!acquired[0]?.acquired) return;
			const day = scheduledDay(new Date());
			if (
				!force &&
				(await db.importRun.findFirst({
					where: { source, scheduledDay: day, status: "SUCCEEDED" },
				}))
			)
				return;
			const recent = await db.importRun.findFirst({
				where: {
					source,
					status: "FAILED",
					finishedAt: { gt: new Date(Date.now() - SYNC.retryDelayMs) },
				},
			});
			if (recent && !force) return;
			await db.importRun.updateMany({
				where: { source, status: "RUNNING" },
				data: {
					status: "INTERRUPTED",
					finishedAt: new Date(),
					error: "Previous process exited before completion; safe to retry.",
				},
			});
			const run = await db.importRun.create({
				data: { source, scheduledDay: day, status: "RUNNING" },
			});
			let processed = 0;
			try {
				const owner = await db.user.findUniqueOrThrow({
					where: { email: SYNC.ownerEmail },
				});
				await ensureFields();
				if (source === "overview") {
					processed = await syncOverview(owner.id);
				} else if (source === "cloud") {
					const pending: { customer: Customer; companyId: string }[] = [];
					for await (const customer of customers()) {
						const companyId = await importCompany(customer, owner.id);
						if (companyId) pending.push({ customer, companyId });
					}
					let failed = 0;
					for (const { customer, companyId } of pending) {
						const checkpoint = {
							source: "cloud",
							externalId: `${day}:${customer.organizationId}`,
							kind: "members-day",
						};
						if (
							!force &&
							(await db.importedRecord.findUnique({
								where: { source_externalId_kind: checkpoint },
							}))
						)
							continue;
						try {
							for await (const member of members(customer.organizationId)) {
								await importMember(customer, member, companyId, owner.id);
								processed++;
							}
							await db.$transaction(async (tx) => {
								await setField(
									tx,
									"COMPANY",
									companyId,
									"cloud_members_sync_status",
									{ text: `Synced ${day}` },
								);
								await tx.importedRecord.upsert({
									where: { source_externalId_kind: checkpoint },
									create: { ...checkpoint, recordId: companyId },
									update: {},
								});
							});
						} catch (error) {
							if (
								error instanceof Error &&
								/HTTP (401|403)/.test(error.message)
							)
								throw error;
							failed++;
							await setField(
								db,
								"COMPANY",
								companyId,
								"cloud_members_sync_status",
								{ text: `Incomplete ${day}; retry scheduled` },
							);
						}
						await db.importRun.update({
							where: { id: run.id },
							data: { processed },
						});
					}
					await db.importedRecord.deleteMany({
						where: {
							source: "cloud",
							kind: "members-day",
							createdAt: { lt: new Date(Date.now() - 7 * 86400000) },
						},
					});
					if (failed)
						throw new Error(
							`Member sync incomplete for ${failed} organizations; retry scheduled.`,
						);
				} else if (source === "billing") {
					processed = await syncBilling();
				} else {
					for await (const star of stargazers()) {
						await importStar(star, SYNC.githubRepository, owner.id);
						processed++;
						if (processed % 100 === 0)
							await db.importRun.update({
								where: { id: run.id },
								data: { processed },
							});
					}
				}
				await db.importRun.update({
					where: { id: run.id },
					data: { status: "SUCCEEDED", processed, finishedAt: new Date() },
				});
				console.info(
					JSON.stringify({ source, status: "SUCCEEDED", processed, day }),
				);
			} catch (error) {
				const message =
					error instanceof Error &&
					/HTTP \d{3}|is required|pagination|cursor|Member sync incomplete|Overview sync incomplete/.test(
						error.message,
					)
						? error.message
						: "Import failed; check source availability, schema and database connectivity.";
				await db.importRun.update({
					where: { id: run.id },
					data: {
						status: "FAILED",
						processed,
						error: message,
						finishedAt: new Date(),
					},
				});
				console.error(
					JSON.stringify({
						source,
						status: "FAILED",
						processed,
						error: message,
					}),
				);
				throw new Error(message);
			}
		},
		{ timeout: 6 * 60 * 60_000, maxWait: 5000 },
	);
}
