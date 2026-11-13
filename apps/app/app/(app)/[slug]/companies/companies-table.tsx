"use client";

import Archive from "@carbon/icons-react/es/Archive";
import Star from "@carbon/icons-react/es/Star";
import StarFilled from "@carbon/icons-react/es/StarFilled";
import { Button } from "@crm/ui/components/button";
import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	EntityLogo,
	type EntityLogoTone,
} from "@crm/ui/components/entity-logo";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { EnrichmentIndicator } from "@/components/crm/enrichment-status";
import { useFieldColumns } from "@/components/crm/fields/field-columns";
import { useFieldFacets } from "@/components/crm/fields/field-facets";
import { OrganizationTypeTag } from "@/components/crm/organization-type-tag";
import { OwnerCell } from "@/components/crm/owner-cell";
import { FOLLOW_UP_LABELS } from "@/components/crm/record-sheet/company-follow-up";
import { usePrefetchRecord } from "@/components/crm/record-sheet/record-prefetch";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { AssigneeFilter } from "@/components/data-table/assignee-filter";
import { ListSearch } from "@/components/data-table/list-search";
import { SavedViewsMenu } from "@/components/data-table/saved-views-menu";
import { useColumnPreferences } from "@/components/data-table/use-column-preferences";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { ACTIVITY_FACET_OPTIONS } from "@/lib/activity-recency";
import {
	ENRICHMENT_FACET_OPTIONS,
	ENRICHMENT_POLL_MS,
	isEnriching,
} from "@/lib/enrichment-status";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { CompaniesBulkActions } from "./companies-bulk-actions";
import { companiesSearchParams } from "./companies-search-params";

type CompanyRow = RouterOutputs["companies"]["list"]["rows"][number];

const COLUMNS: DataTableColumn<CompanyRow>[] = [
	{
		id: "followUpStatus",
		header: "Follow-up",
		sortable: true,
		width: "w-[12%]",
		cell: (row) =>
			FOLLOW_UP_LABELS[row.followUpStatus as keyof typeof FOLLOW_UP_LABELS] ??
			row.followUpStatus,
	},
	{
		id: "nextFollowUp",
		header: "Next follow-up",
		sortable: true,
		width: "w-[12%]",
		cell: (row) => row.nextFollowUp ?? "—",
	},
	{
		id: "name",
		header: "Cloud organization",
		sortable: true,
		hideable: false,
		width: "w-[26%]",
		cell: (row) => (
			<span className="flex min-w-0 items-center gap-2.5">
				<EntityLogo
					src={row.iconUrl ?? row.logoUrl}
					darkSrc={row.iconDarkUrl}
					tone={row.iconTone as EntityLogoTone | null | undefined}
					name={row.name}
					size="sm"
				/>
				<span className="flex min-w-0 flex-col">
					<span className="flex min-w-0 items-center gap-2">
						<span className="truncate font-medium" title={row.name}>
							{row.name}
						</span>
						<OrganizationTypeTag
							companyId={row.id}
							value={row.fields.organization_type}
						/>
					</span>
					<span
						className="truncate text-xs text-muted-foreground"
						title={
							row.email ?? String(row.fields.cloud_organization_id ?? row.id)
						}
					>
						{row.email ?? String(row.fields.cloud_organization_id ?? row.id)}
					</span>
				</span>
			</span>
		),
	},
	{
		id: "domain",
		header: "Domain",
		sortable: true,
		width: "w-[16%]",
		hideBelow: "md",
		cell: (row) =>
			row.domain ? (
				<span className="truncate text-muted-foreground">{row.domain}</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "industry",
		header: "Industry",
		sortable: true,
		width: "w-[16%]",
		hideBelow: "lg",
		cell: (row) =>
			row.industry ? (
				<span className="truncate">{row.industry}</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "owner",
		header: "Owner",
		sortable: true,
		width: "w-[16%]",
		hideBelow: "md",
		cell: (row) => <OwnerCell owner={row.owner} />,
	},
	{
		id: "contacts",
		header: "Inbound users",
		sortable: true,
		align: "right",
		width: "w-[9%]",
		hideBelow: "lg",
		cell: (row) => <span className="tabular-nums">{row.contactCount}</span>,
	},
	{
		id: "lastActivity",
		header: "Last activity",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "sm",
		cell: (row) => (
			<span className="text-muted-foreground">
				{row.lastActivityAt ? (
					<LocalRelativeTime date={row.lastActivityAt} />
				) : (
					<EmptyCellValue />
				)}
			</span>
		),
	},
	{
		id: "enrichment",
		header: "Enrichment",
		label: "Enrichment status",
		defaultHidden: true,
		width: "w-[14%]",
		cell: (row) => (
			<EnrichmentIndicator status={row.enrichmentStatus} queued={row.queued} />
		),
	},
];

const ARCHIVED_COLUMN: DataTableColumn<CompanyRow> = {
	id: "archivedAt",
	header: "Archived",
	label: "Archived date",
	sortable: true,
	align: "right",
	width: "w-[12%]",
	cell: (row) => (
		<span className="text-muted-foreground">
			{row.archivedAt ? (
				<LocalRelativeTime date={row.archivedAt} />
			) : (
				<EmptyCellValue />
			)}
		</span>
	),
};

export function CompaniesTable() {
	const openRecord = useOpenRecord();
	const trpc = useTRPC();
	const columnPreferences = useColumnPreferences("companies");
	const client = useQueryClient();
	const favorite = useMutation(
		trpc.users.setCompanyFavorite.mutationOptions({
			onSuccess: () =>
				client.invalidateQueries({ queryKey: trpc.companies.list.queryKey() }),
			onError: (error) => toast.error(error.message),
		}),
	);
	const prefetchRecord = usePrefetchRecord();
	const table = useTableQuery(companiesSearchParams);
	const { query, input, setArchived } = table;

	const companies = useQuery({
		...trpc.companies.list.queryOptions(input),
		placeholderData: (previous) => previous,
		refetchInterval: (query) =>
			query.state.data?.rows.some((row) =>
				isEnriching(row.enrichmentStatus, row.queued),
			)
				? ENRICHMENT_POLL_MS
				: false,
	});
	const users = useQuery(trpc.users.list.queryOptions());

	const rows = companies.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	const facetCounts = companies.data?.facetCounts;
	const fieldFacets = useFieldFacets("COMPANY", facetCounts);

	const facets: DataTableFacet[] = [
		{
			id: "followUpStatus",
			label: "Follow-up status",
			options: Object.entries(FOLLOW_UP_LABELS).map(([value, label]) => ({
				value,
				label,
			})),
		},
		{
			id: "followUpDue",
			label: "Follow-up due",
			options: [
				{ value: "due", label: "Due today or overdue" },
				{ value: "overdue", label: "Overdue" },
				{ value: "unscheduled", label: "Not scheduled" },
			],
		},
		{
			id: "owner",
			label: "Owner",
			options: [
				{ value: "unassigned", label: "Unassigned" },
				...(users.data ?? []).map((user) => ({
					value: user.id,
					label: user.name,
				})),
			].filter((option) => (facetCounts?.owner?.[option.value] ?? 0) > 0),
		},
		{
			id: "industry",
			label: "Industry",
			options: Object.keys(facetCounts?.industry ?? {})
				.sort()
				.map((value) => ({ value, label: value })),
		},
		{
			id: "enrichment",
			label: "Enrichment",
			options: ENRICHMENT_FACET_OPTIONS.filter(
				(option) => (facetCounts?.enrichment?.[option.value] ?? 0) > 0,
			),
		},
		{
			id: "activity",
			label: "Activity",
			options: ACTIVITY_FACET_OPTIONS.filter(
				(option) => (facetCounts?.activity?.[option.value] ?? 0) > 0,
			),
		},
		...fieldFacets,
	];

	const fieldColumns = useFieldColumns<CompanyRow>("COMPANY");
	const columns = useMemo(
		() =>
			input.archived
				? [...COLUMNS, ARCHIVED_COLUMN, ...fieldColumns]
				: [
						...COLUMNS.filter((c) => c.id === "name"),
						...fieldColumns.filter((c) =>
							[
								"field:cloud_settled_usage_mtd",
								"field:cloud_box_count",
								"field:cloud_registered_at",
							].includes(c.id),
						),
						...COLUMNS.filter((c) => c.id !== "name"),
						...fieldColumns.filter(
							(c) =>
								![
									"field:cloud_settled_usage_mtd",
									"field:cloud_box_count",
									"field:cloud_registered_at",
								].includes(c.id),
						),
					],
		[fieldColumns, input.archived],
	);

	return (
		<DataTable
			columnPreferences={columnPreferences}
			query={query}
			search={
				<ListSearch placeholder="Search name, email or Cloud organization ID…" />
			}
			actions={
				<>
					<AssigneeFilter query={query} onChange={selection.clear} />
					<Button
						variant={query.tab === "mine" ? "contrast" : "outline"}
						size="sm"
						aria-pressed={query.tab === "mine"}
						onClick={() => {
							selection.clear();
							query.setTab(query.tab === "mine" ? "all" : "mine");
						}}
					>
						<Star data-icon="inline-start" />
						My favorites
					</Button>
					<SavedViewsMenu
						entity="COMPANY"
						table={table}
						columnPreferences={columnPreferences}
					/>
					<Button
						variant={input.archived ? "contrast" : "outline"}
						size="sm"
						className="justify-start sm:justify-center"
						onClick={() => setArchived(!input.archived)}
					>
						<Archive data-icon="inline-start" />
						Archived
					</Button>
				</>
			}
			columns={[
				{
					id: "favorite",
					header: "Favorite",
					hideable: false,
					width: "w-12",
					cell: (row) => (
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={`${row.isFavorite ? "Unfavorite" : "Favorite"} ${row.name}`}
							aria-pressed={row.isFavorite}
							disabled={favorite.isPending}
							onClick={(event) => {
								event.stopPropagation();
								favorite.mutate({
									companyId: row.id,
									favorite: !row.isFavorite,
								});
							}}
						>
							{row.isFavorite ? <StarFilled /> : <Star />}
						</Button>
					),
				},
				...columns.map((column) =>
					column.id === "contacts"
						? {
								...column,
								cell: (row: CompanyRow) => (
									<Button
										variant="ghost"
										size="sm"
										aria-label={`Open inbound users for ${row.name}`}
										onClick={(event) => {
											event.stopPropagation();
											openRecord({ kind: "company", id: row.id }, "contacts");
										}}
									>
										{row.contactCount}
									</Button>
								),
							}
						: column,
				),
			]}
			rows={rows}
			total={companies.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			selection={{
				state: selection,
				actions: (
					<CompaniesBulkActions
						ids={selection.ids}
						onDone={selection.clear}
						archived={input.archived}
					/>
				),
				rowLabel: (row) => row.name,
			}}
			getRowId={(row) => row.id}
			loading={companies.isFetching}
			onRowHover={(row) => prefetchRecord({ kind: "company", id: row.id })}
			onRowClick={(row) => openRecord({ kind: "company", id: row.id })}
			empty={
				input.archived
					? "No archived companies."
					: "No companies match this view."
			}
		/>
	);
}
