"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@crm/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Textarea } from "@crm/ui/components/textarea";
import type { RequestImage } from "@crm/validation/crm-request";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { RequestImages } from "./request-images";

export function SubmitRequest() {
	const trpc = useTRPC();
	const titleId = useId();
	const contentId = useId();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [requestId, setRequestId] = useState<string | null>(null);
	const [images, setImages] = useState<RequestImage[]>([]);
	const [readingImages, setReadingImages] = useState(false);
	const submit = useMutation(trpc.linear.submitRequest.mutationOptions());
	const busy = submit.isPending || readingImages;
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!busy) setOpen(next);
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					Submit request
				</Button>
			</DialogTrigger>
			<DialogContent scrollable showCloseButton={!busy}>
				<DialogHeader>
					<DialogTitle>Submit a CRM request</DialogTitle>
					<DialogDescription>
						Send feedback to the Internal CRM system project in Linear. Your
						request will include the CRM label and your name.
					</DialogDescription>
				</DialogHeader>
				{submit.data ? (
					<div className="flex flex-col gap-3">
						<p>Request submitted: {submit.data.identifier}</p>
						<Button asChild variant="outline">
							<a
								href={submit.data.url}
								target="_blank"
								rel="noopener noreferrer"
							>
								View in Linear
							</a>
						</Button>
						<Button
							onClick={() => {
								submit.reset();
								setTitle("");
								setContent("");
								setRequestId(null);
								setImages([]);
							}}
						>
							Submit another request
						</Button>
					</div>
				) : (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							const id = requestId ?? crypto.randomUUID();
							setRequestId(id);
							submit.mutate({ requestId: id, title, content, images });
						}}
					>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor={titleId}>Title</FieldLabel>
								<Input
									id={titleId}
									required
									maxLength={200}
									value={title}
									disabled={busy}
									onChange={(event) => setTitle(event.target.value)}
									placeholder="What would you like to improve?"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={contentId}>Description</FieldLabel>
								<Textarea
									id={contentId}
									required
									maxLength={20000}
									rows={7}
									disabled={busy}
									value={content}
									onChange={(event) => setContent(event.target.value)}
									placeholder="Describe the use case, the problem, and your expected outcome."
								/>
							</Field>
							<RequestImages
								images={images}
								onChange={setImages}
								disabled={busy}
								onReading={setReadingImages}
							/>
							{submit.error ? (
								<p role="alert">
									{submit.error.message} Your draft is preserved. Please retry.
								</p>
							) : null}
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									disabled={busy}
									onClick={() => setOpen(false)}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={busy || !title.trim() || !content.trim()}
								>
									{readingImages
										? "Reading images…"
										: submit.isPending
											? "Submitting…"
											: "Submit request"}
								</Button>
							</DialogFooter>
						</FieldGroup>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
