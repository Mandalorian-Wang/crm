"use client";

import { Button } from "@crm/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	REQUEST_IMAGES,
	type RequestImage,
	requestImage,
} from "@crm/validation/crm-request";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { z } from "zod";

async function readImage(file: File): Promise<RequestImage> {
	if (
		file.size > REQUEST_IMAGES.maxBytes ||
		!REQUEST_IMAGES.types.some((type) => type === file.type)
	) {
		throw new Error("Choose PNG, JPEG, GIF or WebP images, up to 2 MB each.");
	}
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = z.string().safeParse(reader.result);
			if (result.success) resolve(result.data);
			else
				reject(new Error("Could not read this image. Please select it again."));
		};
		reader.onerror = () =>
			reject(new Error("Could not read this image. Please select it again."));
		reader.readAsDataURL(file);
	});
	const parsed = requestImage.safeParse({
		id: crypto.randomUUID(),
		name: file.name,
		type: file.type,
		base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
	});
	if (!parsed.success)
		throw new Error("Choose a valid PNG, JPEG, GIF or WebP image, up to 2 MB.");
	return parsed.data;
}

export function RequestImages({
	images,
	onChange,
	disabled,
	onReading,
}: {
	images: RequestImage[];
	onChange: (images: RequestImage[]) => void;
	disabled: boolean;
	onReading: (reading: boolean) => void;
}) {
	const id = useId();
	const input = useRef<HTMLInputElement>(null);
	const [error, setError] = useState<string | null>(null);
	return (
		<Field>
			<FieldLabel htmlFor={id}>Images (optional)</FieldLabel>
			<FieldDescription>
				PNG, JPEG, GIF or WebP. Up to 3 images, 2 MB each.
			</FieldDescription>
			<Input
				ref={input}
				id={id}
				type="file"
				hidden
				multiple
				accept={REQUEST_IMAGES.types.join(",")}
				disabled={disabled}
				onChange={async (event) => {
					const files = Array.from(event.target.files ?? []);
					event.target.value = "";
					setError(null);
					if (images.length + files.length > REQUEST_IMAGES.maxCount) {
						setError(
							"You can attach up to 3 images. Remove an image before adding more.",
						);
						return;
					}
					onReading(true);
					try {
						const selected = await Promise.all(files.map(readImage));
						onChange([...images, ...selected]);
					} catch (cause) {
						setError(
							cause instanceof Error
								? cause.message
								: "Could not read the selected images. Please try again.",
						);
					} finally {
						onReading(false);
					}
				}}
			/>
			<Button
				type="button"
				variant="outline"
				disabled={disabled || images.length >= REQUEST_IMAGES.maxCount}
				onClick={() => input.current?.click()}
			>
				Add images
			</Button>
			{images.length > 0 ? (
				<ul className="flex flex-col gap-2">
					{images.map((image, index) => (
						<li key={image.id} className="flex items-center gap-3">
							<Image
								src={`data:${image.type};base64,${image.base64}`}
								alt={image.name}
								width={64}
								height={48}
								unoptimized
								className="h-12 w-16 object-contain"
							/>
							<span className="min-w-0 flex-1 truncate" title={image.name}>
								{image.name}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={disabled}
								aria-label={`Remove ${image.name}`}
								onClick={() => {
									onChange(images.filter((_, i) => i !== index));
									setError(null);
								}}
							>
								Remove
							</Button>
						</li>
					))}
				</ul>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
		</Field>
	);
}
