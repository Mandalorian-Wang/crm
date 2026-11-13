import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { DictionariesRouter } from "../dictionaries/dictionaries.router";
import { DictionariesService } from "../dictionaries/dictionaries.service";
import { TrpcModule } from "../trpc/trpc.module";
import { FieldsRouter } from "./fields.router";
import { FieldsService } from "./fields.service";

@Module({
	imports: [TrpcModule, AgentModule],
	providers: [
		FieldsService,
		FieldsRouter,
		DictionariesRouter,
		DictionariesService,
	],
	exports: [FieldsService],
})
export class FieldsModule {}
