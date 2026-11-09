"use client";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Switch } from "@crm/ui/components/switch";
import type { SavedViewFilters } from "@crm/validation/saved-view";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { FieldEntity } from "@/components/crm/fields/fields-entity";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import type { useColumnPreferences } from "./use-column-preferences";
import type { TableQuery } from "./use-table-query";

type SavedView = RouterOutputs["savedViews"]["list"][number];
function signature(view: SavedViewFilters) {
	return JSON.stringify({
		...view,
		filters: Object.fromEntries(
			Object.entries(view.filters)
				.filter(([, values]) => values.length > 0)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, values]) => [key, [...values].sort()]),
		),
	});
}

export function SavedViewsMenu({
	entity,
	table,
	columnPreferences,
}: {
	entity: FieldEntity;
	table: Pick<TableQuery<string, string>, "currentView" | "applyView">;
	columnPreferences?: ReturnType<typeof useColumnPreferences>;
}) {
	const trpc = useTRPC(),
		cache = useCrmCache();
	const params = useSearchParams();
	const views = useQuery(trpc.savedViews.list.queryOptions({ entity }));
	const defaultView = useQuery(
		trpc.savedViews.defaultView.queryOptions({ entity }),
	);
	const me = useQuery(trpc.users.me.queryOptions());
	const [selected, setSelected] = useState<string | null>(null),
		[open, setOpen] = useState(false),
		[editing, setEditing] = useState<string | null>(null),
		[name, setName] = useState(""),
		[shared, setShared] = useState(false);
	const initialized = useRef(false);
	const initial = useRef(signature(table.currentView));
	const current: SavedViewFilters = {
		...table.currentView,
		hiddenColumns: columnPreferences
			? (columnPreferences.hiddenColumns ?? [])
			: undefined,
		columnOrder: columnPreferences?.columnOrder,
	};
	const active = views.data?.find((view) => view.id === selected);
	const dirty = active
		? signature(current) !== signature(active.filters)
		: false;
	function apply(view: SavedView) {
		table.applyView(view.filters);
		if (columnPreferences && view.filters.hiddenColumns)
			columnPreferences.apply(
				view.filters.hiddenColumns,
				view.filters.columnOrder ?? [],
			);
		setSelected(view.id);
		initialized.current = true;
	}
	useEffect(() => {
		if (
			initialized.current ||
			defaultView.isPending ||
			columnPreferences?.loading
		)
			return;
		initialized.current = true;
		const explicit = [...params.keys()].some(
			(key) => !["record", "tab", "form"].includes(key),
		);
		if (
			!explicit &&
			signature(table.currentView) === initial.current &&
			defaultView.data
		)
			apply(defaultView.data);
	});
	const settle = () => cache.savedViews();
	const create = useMutation(
		trpc.savedViews.create.mutationOptions({
			onSuccess: async (view) => {
				await settle();
				setSelected(view.id);
				setOpen(false);
				toast.success("View saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const update = useMutation(
		trpc.savedViews.update.mutationOptions({
			onSuccess: async () => {
				await settle();
				setOpen(false);
				toast.success("View updated.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remove = useMutation(
		trpc.savedViews.delete.mutationOptions({
			onSuccess: async () => {
				await settle();
				setSelected(null);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const setDefault = useMutation(
		trpc.savedViews.setDefault.mutationOptions({
			onSuccess: async () => {
				await settle();
				toast.success("Default view updated.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const pending =
		create.isPending ||
		update.isPending ||
		remove.isPending ||
		setDefault.isPending;
	const saveAs = () => {
		initialized.current = true;
		setEditing(null);
		setName("");
		setShared(false);
		setOpen(true);
	};
	const preset = (
		label: string,
		filters: SavedViewFilters["filters"],
		sort = "field:cloud_registered_at",
	) => {
		initialized.current = true;
		setSelected(null);
		table.applyView({
			q: "",
			sort,
			dir: sort === "nextFollowUpAt" ? "asc" : "desc",
			archived: false,
			filters,
		});
		toast.success(`${label} applied.`);
	};
	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm" disabled={pending}>
						{active?.name ?? "Views"}
						{dirty ? " · Unsaved changes" : ""}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuGroup>
						<DropdownMenuItem onSelect={saveAs}>
							Save as new view…
						</DropdownMenuItem>
						{active?.mine ? (
							<>
								<DropdownMenuItem
									disabled={!dirty}
									onSelect={() =>
										update.mutate({ id: active.id, data: { filters: current } })
									}
								>
									Update current view
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => {
										setEditing(active.id);
										setName(active.name);
										setShared(active.shared);
										setOpen(true);
									}}
								>
									Rename or change sharing…
								</DropdownMenuItem>
								<DropdownMenuItem
									variant="destructive"
									onSelect={() => remove.mutate({ id: active.id })}
								>
									Delete current view
								</DropdownMenuItem>
							</>
						) : null}
						{active ? (
							<DropdownMenuItem
								onSelect={() => setDefault.mutate({ entity, id: active.id })}
							>
								Set as my default
							</DropdownMenuItem>
						) : null}
						{defaultView.data ? (
							<DropdownMenuItem
								onSelect={() => setDefault.mutate({ entity, id: null })}
							>
								Clear my default ({defaultView.data.name})
							</DropdownMenuItem>
						) : null}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					{entity === "COMPANY" ? (
						<DropdownMenuGroup>
							<DropdownMenuLabel>Quick views</DropdownMenuLabel>
							<DropdownMenuItem
								onSelect={() =>
									preset("My organizations", {
										owner: me.data ? [me.data.id] : [],
										favorites: ["all"],
									})
								}
								disabled={!me.data}
							>
								My organizations
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => preset("My favorites", { favorites: ["mine"] })}
							>
								My favorites
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									const day = new Date(Date.now() + 8 * 3600000 - 7 * 86400000)
										.toISOString()
										.slice(0, 10);
									preset("Recently registered", {
										"field:cloud_registered_at": [`min:${day}`],
										favorites: ["all"],
									});
								}}
							>
								Recently registered
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									preset(
										"With settled USD usage",
										{
											"field:cloud_settled_usage_mtd": ["min:0.0001"],
											favorites: ["all"],
										},
										"field:cloud_settled_usage_mtd",
									)
								}
							>
								With settled USD usage
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={!me.data}
								onSelect={() =>
									preset(
										"My follow-ups due",
										{
											owner: me.data ? [me.data.id] : [],
											followUpDue: ["due"],
											favorites: ["all"],
										},
										"nextFollowUp",
									)
								}
							>
								My follow-ups due
							</DropdownMenuItem>
							<DropdownMenuSeparator />
						</DropdownMenuGroup>
					) : null}
					<DropdownMenuGroup>
						<DropdownMenuLabel>Saved views</DropdownMenuLabel>
						{views.error ? (
							<DropdownMenuItem onSelect={() => views.refetch()}>
								Could not load views · Retry
							</DropdownMenuItem>
						) : null}
						{views.data?.map((view) => (
							<DropdownMenuItem key={view.id} onSelect={() => apply(view)}>
								{view.name}
								{view.id === defaultView.data?.id ? " · Default" : ""}
								{!view.mine ? " · Shared" : ""}
							</DropdownMenuItem>
						))}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			<Dialog
				open={open}
				onOpenChange={(value) => {
					if (!pending) setOpen(value);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editing ? "Edit view" : "Save this view"}
						</DialogTitle>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="saved-view-name">Name</FieldLabel>
							<Input
								id="saved-view-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								maxLength={120}
							/>
						</Field>
						<Field orientation="horizontal">
							<FieldLabel htmlFor="saved-view-shared">
								Share with the team
							</FieldLabel>
							<Switch
								id="saved-view-shared"
								checked={shared}
								onCheckedChange={setShared}
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button
							variant="outline"
							disabled={pending}
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button
							disabled={pending || !name.trim()}
							onClick={() =>
								editing
									? update.mutate({
											id: editing,
											data: { name: name.trim(), shared },
										})
									: create.mutate({
											entity,
											name: name.trim(),
											shared,
											filters: current,
										})
							}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
