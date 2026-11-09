"use client";

import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@crm/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
	DetailSheetBody,
	DetailSheetMain,
	DetailSheetProse,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { LocalDay } from "@/components/local-date-time";
import { SubmitRequest } from "@/components/submit-request";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function CompanyLinear({ companyId }: { companyId: string }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const searchId = useId();
	const referenceId = useId();
	const [search, setSearch] = useState("");
	const [q, setQuery] = useState("");
	const [cursor, setCursor] = useState<string | null>(null);
	const [selected, setSelected] = useState("");
	const [reference, setReference] = useState("");
	const [issueReference, setIssueReference] = useState("");
	const [issueFilter, setIssueFilter] = useState<"open" | "all" | "completed">(
		"open",
	);
	const linkIssue = useMutation(
		trpc.linear.linkIssue.mutationOptions({
			onSuccess: async () => {
				setIssueReference("");
				await cache.linear(companyId);
				toast.success("Issue linked to the customer.");
			},
		}),
	);
	const binding = useQuery(trpc.linear.binding.queryOptions({ companyId }));
	const customers = useQuery({
		...trpc.linear.customers.queryOptions({ q, cursor }),
		enabled: binding.data?.configured === true,
	});
	const issues = useQuery({
		...trpc.linear.issues.queryOptions({ companyId }),
		enabled: Boolean(binding.data?.configured && binding.data.customer),
		staleTime: 30_000,
	});
	const bind = useMutation(
		trpc.linear.bind.mutationOptions({
			onSuccess: async () => {
				setReference("");
				setSelected("");
				await cache.linear(companyId);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const customer = binding.data?.customer;
	const visibleIssues =
		issues.data?.issues.filter((issue) => {
			const completed = ["completed", "canceled"].includes(
				issue.state?.type ?? "",
			);
			return (
				issueFilter === "all" ||
				(issueFilter === "completed" ? completed : !completed)
			);
		}) ?? [];
	return (
		<DetailSheetBody>
			<DetailSheetMain>
				<DetailSheetSection title="Linear customer">
					{binding.isPending ? (
						<DetailSheetProse>Loading customer…</DetailSheetProse>
					) : null}
					{binding.error ? (
						<DetailSheetProse>{binding.error.message}</DetailSheetProse>
					) : null}
					{customer ? (
						<div className="flex items-center gap-3">
							<Button asChild variant="link">
								<a
									href={customer.url}
									target="_blank"
									rel="noopener noreferrer"
								>
									{customer.name}
								</a>
							</Button>
						</div>
					) : (
						<DetailSheetProse>
							No Linear customer linked. Select one below or paste its customer
							URL or ID.
						</DetailSheetProse>
					)}
					{binding.data && !binding.data.configured ? (
						<DetailSheetProse>
							Linear is not configured. Add its API key and workspace to the
							server configuration.
						</DetailSheetProse>
					) : null}
					{binding.data?.configured ? (
						<details open={!customer}>
							<summary>Manage connection</summary>
							{customer ? (
								<Button
									variant="outline"
									size="sm"
									disabled={bind.isPending}
									onClick={() => bind.mutate({ companyId, reference: null })}
								>
									Unlink customer
								</Button>
							) : null}
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor={searchId}>
										Find a Linear customer
									</FieldLabel>
									<form
										className="flex gap-2"
										onSubmit={(event) => {
											event.preventDefault();
											setQuery(search.trim());
											setCursor(null);
											setSelected("");
										}}
									>
										<Input
											id={searchId}
											placeholder="Search customers by name"
											value={search}
											onChange={(event) => setSearch(event.target.value)}
										/>
										<Button type="submit" variant="outline">
											Search
										</Button>
									</form>
									{customers.error ? (
										<FieldDescription>
											{customers.error.message}
										</FieldDescription>
									) : null}
									<div className="flex flex-wrap items-center gap-2">
										<Select
											value={selected}
											onValueChange={setSelected}
											disabled={customers.isFetching || bind.isPending}
										>
											<SelectTrigger aria-label="Linear customer">
												<SelectValue
													placeholder={
														customers.isFetching
															? "Loading customers…"
															: "Select a customer"
													}
												/>
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													{customers.data?.nodes.map((entry) => (
														<SelectItem key={entry.id} value={entry.id}>
															{entry.name}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
										<Button
											disabled={!selected || bind.isPending}
											onClick={() =>
												bind.mutate({ companyId, reference: selected })
											}
										>
											Link selected customer
										</Button>
										{cursor ? (
											<Button
												variant="ghost"
												onClick={() => {
													setCursor(null);
													setSelected("");
												}}
											>
												First page
											</Button>
										) : null}
										{customers.data?.pageInfo.hasNextPage ? (
											<Button
												variant="ghost"
												disabled={customers.isFetching}
												onClick={() => {
													setCursor(customers.data?.pageInfo.endCursor ?? null);
													setSelected("");
												}}
											>
												More customers
											</Button>
										) : null}
									</div>
									{customers.data?.nodes.length === 0 ? (
										<FieldDescription>
											No customers match this search.
										</FieldDescription>
									) : null}
								</Field>
								<Field>
									<FieldLabel htmlFor={referenceId}>
										Or enter a customer URL or ID
									</FieldLabel>
									<form
										className="flex gap-2"
										onSubmit={(event) => {
											event.preventDefault();
											bind.mutate({ companyId, reference: reference.trim() });
										}}
									>
										<Input
											id={referenceId}
											placeholder="https://linear.app/polygala/customer/…"
											value={reference}
											onChange={(event) => setReference(event.target.value)}
										/>
										<Button
											type="submit"
											variant="outline"
											disabled={!reference.trim() || bind.isPending}
										>
											Link customer
										</Button>
									</form>
									<FieldDescription>
										Each organization links to one customer. Selecting another
										customer replaces this link.
									</FieldDescription>
								</Field>
							</FieldGroup>
						</details>
					) : null}
				</DetailSheetSection>
				{customer ? (
					<DetailSheetSection
						title="Customer issues"
						action={
							<Button
								variant="outline"
								size="sm"
								disabled={!binding.data?.configured || issues.isFetching}
								onClick={() => issues.refetch()}
							>
								Refresh issues
							</Button>
						}
					>
						<div className="flex flex-wrap gap-2">
							<SubmitRequest companyId={companyId} />
							{(["open", "all", "completed"] as const).map((filter) => (
								<Button
									key={filter}
									size="sm"
									variant={issueFilter === filter ? "contrast" : "outline"}
									onClick={() => setIssueFilter(filter)}
								>
									{filter === "open"
										? "Open"
										: filter === "all"
											? "All"
											: "Completed"}
								</Button>
							))}
						</div>
						<form
							className="flex flex-col gap-2 py-3"
							onSubmit={(event) => {
								event.preventDefault();
								linkIssue.mutate({ companyId, reference: issueReference });
							}}
						>
							<Field>
								<FieldLabel htmlFor={`${referenceId}-issue`}>
									Link an existing issue
								</FieldLabel>
								<Input
									id={`${referenceId}-issue`}
									placeholder="Linear issue URL or BUI-123"
									value={issueReference}
									onChange={(event) => setIssueReference(event.target.value)}
									disabled={linkIssue.isPending}
								/>
							</Field>
							{linkIssue.error ? (
								<p role="alert">{linkIssue.error.message}</p>
							) : null}
							<Button
								type="submit"
								variant="outline"
								disabled={linkIssue.isPending || !issueReference.trim()}
							>
								{linkIssue.isPending ? "Linking…" : "Link issue"}
							</Button>
						</form>
						<DetailSheetProse>
							Only issues visible to CRM’s Linear connection are listed. A link
							in an issue description does not create a customer request.
						</DetailSheetProse>
						{issues.isFetching ? (
							<DetailSheetProse>Loading issues from Linear…</DetailSheetProse>
						) : null}
						{issues.error ? (
							<DetailSheetProse>{issues.error.message}</DetailSheetProse>
						) : null}
						{issues.data ? (
							<>
								<DetailSheetProse>
									{issues.data.issues.length} accessible issues linked to this
									customer. Last fetched:{" "}
									{new Date(issues.data.fetchedAt).toLocaleString("en-GB", {
										timeZone: "Asia/Shanghai",
									})}{" "}
									(Shanghai).
								</DetailSheetProse>
								{visibleIssues.length ? (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Issue</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Priority</TableHead>
												<TableHead>Assignee</TableHead>
												<TableHead>Updated</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{visibleIssues.map((issue) => (
												<TableRow key={issue.id}>
													<TableCell>
														<Button asChild variant="link">
															<a
																href={issue.url}
																target="_blank"
																rel="noopener noreferrer"
															>
																{issue.identifier} · {issue.title}
															</a>
														</Button>
													</TableCell>
													<TableCell>{issue.state?.name ?? "—"}</TableCell>
													<TableCell>{issue.priorityLabel}</TableCell>
													<TableCell>{issue.assignee?.name ?? "—"}</TableCell>
													<TableCell>
														<LocalDay date={issue.updatedAt} />
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								) : (
									<DetailSheetProse>
										No issues match this view. Try All issues, link an existing
										issue above, or check that the CRM connection can access the
										issue’s team.
									</DetailSheetProse>
								)}
							</>
						) : null}
					</DetailSheetSection>
				) : null}
			</DetailSheetMain>
		</DetailSheetBody>
	);
}
