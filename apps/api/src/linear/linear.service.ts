import { createHash } from "node:crypto";
import type { Db } from "@crm/db";
import {
	BadGatewayException,
	BadRequestException,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import {
	linearCustomer,
	linearCustomerIssueInput,
	linearCustomersOutput,
	linearIssue,
	linearNeedsOutput,
	linearProject,
	linearProjectsPage,
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
		destination?: { projectId: string; teamId: string },
	) {
		const projectId =
			destination?.projectId ?? process.env.LINEAR_CRM_PROJECT_ID;
		const teamId = destination?.teamId ?? process.env.LINEAR_CRM_TEAM_ID;
		const labelId = process.env.LINEAR_CRM_LABEL_ID;
		if (!projectId || !teamId || (!destination && !labelId))
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
					...(destination ? [destination.projectId, destination.teamId] : []),
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
						labelIds: !destination && labelId ? [labelId] : [],
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

	async projects() {
		const projects: z.infer<typeof linearProject>[] = [];
		let after: string | null = null;
		for (let page = 0; page < LINEAR.maxPages; page++) {
			const result: z.infer<typeof linearProjectsPage> = await linearRequest(
				`query($after:String,$first:Int!){organization{urlKey} projects(first:$first,after:$after){nodes{id name url teams{nodes{id name}}} pageInfo{hasNextPage endCursor}}}`,
				{ after, first: LINEAR.pageSize },
				z.object({
					projects: z.object({
						nodes: z.array(linearProject),
						pageInfo: z.object({
							hasNextPage: z.boolean(),
							endCursor: z.string().nullable(),
						}),
					}),
				}),
			);
			projects.push(...result.projects.nodes);
			if (!result.projects.pageInfo.hasNextPage) return projects;
			if (
				!result.projects.pageInfo.endCursor ||
				result.projects.pageInfo.endCursor === after
			)
				throw new BadGatewayException(
					"Linear returned an invalid project cursor.",
				);
			after = result.projects.pageInfo.endCursor;
		}
		throw new BadGatewayException("Too many Linear projects to load.");
	}
	private issueReference(reference: string) {
		if (
			/^[A-Z][A-Z0-9]*-\d+$/i.test(reference) ||
			/^[0-9a-f-]{36}$/i.test(reference)
		)
			return reference;
		let url: URL;
		try {
			url = new URL(reference);
		} catch {
			throw new BadRequestException("Enter a Linear issue URL or identifier.");
		}
		const parts = url.pathname.split("/").filter(Boolean);
		if (
			url.protocol !== "https:" ||
			url.hostname !== "linear.app" ||
			parts[0] !== process.env.LINEAR_WORKSPACE_SLUG ||
			parts[1] !== "issue" ||
			!parts[2]
		)
			throw new BadRequestException(
				"Choose an issue from the configured Linear workspace.",
			);
		return parts[2];
	}
	async linkIssue(companyId: string, reference: string) {
		const { customer } = await this.binding(companyId);
		if (!customer)
			throw new BadRequestException("Link a Linear customer first.");
		const { issue } = await linearRequest(
			`query($id:String!){organization{urlKey} issue(id:$id){id identifier url}}`,
			{ id: this.issueReference(reference) },
			z.object({ issue: linearRequestOutput }),
		);
		const id = this.deterministicId(
			`customer-request:${customer.id}:${issue.id}`,
		);
		const lookup = async () => {
			const data = await linearRequest(
				`query($customerId:ID!,$issueId:ID!){organization{urlKey} customerNeeds(filter:{customer:{id:{eq:$customerId}},issue:{id:{eq:$issueId}}},first:1){nodes{id}}}`,
				{ customerId: customer.id, issueId: issue.id },
				z.object({
					customerNeeds: z.object({
						nodes: z.array(z.object({ id: z.string() })),
					}),
				}),
			);
			return data.customerNeeds.nodes.length > 0;
		};
		if (await lookup()) return issue;
		try {
			const result = await linearRequest(
				`mutation($needInput:CustomerNeedCreateInput!){customerNeedCreate(input:$needInput){success}}`,
				{
					needInput: {
						id,
						customerId: customer.id,
						issueId: issue.id,
						body: "Linked from BoxLite CRM.",
					},
				},
				z.object({ customerNeedCreate: z.object({ success: z.boolean() }) }),
				true,
			);
			if (!result.customerNeedCreate.success)
				throw new BadGatewayException(
					"Linear did not confirm the customer link. Please retry.",
				);
		} catch (error) {
			if (!(await lookup())) throw error;
		}
		return issue;
	}
	private deterministicId(value: string) {
		const hex = createHash("sha256").update(value).digest("hex");
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
	}
	async createCustomerIssue(
		input: z.infer<typeof linearCustomerIssueInput>,
		user: { id: string; name: string; email: string },
	) {
		const { customer } = await this.binding(input.companyId);
		if (!customer)
			throw new BadRequestException("Link a Linear customer first.");
		const project = await linearRequest(
			`query($id:String!){organization{urlKey} project(id:$id){teams{nodes{id}}}}`,
			{ id: input.projectId },
			z.object({
				project: z.object({
					teams: z.object({ nodes: z.array(z.object({ id: z.string() })) }),
				}),
			}),
		);
		if (!project.project.teams.nodes.some((team) => team.id === input.teamId))
			throw new BadRequestException("Choose a team assigned to this project.");
		const company = await this.db.company.findUniqueOrThrow({
			where: { id: input.companyId },
			select: { name: true },
		});
		const external = await this.db.fieldValue.findFirst({
			where: {
				companyId: input.companyId,
				field: { key: "cloud_organization_id", entity: "COMPANY" },
			},
			select: { text: true },
		});
		const base = (process.env.APP_URL ?? "").split(",")[0];
		const url = new URL("/companies", base);
		url.searchParams.set("record", `company:${input.companyId}`);
		const content = `${input.content}\n\nOrganization: ${company.name}\nCloud organization ID: ${external?.text ?? "Unavailable"}\nCRM: ${url.href}`;
		const issue = await this.submitRequest({ ...input, content }, user, {
			projectId: input.projectId,
			teamId: input.teamId,
		});
		try {
			await this.linkIssue(input.companyId, issue.id);
		} catch {
			throw new BadGatewayException(
				`Issue ${issue.identifier} was created, but the customer link failed. Retry without changing the form to finish linking.`,
			);
		}
		return issue;
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
				`query CustomerIssues($id: ID!, $after: String, $first: Int!) { organization { urlKey } customerNeeds(filter: {customer: {id: {eq: $id}}}, first: $first, after: $after) { nodes { issue { id identifier title url priorityLabel state { name type } assignee { name } updatedAt } } pageInfo { hasNextPage endCursor } } }`,
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
