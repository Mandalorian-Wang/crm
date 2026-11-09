import { Inject } from "@nestjs/common";
import { Ctx, Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	cloudDashboardInput,
	cloudDashboardOutput,
	dashboardSummaryInput,
	dashboardSummaryOutput,
} from "./dashboard.contracts";
import { DashboardService } from "./dashboard.service";

@Router({ alias: "dashboard" })
@UseMiddlewares(AuthMiddleware)
export class DashboardRouter {
	constructor(
		@Inject(DashboardService) private readonly dashboard: DashboardService,
	) {}

	@Query({ input: cloudDashboardInput, output: cloudDashboardOutput })
	async cloudOverview(@Input() input: z.infer<typeof cloudDashboardInput>) {
		return this.dashboard.cloudOverview(input.page, new Date(), input.days);
	}

	@Query({
		input: dashboardSummaryInput,
		output: dashboardSummaryOutput,
		meta: restMeta("GET", "/dashboard/summary", ["Dashboard"]),
	})
	async summary(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof dashboardSummaryInput>,
	) {
		return this.dashboard.summary(ctx.user.id, input);
	}
}
