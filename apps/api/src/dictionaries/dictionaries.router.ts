import {
	organizationTypeInput,
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
import { DictionariesService } from "./dictionaries.service";

@Router({ alias: "dictionaries" })
@UseMiddlewares(AuthMiddleware)
export class DictionariesRouter {
	constructor(
		@Inject(DictionariesService)
		private readonly dictionaries: DictionariesService,
	) {}
	@Query({ output: organizationTypesOutput })
	async organizationTypes(@Ctx() ctx: AuthedTrpcContext) {
		return this.dictionaries.organizationTypes(ctx.user.id);
	}
	@Mutation({ input: organizationTypeInput, output: organizationTypesOutput })
	async saveOrganizationType(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof organizationTypeInput>,
	) {
		return this.dictionaries.saveOrganizationType(ctx.user.id, input);
	}
}
