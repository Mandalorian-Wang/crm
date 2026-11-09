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
import {
	linearBindingInput,
	linearBindingOutput,
	linearCompanyInput,
	linearCustomerIssueInput,
	linearCustomersInput,
	linearCustomersOutput,
	linearIssuesOutput,
	linearLinkIssueInput,
	linearProjectsOutput,
	linearRequestInput,
	linearRequestOutput,
} from "./linear.contracts";
import { LinearService } from "./linear.service";

@Router({ alias: "linear" })
@UseMiddlewares(AuthMiddleware)
export class LinearRouter {
	constructor(@Inject(LinearService) private readonly linear: LinearService) {}
	@Query({ output: linearProjectsOutput })
	projects() {
		return this.linear.projects();
	}
	@Mutation({ input: linearLinkIssueInput, output: linearRequestOutput })
	linkIssue(@Input() input: z.infer<typeof linearLinkIssueInput>) {
		return this.linear.linkIssue(input.companyId, input.reference);
	}
	@Mutation({ input: linearCustomerIssueInput, output: linearRequestOutput })
	createCustomerIssue(
		@Input() input: z.infer<typeof linearCustomerIssueInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.linear.createCustomerIssue(input, ctx.user);
	}

	@Mutation({ input: linearRequestInput, output: linearRequestOutput })
	submitRequest(
		@Input() input: z.infer<typeof linearRequestInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.linear.submitRequest(input, ctx.user);
	}

	@Query({ input: linearCompanyInput, output: linearBindingOutput })
	binding(@Input("companyId") companyId: string) {
		return this.linear.binding(companyId);
	}
	@Query({ input: linearCustomersInput, output: linearCustomersOutput })
	customers(@Input() input: z.infer<typeof linearCustomersInput>) {
		return this.linear.customers(input);
	}
	@Query({ input: linearCompanyInput, output: linearIssuesOutput })
	issues(@Input("companyId") companyId: string) {
		return this.linear.issues(companyId);
	}
	@Mutation({ input: linearBindingInput, output: linearBindingOutput })
	bind(@Input() input: z.infer<typeof linearBindingInput>) {
		return this.linear.bind(input.companyId, input.reference);
	}
}
