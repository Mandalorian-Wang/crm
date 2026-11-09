import { z } from "zod";

export const REQUEST_IMAGES = {
	maxCount: 3,
	maxBytes: 2 * 1024 * 1024,
	types: ["image/png", "image/jpeg", "image/gif", "image/webp"],
} as const;

export const requestImage = z
	.object({
		id: z.uuid(),
		name: z.string().trim().min(1).max(255),
		type: z.enum(REQUEST_IMAGES.types),
		base64: z
			.string()
			.min(4)
			.max(Math.ceil(REQUEST_IMAGES.maxBytes / 3) * 4)
			.regex(
				/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
			),
	})
	.refine((image) => {
		let bytes: string;
		try {
			bytes = atob(image.base64);
		} catch {
			return false;
		}
		if (!bytes.length || bytes.length > REQUEST_IMAGES.maxBytes) return false;
		switch (image.type) {
			case "image/png":
				return bytes.startsWith("\x89PNG\r\n\x1a\n");
			case "image/jpeg":
				return bytes.startsWith("\xff\xd8\xff");
			case "image/gif":
				return bytes.startsWith("GIF87a") || bytes.startsWith("GIF89a");
			case "image/webp":
				return bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
		}
	}, "Choose a valid PNG, JPEG, GIF or WebP image, up to 2 MB.");

export type RequestImage = z.infer<typeof requestImage>;
