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
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Textarea } from "@crm/ui/components/textarea";
import type { RequestImage } from "@crm/validation/crm-request";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { RequestImages } from "./request-images";

export function SubmitRequest({ companyId }: { companyId?: string }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const titleId = useId();
	const contentId = useId();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [requestId, setRequestId] = useState<string | null>(null);
	const [images, setImages] = useState<RequestImage[]>([]);
	const [readingImages, setReadingImages] = useState(false);
	const crmSubmit = useMutation(trpc.linear.submitRequest.mutationOptions());
	const customerSubmit = useMutation(
		trpc.linear.createCustomerIssue.mutationOptions({
			onSuccess: () => (companyId ? cache.linear(companyId) : undefined),
		}),
	);
	const submit = companyId ? customerSubmit : crmSubmit;
	const [projectId, setProjectId] = useState("");
	const [teamId, setTeamId] = useState("");
	const projects = useQuery({
		...trpc.linear.projects.queryOptions(),
		enabled: Boolean(companyId && open),
	});
	const project = projects.data?.find((item) => item.id === projectId);
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
					{companyId ? "Create issue" : "Submit request"}
				</Button>
			</DialogTrigger>
			<DialogContent scrollable showCloseButton={!busy}>
				<DialogHeader>
					<DialogTitle>
						{companyId ? "Create a customer issue" : "Submit a CRM request"}
					</DialogTitle>
					<DialogDescription>
						{companyId
							? "Choose a project and team. The issue will link to this organization’s Linear customer and include a CRM backlink."
							: "Send feedback to the Internal CRM system project in Linear. Your request will include the CRM label and your name."}
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
							if (companyId)
								customerSubmit.mutate({
									companyId,
									projectId,
									teamId,
									requestId: id,
									title,
									content,
									images,
								});
							else crmSubmit.mutate({ requestId: id, title, content, images });
						}}
					>
						<FieldGroup>
							{companyId ? (
								<>
									<Field>
										<FieldLabel>Linear project</FieldLabel>
										<Select
											value={projectId}
											onValueChange={(value) => {
												setProjectId(value);
												const selected = projects.data?.find(
													(item) => item.id === value,
												);
												setTeamId(
													selected?.teams.nodes.length === 1
														? (selected.teams.nodes[0]?.id ?? "")
														: "",
												);
											}}
											disabled={busy}
										>
											<SelectTrigger aria-label="Linear project">
												<SelectValue
													placeholder={
														projects.isPending
															? "Loading projects…"
															: "Select a project"
													}
												/>
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													{projects.data?.map((item) => (
														<SelectItem key={item.id} value={item.id}>
															{item.name}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
										{projects.error ? (
											<p role="alert">
												{projects.error.message}
												<Button
													type="button"
													variant="link"
													onClick={() => projects.refetch()}
												>
													Retry
												</Button>
											</p>
										) : null}
									</Field>
									<Field>
										<FieldLabel>Linear team</FieldLabel>
										<Select
											value={teamId}
											onValueChange={setTeamId}
											disabled={busy || !project}
										>
											<SelectTrigger aria-label="Linear team">
												<SelectValue placeholder="Select a team" />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													{project?.teams.nodes.map((team) => (
														<SelectItem key={team.id} value={team.id}>
															{team.name}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
									</Field>
								</>
							) : null}
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
									disabled={
										busy ||
										!title.trim() ||
										!content.trim() ||
										Boolean(companyId && (!projectId || !teamId))
									}
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
