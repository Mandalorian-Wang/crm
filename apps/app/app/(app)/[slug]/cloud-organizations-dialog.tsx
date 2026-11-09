"use client";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useTRPC } from "@/lib/trpc/client";

export function CloudOrganizationsDialog({
	date,
	days,
	scope,
	onClose,
}: {
	date: string;
	days: 1 | 7 | 15;
	scope: "all" | "active" | "inactive" | "unknown";
	onClose: () => void;
}) {
	const trpc = useTRPC(),
		openRecord = useOpenRecord();
	const [page, setPage] = useState(1),
		[filter, setFilter] = useState(scope);
	const query = useQuery(
		trpc.dashboard.cloudOrganizations.queryOptions({
			date,
			days,
			scope: filter,
			page,
		}),
	);
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent scrollable>
				<DialogHeader>
					<DialogTitle>Organizations in this reporting window</DialogTitle>
					<DialogDescription>
						{date} · {days} complete day(s), Shanghai. Uses the same snapshot as
						the overview.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-wrap gap-2">
					{(
						[
							["all", "All"],
							["active", "Created a Box"],
							["inactive", "Confirmed no Box"],
							["unknown", "Unconfirmed"],
						] as const
					).map(([value, label]) => (
						<Button
							key={value}
							size="sm"
							variant={filter === value ? "contrast" : "outline"}
							onClick={() => {
								setFilter(value);
								setPage(1);
							}}
						>
							{label}
						</Button>
					))}
				</div>
				{query.isPending ? <p>Loading organizations…</p> : null}
				{query.error ? (
					<p role="alert">
						{query.error.message}
						<Button variant="link" onClick={() => query.refetch()}>
							Retry
						</Button>
					</p>
				) : null}
				{query.data ? (
					<>
						<p>{query.data.total} organizations</p>
						<div className="flex flex-col gap-3">
							{query.data.rows.map((row) => (
								<div key={row.externalId} className="flex flex-col gap-1">
									<Button
										variant="link"
										disabled={!row.id}
										onClick={() => {
											if (row.id) {
												onClose();
												openRecord({ kind: "company", id: row.id });
											}
										}}
									>
										{row.name}
									</Button>
									<p className="break-all text-xs text-muted-foreground">
										{row.email ?? row.externalId}
									</p>
									<p className="text-xs">
										Registered:{" "}
										{new Date(row.createdAt).toLocaleString("en-GB", {
											timeZone: "Asia/Shanghai",
										})}{" "}
										·{" "}
										{row.createdBox === null
											? "Box activity unconfirmed"
											: row.createdBox
												? "Created a Box"
												: "Confirmed no Box"}
									</p>
								</div>
							))}
						</div>
						{query.data.total === 0 ? (
							<p>No organizations match this category.</p>
						) : null}
						<div className="flex items-center justify-between gap-2">
							<Button
								size="sm"
								variant="outline"
								disabled={page <= 1}
								onClick={() => setPage(page - 1)}
							>
								Previous
							</Button>
							<span>Page {page}</span>
							<Button
								size="sm"
								variant="outline"
								disabled={page * query.data.pageSize >= query.data.total}
								onClick={() => setPage(page + 1)}
							>
								Next
							</Button>
						</div>
					</>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
