import { Module } from "@nestjs/common";
import { ActivitiesModule } from "../activities/activities.module";
import { AgentModule } from "../agent/agent.module";
import { CurrencyModule } from "../currency/currency.module";
import { FieldsModule } from "../fields/fields.module";
import { TrpcModule } from "../trpc/trpc.module";
import { CompaniesRouter } from "./companies.router";
import { CompaniesService } from "./companies.service";
import { CompanyDirectoryService } from "./company-directory.service";
import { CustomerContextService } from "./customer-context.service";
import { DailyNotesService } from "./daily-notes.service";
import { FaviconService } from "./favicon.service";
import { FollowUpService } from "./follow-up.service";

@Module({
	imports: [
		ActivitiesModule,
		FieldsModule,
		TrpcModule,
		AgentModule,
		CurrencyModule,
	],
	providers: [
		CustomerContextService,
		DailyNotesService,
		FollowUpService,
		CompaniesService,
		CompanyDirectoryService,
		CompaniesRouter,
		FaviconService,
	],
	exports: [CompaniesService, CompanyDirectoryService, FaviconService],
})
export class CompaniesModule {}
