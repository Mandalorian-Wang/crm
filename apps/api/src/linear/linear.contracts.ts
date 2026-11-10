import { REQUEST_IMAGES, requestImage } from "@crm/validation/crm-request";
import { z } from "zod";

export const linearCustomer = z.object({
	id: z.string(),
	name: z.string(),
	url: z.url(),
});
export const linearIssue = z.object({
	id: z.string(),
	identifier: z.string(),
	title: z.string(),
	url: z.url(),
	priorityLabel: z.string(),
	state: z.object({ name: z.string(), type: z.string().optional() }).nullable(),
	assignee: z.object({ name: z.string() }).nullable(),
	updatedAt: z.string(),
});
export const linearPageInfo = z.object({
	hasNextPage: z.boolean(),
	endCursor: z.string().nullable(),
});
export const linearCompanyInput = z.object({ companyId: z.string().min(1) });
export const linearCustomersInput = z.object({
	q: z.string().trim().max(200).default(""),
	cursor: z.string().max(200).nullish(),
});
export const linearCustomersOutput = z.object({
	nodes: z.array(linearCustomer),
	pageInfo: linearPageInfo,
});
export const linearBindingInput = linearCompanyInput.extend({
	reference: z.string().trim().max(1000).nullable(),
});
export const linearBindingOutput = z.object({
	customer: linearCustomer.nullable(),
	configured: z.boolean(),
});
export const linearIssuesOutput = z.object({
	issues: z.array(linearIssue),
	fetchedAt: z.string(),
});

export const linearNeedsOutput = z.object({
	customerNeeds: z.object({
		nodes: z.array(z.object({ issue: linearIssue.nullable() })),
		pageInfo: linearPageInfo,
	}),
});

export const linearRequestInput = z.object({
	requestId: z.uuid(),
	title: z.string().trim().min(1).max(200),
	content: z.string().trim().min(1).max(20000),
	images: z.array(requestImage).max(REQUEST_IMAGES.maxCount).optional(),
});
export const linearRequestOutput = z.object({
	id: z.string(),
	identifier: z.string(),
	url: z.url(),
});

export const linearProject = z.object({
	id: z.string(),
	name: z.string(),
	url: z.url(),
	teams: z.object({
		nodes: z.array(z.object({ id: z.string(), name: z.string() })),
	}),
});
export const linearProjectsOutput = z.array(linearProject);
export const linearLinkIssueInput = linearCompanyInput.extend({
	reference: z.string().trim().min(1).max(1000),
});
export const linearCustomerIssueInput = linearRequestInput.extend({
	companyId: z.string(),
	projectId: z.uuid(),
	teamId: z.uuid(),
});

export const linearProjectsPage = z.object({
	projects: z.object({
		nodes: z.array(linearProject),
		pageInfo: linearPageInfo,
	}),
});

export const linearCreateCustomerInput = linearCompanyInput.extend({
	name: z.string().trim().min(1).max(200),
});
