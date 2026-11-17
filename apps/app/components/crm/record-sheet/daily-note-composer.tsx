"use client";

import { REQUEST_IMAGES, type RequestImage } from "@crm/validation/crm-request";
import { useRef, useState } from "react";
import { RequestImages, readImage } from "@/components/request-images";
import { type NoteDraft, NoteMentionEditor } from "./note-mention-editor";

export type DailyNoteDraft = NoteDraft & { images: RequestImage[] };

export function DailyNoteComposer({
	value,
	onChange,
	disabled,
	label,
	onReading,
}: {
	value: DailyNoteDraft;
	onChange: (value: DailyNoteDraft) => void;
	disabled: boolean;
	label: string;
	onReading: (reading: boolean) => void;
}) {
	const latest = useRef(value);
	latest.current = value;
	const busy = useRef(false);
	const [error, setError] = useState<string | null>(null);
	async function addFiles(files: File[]) {
		if (!files.length || disabled || busy.current) return;
		if (latest.current.images.length + files.length > REQUEST_IMAGES.maxCount) {
			setError("Attach up to 3 images per note.");
			return;
		}
		busy.current = true;
		onReading(true);
		setError(null);
		try {
			const images = await Promise.all(files.map(readImage));
			onChange({
				...latest.current,
				images: [...latest.current.images, ...images],
			});
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not read images.",
			);
		} finally {
			busy.current = false;
			onReading(false);
		}
	}
	return (
		<fieldset
			aria-label="Note content and images"
			className="space-y-3"
			onPaste={(event) => {
				const files = Array.from(event.clipboardData.files).filter((file) =>
					file.type.startsWith("image/"),
				);
				if (files.length) {
					event.preventDefault();
					void addFiles(files);
				}
			}}
			onDragOver={(event) => {
				if (event.dataTransfer.types.includes("Files")) event.preventDefault();
			}}
			onDrop={(event) => {
				if (!event.dataTransfer.files.length) return;
				event.preventDefault();
				void addFiles(Array.from(event.dataTransfer.files));
			}}
		>
			<NoteMentionEditor
				label={label}
				value={value}
				disabled={disabled}
				onChange={(draft) => onChange({ ...value, ...draft })}
			/>
			<p className="text-xs text-muted-foreground">
				Paste or drop images here, or choose files below.
			</p>
			<RequestImages
				images={value.images}
				onChange={(images) => onChange({ ...value, images })}
				disabled={disabled}
				onReading={onReading}
			/>
			{error ? <p role="alert">{error}</p> : null}
		</fieldset>
	);
}
