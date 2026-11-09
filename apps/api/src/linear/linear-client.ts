import {
	BadGatewayException,
	BadRequestException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { LINEAR } from "./linear-config";

export function customerReference(
	reference: string,
	workspace: string,
): string {
	if (
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			reference,
		) ||
		/^[0-9a-f]{12}$/i.test(reference)
	)
		return reference;
	let url: URL;
	try {
		url = new URL(reference);
	} catch {
		throw new BadRequestException("Enter a Linear customer URL or ID.");
	}
	const parts = url.pathname.split("/").filter(Boolean);
	if (
		url.protocol !== "https:" ||
		url.hostname !== "linear.app" ||
		parts[0] !== workspace ||
		parts[1] !== "customer" ||
		parts.length !== 3
	)
		throw new BadRequestException(
			"Use a customer URL from the configured Linear workspace.",
		);
	const slug = parts[2]?.split("-").at(-1);
	if (!slug || !/^[0-9a-f]{12}$/i.test(slug))
		throw new BadRequestException(
			"This customer URL has no valid customer ID.",
		);
	return slug;
}

export async function linearRequest<T>(
	query: string,
	variables: {
		id?: string;
		contentType?: string;
		filename?: string;
		size?: number;
		input?: {
			id: string;
			title: string;
			description: string;
			teamId: string;
			projectId: string;
			labelIds: string[];
		};
		filter?: { name?: { containsIgnoreCase: string } };
		after?: string | null;
		first?: number;
	},
	schema: z.ZodType<T>,
	mutation = false,
): Promise<T> {
	if (mutation)
		await linearRequest(
			"{ organization { urlKey } }",
			{},
			z.object({ organization: z.object({ urlKey: z.string() }) }),
		);
	const key = process.env.LINEAR_API_KEY;
	const workspace = process.env.LINEAR_WORKSPACE_SLUG;
	if (!key || !workspace)
		throw new ServiceUnavailableException(
			"Linear is not configured. Set its server API key and workspace.",
		);
	let response: Response;
	try {
		response = await fetch(LINEAR.endpoint, {
			method: "POST",
			headers: { Authorization: key, "Content-Type": "application/json" },
			body: JSON.stringify({ query, variables }),
			signal: AbortSignal.timeout(LINEAR.timeoutMs),
		});
	} catch {
		throw new BadGatewayException("Linear is unreachable. Try again.");
	}
	if (!response.ok)
		throw new BadGatewayException(
			response.status === 429
				? "Linear rate limit reached. Try again later."
				: "Linear rejected the request. Check the API key and its permissions.",
		);
	const envelope = z.object({
		data: z.unknown().optional(),
		errors: z.array(z.unknown()).optional(),
	});
	let raw: z.infer<typeof envelope>;
	try {
		raw = envelope.parse(await response.json());
	} catch {
		throw new BadGatewayException("Linear returned an invalid response.");
	}
	if (raw.errors?.length)
		throw new BadGatewayException(
			"Linear could not complete the request. Check the input and key permissions.",
		);
	const scope = z
		.object({ organization: z.object({ urlKey: z.string() }) })
		.safeParse(raw.data);
	if (
		!mutation &&
		(!scope.success || scope.data.organization.urlKey !== workspace)
	)
		throw new BadGatewayException(
			"The Linear API key belongs to a different workspace.",
		);
	const parsed = schema.safeParse(raw.data);
	if (!parsed.success)
		throw new BadGatewayException("Linear returned an unexpected data format.");
	return parsed.data;
}
