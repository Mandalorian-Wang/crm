import { afterEach, expect, it, spyOn } from "bun:test";
import { REQUEST_IMAGES } from "@crm/validation/crm-request";
import { linearRequestInput } from "../src/linear/linear.contracts";
import { uploadRequestImages } from "../src/linear/linear-upload";

const image = {
	id: "00000000-0000-4000-8000-000000000001",
	name: "screenshot.png",
	type: "image/png" as const,
	base64:
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
};
const input = {
	requestId: crypto.randomUUID(),
	title: "Screenshot",
	content: "Example",
	images: [image],
};
const originalKey = process.env.LINEAR_API_KEY;
const originalWorkspace = process.env.LINEAR_WORKSPACE_SLUG;
let request: ReturnType<typeof spyOn<typeof globalThis, "fetch">> | undefined;
afterEach(() => {
	request?.mockRestore();
	if (originalKey === undefined) delete process.env.LINEAR_API_KEY;
	else process.env.LINEAR_API_KEY = originalKey;
	if (originalWorkspace === undefined) delete process.env.LINEAR_WORKSPACE_SLUG;
	else process.env.LINEAR_WORKSPACE_SLUG = originalWorkspace;
});

it("rejects unsupported, malformed, mismatched, oversized and excess image payloads", () => {
	expect(linearRequestInput.safeParse(input).success).toBe(true);
	for (const replacement of [
		{ ...image, type: "image/svg+xml" },
		{ ...image, base64: "not base64!" },
		{ ...image, type: "image/jpeg" },
		{
			...image,
			base64: Buffer.alloc(REQUEST_IMAGES.maxBytes + 1).toString("base64"),
		},
	])
		expect(
			linearRequestInput.safeParse({ ...input, images: [replacement] }).success,
		).toBe(false);
	expect(
		linearRequestInput.safeParse({ ...input, images: Array(4).fill(image) })
			.success,
	).toBe(false);
	expect(linearRequestInput.safeParse({ ...input, images: [] }).success).toBe(
		true,
	);
});

function mockUpload(status: number) {
	process.env.LINEAR_API_KEY = "test-key";
	process.env.LINEAR_WORKSPACE_SLUG = "polygala";
	request = spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ data: { organization: { urlKey: "polygala" } } }),
			),
		)
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					data: {
						fileUpload: {
							success: true,
							uploadFile: {
								uploadUrl: "https://uploads.example.test/signed",
								assetUrl: "https://uploads.linear.app/example.png",
								headers: [{ key: "x-upload-required", value: "yes" }],
							},
						},
					},
				}),
			),
		)
		.mockResolvedValueOnce(new Response("", { status }));
	return request;
}

it("uploads image bytes and required headers without forwarding the Linear credential", async () => {
	const fetch = mockUpload(200);
	const markdown = await uploadRequestImages([image]);
	expect(markdown).toBe(
		"![Attachment 1](<https://uploads.linear.app/example.png>)",
	);
	const options = fetch.mock.calls[2]?.[1];
	expect(options?.method).toBe("PUT");
	expect(options?.body).toEqual(Buffer.from(image.base64, "base64"));
	const headers = new Headers(options?.headers);
	expect(headers.get("x-upload-required")).toBe("yes");
	expect(headers.get("content-type")).toBe("image/png");
	expect(headers.has("authorization")).toBe(false);
});

it("stops on a rejected storage upload and returns a retryable English error", async () => {
	const fetch = mockUpload(403);
	await expect(uploadRequestImages([image])).rejects.toThrow(
		"Image upload failed",
	);
	expect(fetch.mock.calls).toHaveLength(3);
});
