"use client";

import InfoIcon from "@carbon/icons-react/es/Information";
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
import { MetricCard } from "@crm/ui/components/stat-card";
import { TableCell } from "@crm/ui/components/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, parseAsNumberLiteral, useQueryStates } from "nuqs";
import { useState } from "react";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { useTRPC } from "@/lib/trpc/client";
import { CloudOrganizationsDialog } from "./cloud-organizations-dialog";

const COLUMNS = [
	{ id: "name", header: "Name" },
	{ id: "email", header: "Email" },
	{ id: "organization", header: "Cloud organization" },
	{ id: "source", header: "Source" },
];

export function CloudOverview() {
	const trpc = useTRPC();
	const [organizationScope, setOrganizationScope] = useState<
		"all" | "active" | "inactive" | "unknown" | null
	>(null);
	const [{ inboundPage: rawPage, days }, setWindow] = useQueryStates({
		inboundPage: parseAsInteger.withDefault(1),
		days: parseAsNumberLiteral([1, 7, 15] as const).withDefault(1),
	});
	const setPage = (inboundPage: number) => setWindow({ inboundPage });
	const page = Math.max(1, Math.min(100000, rawPage));
	const query = useQuery({
		...trpc.dashboard.cloudOverview.queryOptions({ page, days }),
		refetchInterval: (q) =>
			q.state.data?.pendingMemberships ||
			q.state.data?.metricsStatus === "PENDING"
				? 30000
				: false,
	});
	const label = days === 1 ? "Yesterday" : `Last ${days} days`;

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
			<div className="flex flex-wrap items-center justify-between gap-3">
				<fieldset
					className="flex flex-wrap gap-2"
					aria-label="Statistics window"
				>
					{([1, 7, 15] as const).map((value) => (
						<Button
							key={value}
							size="sm"
							variant={days === value ? "contrast" : "outline"}
							aria-pressed={days === value}
							onClick={() => setWindow({ days: value, inboundPage: 1 })}
						>
							{value === 1 ? "Yesterday" : `Last ${value} days`}
						</Button>
					))}
				</fieldset>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							aria-label="Reporting window and sync time"
						>
							<InfoIcon />
							{summary.date} –{" "}
							{new Date(new Date(summary.to).getTime() - 1).toLocaleDateString(
								"en-CA",
								{ timeZone: summary.timezone },
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						Complete calendar days · UTC+8. Updated{" "}
						{summary.syncedAt
							? new Date(summary.syncedAt).toLocaleString("en-GB", {
									timeZone: summary.timezone,
								})
							: "not yet"}
						. Box activity can be unconfirmed when history is incomplete.
					</TooltipContent>
				</Tooltip>
			</div>
			{organizationScope ? (
				<CloudOrganizationsDialog
					key={`${summary.date}:${days}`}
					date={summary.date}
					days={days}
					scope={organizationScope}
					onClose={() => setOrganizationScope(null)}
				/>
			) : null}
			<DashboardGrid columns={2}>
				<MetricCard
					label="New Cloud organizations"
					value={summary.newCloudUsers ?? "—"}
					description={label}
					disabled={summary.newCloudUsers === null}
					onClick={() => setOrganizationScope("all")}
				/>
				<MetricCard
					label="Box activation"
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
							? "Awaiting sync"
							: `${summary.createdBoxUsers} / ${summary.newCloudUsers} organizations · ${summary.unknownOrganizations} unconfirmed`
					}
					disabled={summary.newCloudUsers === null}
					onClick={() => setOrganizationScope("active")}
				/>
			</DashboardGrid>
			<Card>
				<CardHeader>
					<CardTitle>New inbound users · {label}</CardTitle>
					<CardDescription>
						{summary.total} users
						{summary.pendingMemberships > 0
							? ` · ${summary.pendingMemberships} organizations syncing`
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
									: "No inbound users linked to new organizations in this window."
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
