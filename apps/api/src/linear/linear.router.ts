import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import {
	linearBindingInput,
	linearBindingOutput,
	linearCompanyInput,
	linearCustomersInput,
	linearCustomersOutput,
	linearIssuesOutput,
} from "./linear.contracts";
import { LinearService } from "./linear.service";

@Router({ alias: "linear" })
@UseMiddlewares(AuthMiddleware)
export class LinearRouter {
	constructor(@Inject(LinearService) private readonly linear: LinearService) {}
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
