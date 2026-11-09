import type { Db } from "@crm/db";
import {
	BadGatewayException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import {
	linearCustomer,
	linearCustomersOutput,
	linearIssue,
	linearNeedsOutput,
} from "./linear.contracts";
import { customerReference, linearRequest } from "./linear-client";
import { LINEAR } from "./linear-config";

@Injectable()
export class LinearService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	private async company(companyId: string) {
		const company = await this.db.company.findUnique({
			where: { id: companyId },
			select: { id: true },
		});
		if (!company)
			throw new NotFoundException("This organization does not exist.");
	}

	async binding(companyId: string) {
		await this.company(companyId);
		const rows = await this.db.fieldValue.findMany({
			where: {
				companyId,
				field: { key: { in: Object.values(LINEAR.fields) } },
			},
			include: { field: { select: { key: true } } },
		});
		const value = (key: string) =>
			rows.find((row) => row.field.key === key)?.text ?? null;
		const id = value(LINEAR.fields.id);
		return {
			configured: Boolean(
				process.env.LINEAR_API_KEY && process.env.LINEAR_WORKSPACE_SLUG,
			),
			customer: id
				? {
						id,
						name: value(LINEAR.fields.name) ?? id,
						url: value(LINEAR.fields.url) ?? "https://linear.app",
					}
				: null,
		};
	}

	async customers(input: { q: string; cursor?: string | null }) {
		const data = await linearRequest(
			`query Customers($filter: CustomerFilter, $after: String, $first: Int!) { organization { urlKey } customers(filter: $filter, after: $after, first: $first) { nodes { id name url } pageInfo { hasNextPage endCursor } } }`,
			{
				filter: input.q ? { name: { containsIgnoreCase: input.q } } : {},
				after: input.cursor,
				first: LINEAR.pageSize,
			},
			z.object({ customers: linearCustomersOutput }),
		);
		return data.customers;
	}

	async bind(companyId: string, reference: string | null) {
		await this.company(companyId);
		const customer = reference
			? (
					await linearRequest(
						`query Customer($id: String!) { organization { urlKey } customer(id: $id) { id name url } }`,
						{
							id: customerReference(
								reference,
								process.env.LINEAR_WORKSPACE_SLUG ?? "",
							),
						},
						z.object({ customer: linearCustomer }),
					)
				).customer
			: null;
		await this.db.$transaction(async (tx) => {
			for (const [key, label, value] of [
				[LINEAR.fields.id, "Linear customer ID", customer?.id],
				[LINEAR.fields.name, "Linear customer", customer?.name],
				[LINEAR.fields.url, "Linear", customer?.url],
			] as const) {
				const field = await tx.fieldDefinition.upsert({
					where: { entity_key: { entity: "COMPANY", key } },
					create: {
						entity: "COMPANY",
						key,
						label,
						type: key === LINEAR.fields.url ? "URL" : "TEXT",
						agentFilled: false,
						position: 100,
						showOnSheet: key !== LINEAR.fields.id,
						showOnTable: key === LINEAR.fields.url,
					},
					update: {},
				});
				if (!value) {
					await tx.fieldValue.deleteMany({
						where: { fieldId: field.id, companyId },
					});
					continue;
				}
				await tx.fieldValue.upsert({
					where: { fieldId_companyId: { fieldId: field.id, companyId } },
					create: { fieldId: field.id, companyId, text: value },
					update: { text: value },
				});
			}
		});
		return this.binding(companyId);
	}

	async issues(companyId: string) {
		const { customer } = await this.binding(companyId);
		if (!customer) return { issues: [], fetchedAt: new Date().toISOString() };
		const issues = new Map<string, z.infer<typeof linearIssue>>();
		let after: string | null = null;
		const seen = new Set<string>();
		for (let page = 0; page < LINEAR.maxPages; page++) {
			const data: z.infer<typeof linearNeedsOutput> = await linearRequest(
				`query CustomerIssues($id: ID!, $after: String, $first: Int!) { organization { urlKey } customerNeeds(filter: {customer: {id: {eq: $id}}}, first: $first, after: $after) { nodes { issue { id identifier title url priorityLabel state { name } assignee { name } updatedAt } } pageInfo { hasNextPage endCursor } } }`,
				{ id: customer.id, after, first: LINEAR.pageSize },
				linearNeedsOutput,
			);
			for (const row of data.customerNeeds.nodes)
				if (row.issue) issues.set(row.issue.id, row.issue);
			const info = data.customerNeeds.pageInfo;
			if (!info.hasNextPage)
				return {
					issues: [...issues.values()].sort((a, b) =>
						b.updatedAt.localeCompare(a.updatedAt),
					),
					fetchedAt: new Date().toISOString(),
				};
			if (!info.endCursor || seen.has(info.endCursor))
				throw new BadGatewayException(
					"Linear returned an invalid pagination cursor.",
				);
			after = info.endCursor;
			seen.add(after);
		}
		throw new BadGatewayException(
			"This customer's requests exceed the current fetch limit.",
		);
	}
}
