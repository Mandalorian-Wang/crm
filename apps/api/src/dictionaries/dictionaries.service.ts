import { workspaceRoleOf } from "@crm/auth/organization";
import type { Db } from "@crm/db";
import {
	type OrganizationDictionaryKey,
	type organizationDictionaryOptionInput,
	tagColor,
} from "@crm/validation/organization-type";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { InjectDatabase } from "../database/database.constants";

@Injectable()
export class DictionariesService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async organizationTypes(
		userId: string,
		key: OrganizationDictionaryKey = "organization_type",
	) {
		const [role, options] = await Promise.all([
			workspaceRoleOf(userId),
			this.db.fieldOption.findMany({
				where: { field: { entity: "COMPANY", key } },
				orderBy: [{ position: "asc" }, { id: "asc" }],
			}),
		]);
		return {
			canManage: role !== null,
			options: options.map((option) => ({
				id: option.id,
				label: option.label,
				color: tagColor.parse(option.color),
				archived: option.archivedAt !== null,
				position: option.position,
			})),
		};
	}

	async saveOrganizationType(
		userId: string,
		input: z.infer<typeof organizationDictionaryOptionInput>,
	) {
		if (!(await workspaceRoleOf(userId)))
			throw new ForbiddenException(
				"Only CRM team members can manage dictionaries.",
			);
		const key = input.key;
		await this.db.$transaction(async (tx) => {
			await tx.$queryRaw`SELECT id FROM "fieldDefinition" WHERE entity = 'COMPANY' AND key = ${key} FOR UPDATE`;
			const field = await tx.fieldDefinition.findUniqueOrThrow({
				where: {
					entity_key: { entity: "COMPANY", key },
				},
				include: { options: true },
			});
			if (input.id && !field.options.some((option) => option.id === input.id))
				throw new NotFoundException("That dictionary option does not exist.");
			if (
				field.options.some(
					(option) =>
						option.id !== input.id &&
						option.label.toLowerCase() === input.label.toLowerCase(),
				)
			)
				throw new ConflictException(
					"This dictionary already uses that name. Rename or restore the existing option.",
				);
			const data = {
				label: input.label,
				color: input.color,
				archivedAt: input.archived ? new Date() : null,
			};
			if (input.id)
				await tx.fieldOption.update({ where: { id: input.id }, data });
			else
				await tx.fieldOption.create({
					data: {
						...data,
						fieldId: field.id,
						position:
							Math.max(-1, ...field.options.map((option) => option.position)) +
							1,
					},
				});
		});
		return this.organizationTypes(userId, key);
	}
}
