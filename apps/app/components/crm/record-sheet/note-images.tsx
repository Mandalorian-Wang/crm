"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import type { RequestImage } from "@crm/validation/crm-request";
import Image from "next/image";
import { useState } from "react";

export function NoteImages({
	images,
	onRemove,
	disabled,
}: {
	images: RequestImage[];
	onRemove?: (id: string) => void;
	disabled?: boolean;
}) {
	const [preview, setPreview] = useState<RequestImage | null>(null);
	return (
		<>
			<div className="flex flex-wrap gap-3">
				{images.map((image) => (
					<div key={image.id} className="flex items-center gap-1">
						<button
							type="button"
							aria-label={`Preview ${image.name}`}
							onClick={() => setPreview(image)}
						>
							<Image
								src={`data:${image.type};base64,${image.base64}`}
								alt={image.name}
								width={96}
								height={72}
								unoptimized
								className="h-18 w-24 rounded-md border object-cover"
							/>
						</button>
						{onRemove ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={disabled}
								aria-label={`Remove ${image.name}`}
								onClick={() => onRemove(image.id)}
							>
								×
							</Button>
						) : null}
					</div>
				))}
			</div>
			<Dialog
				open={Boolean(preview)}
				onOpenChange={(open) => {
					if (!open) setPreview(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{preview?.name}</DialogTitle>
					</DialogHeader>
					{preview ? (
						<Image
							src={`data:${preview.type};base64,${preview.base64}`}
							alt={preview.name}
							width={960}
							height={640}
							unoptimized
							className="h-auto max-h-96 w-full object-contain"
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
