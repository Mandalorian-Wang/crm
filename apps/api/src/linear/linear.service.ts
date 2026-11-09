import { createHash } from "node:crypto";
import type { Db } from "@crm/db";
import {
	BadGatewayException,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import {
	linearCustomer,
	linearCustomersOutput,
	linearIssue,
	linearNeedsOutput,
	linearRequestInput,
	linearRequestOutput,
} from "./linear.contracts";
import { customerReference, linearRequest } from "./linear-client";
import { LINEAR } from "./linear-config";
import { uploadRequestImages } from "./linear-upload";

@Injectable()
export class LinearService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async submitRequest(
		input: z.infer<typeof linearRequestInput>,
		user: { id: string; name: string; email: string },
	) {
		const projectId = process.env.LINEAR_CRM_PROJECT_ID;
		const teamId = process.env.LINEAR_CRM_TEAM_ID;
		const labelId = process.env.LINEAR_CRM_LABEL_ID;
		if (!projectId || !teamId || !labelId)
			throw new ServiceUnavailableException(
				"Request submission is not configured.",
			);
		const hex = createHash("sha256")
			.update(
				JSON.stringify([
					user.id,
					input.requestId,
					input.title,
					input.content,
					...(input.images?.length ? [input.images] : []),
				]),
			)
			.digest("hex");
		const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
		const lookup = async () => {
			const result = await linearRequest(
				`query Existing($id: ID!) { organization { urlKey } issues(filter:{id:{eq:$id}},first:1) { nodes { id identifier url } } }`,
				{ id },
				z.object({ issues: z.object({ nodes: z.array(linearRequestOutput) }) }),
			);
			return result.issues.nodes[0];
		};
		const existing = await lookup();
		if (existing) return existing;
		const attachments = await uploadRequestImages(input.images ?? []);
		try {
			const result = await linearRequest(
				`mutation CreateRequest($input: IssueCreateInput!) { issueCreate(input:$input) { success issue { id identifier url } } }`,
				{
					input: {
						id,
						title: input.title,
						description: `${input.content}${attachments ? `\n\n${attachments}` : ""}\n\n---\nSubmitted from BoxLite CRM by ${user.name} (${user.email}).`,
						projectId,
						teamId,
						labelIds: [labelId],
					},
				},
				z.object({
					issueCreate: z.object({
						success: z.boolean(),
						issue: linearRequestOutput.nullable(),
					}),
				}),
				true,
			);
			if (!result.issueCreate.success || !result.issueCreate.issue)
				throw new BadGatewayException(
					"Linear did not confirm request creation. Please retry.",
				);
			return result.issueCreate.issue;
		} catch (error) {
			const recovered = await lookup();
			if (recovered) return recovered;
			throw error;
		}
	}

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
