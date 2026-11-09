import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

export interface UserOption {
	id: string;
	name: string;
	email: string;
	image: string | null;
}

@Injectable()
export class UsersService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async tablePreference(userId: string, table: string) {
		const preference = await this.db.userTablePreference.findUnique({
			where: { userId_table: { userId, table } },
		});
		return {
			hiddenColumns: preference?.hiddenColumns ?? null,
			columnOrder: preference?.columnOrder ?? [],
		};
	}
	async saveTablePreference(
		userId: string,
		table: string,
		hiddenColumns: string[],
		columnOrder?: string[],
	) {
		const unique = [...new Set(hiddenColumns)];
		const result = await this.db.userTablePreference.upsert({
			where: { userId_table: { userId, table } },
			create: { userId, table, hiddenColumns: unique, columnOrder },
			update: { hiddenColumns: unique, columnOrder },
		});
		return {
			hiddenColumns: result.hiddenColumns,
			columnOrder: result.columnOrder,
		};
	}
	async setCompanyFavorite(
		userId: string,
		companyId: string,
		favorite: boolean,
	) {
		await this.db.company.findUniqueOrThrow({
			where: { id: companyId },
			select: { id: true },
		});
		if (favorite)
			await this.db.companyFavorite.upsert({
				where: { userId_companyId: { userId, companyId } },
				create: { userId, companyId },
				update: {},
			});
		else
			await this.db.companyFavorite.deleteMany({
				where: { userId, companyId },
			});
		return { favorite };
	}
	async list(): Promise<UserOption[]> {
		return this.db.user.findMany({
			select: { id: true, name: true, email: true, image: true },
			orderBy: [{ name: "asc" }, { email: "asc" }],
		});
	}
}
