"use client";

import { InputGroupButton } from "@crm/ui/components/input-group";
import {
	NoteComposer,
	NoteComposerFooter,
} from "@crm/ui/components/note-composer";
import { REQUEST_IMAGES, type RequestImage } from "@crm/validation/crm-request";
import { useRef, useState } from "react";
import { readImage } from "@/components/request-images";
import { NoteImages } from "./note-images";
import { type NoteDraft, NoteMentionEditor } from "./note-mention-editor";

export type DailyNoteDraft = NoteDraft & { images: RequestImage[] };

export function DailyNoteComposer({
	value,
	onChange,
	disabled,
	label,
	onReading,
	submitLabel = "Log note",
	onCancel,
}: {
	value: DailyNoteDraft;
	onChange: (value: DailyNoteDraft) => void;
	disabled: boolean;
	label: string;
	onReading: (reading: boolean) => void;
	submitLabel?: string;
	onCancel?: () => void;
}) {
	const input = useRef<HTMLInputElement>(null);
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
			onKeyDown={(event) => {
				if (
					!event.defaultPrevented &&
					!event.nativeEvent.isComposing &&
					event.key === "Enter" &&
					(event.metaKey || event.ctrlKey)
				) {
					event.preventDefault();
					if (
						!disabled &&
						!busy.current &&
						(value.body.trim() || value.images.length)
					)
						event.currentTarget.form?.requestSubmit();
				}
			}}
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
			<NoteComposer>
				<NoteMentionEditor
					label={label}
					value={value}
					disabled={disabled}
					onChange={(draft) => onChange({ ...value, ...draft })}
				/>
				{value.images.length ? (
					<div className="w-full px-3 pb-2">
						<NoteImages
							images={value.images}
							disabled={disabled}
							onRemove={(id) =>
								onChange({
									...value,
									images: value.images.filter((image) => image.id !== id),
								})
							}
						/>
					</div>
				) : null}
				<NoteComposerFooter>
					<input
						ref={input}
						type="file"
						hidden
						multiple
						accept={REQUEST_IMAGES.types.join(",")}
						disabled={disabled}
						aria-label="Attach images"
						onChange={(event) => {
							const files = Array.from(event.target.files ?? []);
							event.target.value = "";
							void addFiles(files);
						}}
					/>
					<InputGroupButton
						disabled={
							disabled || value.images.length >= REQUEST_IMAGES.maxCount
						}
						onClick={() => input.current?.click()}
						title="Paste, drop or attach up to 3 images (2 MB each)"
					>
						Attach image
					</InputGroupButton>
					<div className="ml-auto flex items-center gap-2">
						{onCancel ? (
							<InputGroupButton disabled={disabled} onClick={onCancel}>
								Cancel
							</InputGroupButton>
						) : null}
						{value.body.trim() || value.images.length ? (
							<InputGroupButton
								type="submit"
								variant="default"
								disabled={disabled}
								title="⌘ / Ctrl + Enter"
							>
								{submitLabel}
							</InputGroupButton>
						) : null}
					</div>
				</NoteComposerFooter>
			</NoteComposer>
			{error ? <p role="alert">{error}</p> : null}
		</fieldset>
	);
}
