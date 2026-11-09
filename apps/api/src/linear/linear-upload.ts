import type { RequestImage } from "@crm/validation/crm-request";
import { BadGatewayException } from "@nestjs/common";
import { z } from "zod";
import { linearRequest } from "./linear-client";
import { LINEAR } from "./linear-config";

export async function uploadRequestImages(images: RequestImage[]) {
	const urls: string[] = [];
	for (const image of images) {
		const bytes = Buffer.from(image.base64, "base64");
		const result = await linearRequest(
			`mutation Upload($contentType:String!,$filename:String!,$size:Int!){fileUpload(contentType:$contentType,filename:$filename,size:$size){success uploadFile{uploadUrl assetUrl headers{key value}}}}`,
			{ contentType: image.type, filename: image.name, size: bytes.length },
			z.object({
				fileUpload: z.object({
					success: z.boolean(),
					uploadFile: z
						.object({
							uploadUrl: z.url(),
							assetUrl: z.url(),
							headers: z.array(
								z.object({ key: z.string(), value: z.string() }),
							),
						})
						.nullable(),
				}),
			}),
			true,
		);
		const file = result.fileUpload.uploadFile;
		if (!result.fileUpload.success || !file)
			throw new BadGatewayException(
				"Linear could not prepare the image upload. Try again.",
			);
		const headers = new Headers({
			"Content-Type": image.type,
			"Cache-Control": "public, max-age=31536000",
		});
		for (const header of file.headers) headers.set(header.key, header.value);
		try {
			const response = await fetch(file.uploadUrl, {
				method: "PUT",
				headers,
				body: bytes,
				signal: AbortSignal.timeout(LINEAR.uploadTimeoutMs),
				redirect: "error",
			});
			if (!response.ok) throw new Error("Upload rejected");
		} catch {
			throw new BadGatewayException(
				"Image upload failed. Your draft is preserved. Please retry.",
			);
		}
		urls.push(file.assetUrl);
	}
	return urls
		.map((url, index) => `![Attachment ${index + 1}](<${url}>)`)
		.join("\n\n");
}
