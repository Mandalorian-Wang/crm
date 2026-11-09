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
							<Button
								variant="outline"
								size="sm"
								disabled={bind.isPending}
								onClick={() => bind.mutate({ companyId, reference: null })}
							>
								Unlink customer
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
									<FieldDescription>{customers.error.message}</FieldDescription>
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
						{issues.isFetching ? (
							<DetailSheetProse>Loading issues from Linear…</DetailSheetProse>
						) : null}
						{issues.error ? (
							<DetailSheetProse>{issues.error.message}</DetailSheetProse>
						) : null}
						{issues.data && !issues.error ? (
							<>
								<DetailSheetProse>
									{issues.data.issues.length} issues linked through this
									customer's requests.
								</DetailSheetProse>
								{issues.data.issues.length ? (
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
											{issues.data.issues.map((issue) => (
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
										This customer has no linked issues in Linear.
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
