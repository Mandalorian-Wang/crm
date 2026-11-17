import {
	organizationDictionaryInput,
	organizationDictionaryOptionInput,
	organizationTypesOutput,
} from "@crm/validation/organization-type";
import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { DictionariesService } from "./dictionaries.service";

@Router({ alias: "dictionaries" })
@UseMiddlewares(AuthMiddleware)
export class DictionariesRouter {
	constructor(
		@Inject(DictionariesService)
		private readonly dictionaries: DictionariesService,
	) {}
	@Query({
		input: organizationDictionaryInput,
		output: organizationTypesOutput,
		meta: restMeta("GET", "/dictionaries/organization-types", ["Dictionaries"]),
	})
	async organizationTypes(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof organizationDictionaryInput>,
	) {
		return this.dictionaries.organizationTypes(ctx.user.id, input.key);
	}
	@Mutation({
		input: organizationDictionaryOptionInput,
		output: organizationTypesOutput,
		meta: restMeta("POST", "/dictionaries/organization-types", [
			"Dictionaries",
		]),
	})
	async saveOrganizationType(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof organizationDictionaryOptionInput>,
	) {
		return this.dictionaries.saveOrganizationType(ctx.user.id, input);
	}
}
