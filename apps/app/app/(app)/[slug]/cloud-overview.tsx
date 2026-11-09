"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardPanel,
	CardPanelEmpty,
	CardTitle,
} from "@crm/ui/components/card";
import { DashboardGrid } from "@crm/ui/components/dashboard";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { StatCard } from "@crm/ui/components/stat-card";
import { TableCell } from "@crm/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, useQueryState } from "nuqs";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { useTRPC } from "@/lib/trpc/client";

const COLUMNS = [
	{ id: "name", header: "Name" },
	{ id: "email", header: "Email" },
	{ id: "organization", header: "Cloud organization" },
	{ id: "source", header: "Source" },
];

export function CloudOverview() {
	const trpc = useTRPC();
	const [rawPage, setPage] = useQueryState(
		"inboundPage",
		parseAsInteger.withDefault(1),
	);
	const page = Math.max(1, Math.min(100000, rawPage));
	const query = useQuery(trpc.dashboard.cloudOverview.queryOptions({ page }));
	const summary = query.data;
	if (query.isError)
		return (
			<Card>
				<CardHeader>
					<CardTitle>Could not load the overview</CardTitle>
					<CardDescription>
						Your data is unchanged. Please try again.
					</CardDescription>
				</CardHeader>
				<CardPanel>
					<Button onClick={() => query.refetch()}>Retry</Button>
				</CardPanel>
			</Card>
		);
	if (!summary)
		return (
			<div className="flex justify-center py-12">
				<Spinner />
			</div>
		);
	const pages = Math.max(1, Math.ceil(summary.total / summary.pageSize));
	return (
		<div className="flex flex-col gap-6">
			<p className="text-sm text-muted-foreground">
				Yesterday · {summary.date} · Asia/Shanghai · 00:00–24:00
			</p>
			<DashboardGrid columns={2}>
				<Card>
					<StatCard
						label="New Cloud users yesterday"
						value={summary.newCloudUsers ?? "—"}
						description="Cloud users are counted as organizations"
					/>
				</Card>
				<Card>
					<StatCard
						label="Created a Box yesterday"
						value={
							summary.activationRate !== null
								? `${(summary.activationRate * 100).toFixed(1)}%`
								: summary.confirmedRate !== null &&
										summary.unknownOrganizations > 0
									? `≥${(summary.confirmedRate * 100).toFixed(1)}%`
									: "—"
						}
						description={
							summary.newCloudUsers === null
								? "Awaiting daily sync"
								: summary.newCloudUsers === 0
									? "No new Cloud organizations yesterday"
									: `${summary.createdBoxUsers} of ${summary.newCloudUsers} new organizations confirmed; ${summary.unknownOrganizations} unconfirmed`
						}
					/>
				</Card>
			</DashboardGrid>
			<p className="text-xs text-muted-foreground">
				Organizations created yesterday, and the share that created a Box on the
				same day.
				{summary.unknownOrganizations > 0
					? " The displayed rate is a lower bound; complete Box creation history is unavailable."
					: ""}
				{summary.syncedAt
					? ` Last synced: ${new Date(summary.syncedAt).toLocaleString("en-GB", { timeZone: summary.timezone })} (Shanghai).`
					: " Awaiting daily sync."}
			</p>
			<Card>
				<CardHeader>
					<CardTitle>New inbound users yesterday</CardTitle>
					<CardDescription>
						{summary.total} unique inbound users associated with organizations
						created on {summary.date}.
						{summary.pendingMemberships > 0
							? ` Membership sync pending for ${summary.pendingMemberships} organizations.`
							: ""}
					</CardDescription>
				</CardHeader>
				<CardPanel>
					{summary.rows.length ? (
						<SimpleTable columns={COLUMNS} surface="page">
							{summary.rows.map((row) => (
								<SimpleTableRow key={row.id}>
									<TableCell>
										<RecordLink
											kind="contact"
											id={row.id}
											className="font-medium text-foreground"
										>
											{row.name || "Unnamed user"}
										</RecordLink>
									</TableCell>
									<TableCell>{row.email ?? "—"}</TableCell>
									<TableCell>
										{row.organizations.length
											? row.organizations.map((organization) => (
													<div key={organization.id}>
														<RecordLink kind="company" id={organization.id}>
															{organization.name}
														</RecordLink>
													</div>
												))
											: "—"}
									</TableCell>
									<TableCell>{row.source}</TableCell>
								</SimpleTableRow>
							))}
						</SimpleTable>
					) : (
						<CardPanelEmpty>
							{summary.total === 0
								? summary.metricsStatus === "PENDING" ||
									summary.pendingMemberships > 0
									? "Awaiting daily sync."
									: "No inbound users linked to yesterday’s new organizations."
								: "No users on this page. Return to the previous page."}
						</CardPanelEmpty>
					)}
					{pages > 1 || page > 1 ? (
						<div className="flex items-center justify-end gap-3 p-4">
							<Button
								variant="outline"
								size="sm"
								disabled={page <= 1 || query.isFetching}
								onClick={() => setPage(page - 1)}
							>
								Previous
							</Button>
							<span className="text-xs text-muted-foreground">
								Page {page} of {pages}
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={page >= pages || query.isFetching}
								onClick={() => setPage(page + 1)}
							>
								Next
							</Button>
						</div>
					) : null}
				</CardPanel>
			</Card>
		</div>
	);
}
