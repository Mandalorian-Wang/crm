import { isDeepStrictEqual } from "node:util";
import type { Db } from "@crm/db";
import { requestImage } from "@crm/validation/crm-request";
import { type NoteMention, noteMentions } from "@crm/validation/daily-note";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { z as schema } from "zod";
import { InjectDatabase } from "../database/database.constants";
import type {
	dailyNoteCreateInput,
	dailyNoteUpdateInput,
} from "./daily-notes.contracts";

export function noteDay(date: Date) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

@Injectable()
export class DailyNotesService {
	constructor(@InjectDatabase() private readonly db: Db) {}
	async list(companyId: string, limit?: number) {
		const notes = await this.db.organizationDailyNote.findMany({
			where: { companyId },
			take: limit,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			include: { updatedBy: { select: { name: true } } },
		});
		const today = noteDay(new Date());
		return notes.map((note) => ({
			id: note.id,
			body: note.body,
			images: schema.array(requestImage).parse(note.images),
			mentions: noteMentions.parse(note.mentions),
			createdAt: note.createdAt.toISOString(),
			updatedAt: note.updatedAt.toISOString(),
			updatedBy: note.updatedBy.name,
			version: note.version,
			editable: noteDay(note.createdAt) === today,
		}));
	}
	private async validateMentions(mentions: NoteMention[]) {
		if (!mentions.length) return;
		const members = await this.db.user.findMany({
			where: { id: { in: mentions.map((mention) => mention.id) } },
			select: { id: true, name: true },
		});
		if (
			mentions.some(
				(mention) =>
					!members.some(
						(member) =>
							member.id === mention.id && member.name === mention.name,
					),
			)
		)
			throw new BadRequestException(
				"A mentioned team member is no longer available. Select the member again.",
			);
	}
	async create(input: z.infer<typeof dailyNoteCreateInput>, userId: string) {
		await this.validateMentions(input.mentions);
		const company = await this.db.company.findFirst({
			where: { id: input.companyId, archivedAt: null },
			select: { id: true },
		});
		if (!company)
			throw new NotFoundException("Organization is missing or archived.");
		const id = `${userId}:${input.companyId}:${input.requestId}`;
		await this.db.organizationDailyNote.createMany({
			data: [
				{
					id,
					companyId: input.companyId,
					body: input.body,
					images: input.images ?? [],
					mentions: input.mentions,
					updatedById: userId,
				},
			],
			skipDuplicates: true,
		});
		const persisted = await this.db.organizationDailyNote.findUniqueOrThrow({
			where: { id },
		});
		assertDailyNoteReplay(persisted, input);
		return this.list(input.companyId);
	}
	async update(input: z.infer<typeof dailyNoteUpdateInput>, userId: string) {
		await this.validateMentions(input.mentions);
		const count = await this.db.$executeRaw`
   UPDATE "organizationDailyNote" AS note SET "body"=${input.body}, "images"=COALESCE(${input.images === undefined ? null : JSON.stringify(input.images)}::jsonb, note."images"), "mentions"=${JSON.stringify(input.mentions)}::jsonb, "updatedById"=${userId}, "updatedAt"=clock_timestamp() AT TIME ZONE 'UTC', "version"="version"+1
   WHERE note."id"=${input.id} AND note."companyId"=${input.companyId} AND note."version"=${input.version}
   AND (note."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date = (clock_timestamp() AT TIME ZONE 'Asia/Shanghai')::date
   AND EXISTS (SELECT 1 FROM "company" WHERE "id"=note."companyId" AND "archivedAt" IS NULL)
  `;
		if (!count)
			throw new ConflictException(
				"This note is frozen, changed by another user, or unavailable. Refresh before editing.",
			);
		return this.list(input.companyId);
	}
}

export function assertDailyNoteReplay(
	stored: { body: string; mentions: unknown; images: unknown },
	input: z.infer<typeof dailyNoteCreateInput>,
) {
	if (
		stored.body !== input.body ||
		!isDeepStrictEqual(stored.mentions, input.mentions) ||
		!isDeepStrictEqual(stored.images, input.images ?? [])
	)
		throw new ConflictException(
			"This requestId already records a different daily note. Read dailyNotes before retrying; use a new requestId for a new note.",
		);
}
