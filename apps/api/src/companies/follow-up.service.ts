import type { Db } from "@crm/db";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import { companyMemberIds } from "./company-members";
import {
	type contactLogInput,
	type followUpData,
	followUpStatus,
} from "./follow-up.contracts";

@Injectable()
export class FollowUpService {
	constructor(@InjectDatabase() private readonly db: Db) {}
	async read(companyId: string) {
		const company = await this.db.company.findUnique({
			where: { id: companyId },
			select: { followUpStatus: true, nextFollowUpAt: true },
		});
		if (!company) throw new NotFoundException("Organization not found.");
		const logs = await this.db.organizationContactLog.findMany({
			where: { companyId },
			orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
			take: 50,
			include: { createdBy: { select: { name: true } } },
		});
		const contacts = await this.db.contact.findMany({
			where: {
				id: {
					in: logs.flatMap((log) => (log.contactId ? [log.contactId] : [])),
				},
			},
			select: { id: true, firstName: true, lastName: true },
		});
		const names = new Map(
			contacts.map((contact) => [
				contact.id,
				[contact.firstName, contact.lastName].filter(Boolean).join(" "),
			]),
		);
		return {
			status: followUpStatus.parse(company.followUpStatus),
			nextFollowUp: company.nextFollowUpAt?.toISOString().slice(0, 10) ?? null,
			lastContacted: logs[0]?.occurredAt.toISOString() ?? null,
			logs: logs.map((log) => ({
				id: log.id,
				channel: log.channel,
				body: log.body,
				occurredAt: log.occurredAt.toISOString(),
				author: log.createdBy.name,
				contact: log.contactId
					? (names.get(log.contactId) ?? "Removed inbound user")
					: null,
			})),
		};
	}
	async update(companyId: string, data: z.infer<typeof followUpData>) {
		const result = await this.db.company.updateMany({
			where: { id: companyId, archivedAt: null },
			data: {
				followUpStatus: data.status,
				nextFollowUpAt:
					data.nextFollowUp === undefined
						? undefined
						: data.nextFollowUp === null
							? null
							: new Date(`${data.nextFollowUp}T00:00:00Z`),
			},
		});
		if (!result.count)
			throw new NotFoundException("Organization is missing or archived.");
		return this.read(companyId);
	}
	async log(input: z.infer<typeof contactLogInput>, userId: string) {
		if (new Date(input.occurredAt).getTime() > Date.now())
			throw new BadRequestException("Contact time cannot be in the future.");
		if (
			input.contactId &&
			!(await companyMemberIds(this.db, [input.companyId]))
				.get(input.companyId)
				?.has(input.contactId)
		)
			throw new BadRequestException(
				"Choose an inbound user linked to this organization.",
			);
		const id = `${userId}:${input.requestId}`;
		await this.db.$transaction(async (tx) => {
			const company = await tx.company.findFirst({
				where: { id: input.companyId, archivedAt: null },
				select: { id: true },
			});
			if (!company)
				throw new NotFoundException("Organization is missing or archived.");
			const existing = await tx.organizationContactLog.findUnique({
				where: { id },
			});
			if (existing) {
				if (existing.companyId !== input.companyId)
					throw new BadRequestException("This request was already used.");
				return;
			}
			await tx.organizationContactLog.createMany({
				skipDuplicates: true,
				data: {
					id,
					companyId: input.companyId,
					createdById: userId,
					contactId: input.contactId,
					channel: input.channel,
					body: input.body,
					occurredAt: new Date(input.occurredAt),
				},
			});
			await tx.company.updateMany({
				where: { id: input.companyId, followUpStatus: "NOT_CONTACTED" },
				data: { followUpStatus: "CONTACTED" },
			});
		});
		return this.read(input.companyId);
	}
	async bulk(ids: string[], data: z.infer<typeof followUpData>) {
		let succeeded = 0;
		const failed: { id: string; message: string }[] = [];
		for (const id of new Set(ids))
			try {
				await this.update(id, data);
				succeeded++;
			} catch (error) {
				failed.push({
					id,
					message: error instanceof Error ? error.message : "Update failed.",
				});
			}
		return { succeeded, failed };
	}
	async syncStatus() {
		return Promise.all(
			["cloud", "billing"].map(async (source) => {
				const [latest, success] = await Promise.all([
					this.db.importRun.findFirst({
						where: { source },
						orderBy: { startedAt: "desc" },
					}),
					this.db.importRun.findFirst({
						where: { source, status: "SUCCEEDED" },
						orderBy: { finishedAt: "desc" },
					}),
				]);
				return {
					source,
					status: latest?.status ?? "NOT_SYNCED",
					lastAttempt: latest?.startedAt.toISOString() ?? null,
					lastSuccess: success?.finishedAt?.toISOString() ?? null,
				};
			}),
		);
	}
}
