import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { LinearRouter } from "./linear.router";
import { LinearService } from "./linear.service";

@Module({ imports: [TrpcModule], providers: [LinearRouter, LinearService] })
export class LinearModule {}
