import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { UsersService } from "./users.service";

const usersListOutput = z.array(
	z.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		image: z.string().nullable(),
	}),
);

const tablePreferenceInput = z.object({
	table: z.enum(["companies", "contacts"]),
});
const tablePreferenceOutput = z.object({
	hiddenColumns: z.array(z.string()).nullable(),
	columnOrder: z.array(z.string()),
});
const saveTablePreferenceInput = tablePreferenceInput.extend({
	hiddenColumns: z.array(z.string().max(200)).max(300),
	columnOrder: z.array(z.string().max(200)).max(300).optional(),
});
const favoriteInput = z.object({
	companyId: z.string(),
	favorite: z.boolean(),
});

@Router({ alias: "users" })
@UseMiddlewares(AuthMiddleware)
export class UsersRouter {
	constructor(
		@Inject(UsersService) private readonly users: UsersService,
		@Inject(AuthService) private readonly auth: AuthService,
	) {}

	@Query({ input: tablePreferenceInput, output: tablePreferenceOutput })
	async tablePreference(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof tablePreferenceInput>,
	) {
		return this.users.tablePreference(ctx.user.id, input.table);
	}
	@Mutation({ input: saveTablePreferenceInput, output: tablePreferenceOutput })
	async saveTablePreference(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof saveTablePreferenceInput>,
	) {
		return this.users.saveTablePreference(
			ctx.user.id,
			input.table,
			input.hiddenColumns,
			input.columnOrder,
		);
	}
	@Mutation({
		input: favoriteInput,
		output: z.object({ favorite: z.boolean() }),
	})
	async setCompanyFavorite(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof favoriteInput>,
	) {
		return this.users.setCompanyFavorite(
			ctx.user.id,
			input.companyId,
			input.favorite,
		);
	}

	@Query()
	async me(@Ctx() ctx: AuthedTrpcContext) {
		return this.auth.getProfile(ctx.user.id);
	}

	@Query({
		output: usersListOutput,
		meta: restMeta("GET", "/users", ["Users"]),
	})
	async list() {
		return this.users.list();
	}
}
