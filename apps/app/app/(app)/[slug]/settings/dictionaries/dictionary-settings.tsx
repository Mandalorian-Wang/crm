"use client";

import { Button } from "@crm/ui/components/button";
import { ColorTag } from "@crm/ui/components/color-tag";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@crm/ui/components/tabs";
import {
	ORGANIZATION_DICTIONARIES,
	type OrganizationDictionaryKey,
	TAG_COLORS,
	type tagColor,
} from "@crm/validation/organization-type";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Option =
	RouterOutputs["dictionaries"]["organizationTypes"]["options"][number];

function TypeEditor({
	dictionaryKey,
	option,
	onDone,
}: {
	dictionaryKey: OrganizationDictionaryKey;
	option?: Option;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [label, setLabel] = useState(option?.label ?? "");
	const [color, setColor] = useState<z.infer<typeof tagColor>>(
		option?.color ?? "blue",
	);
	const save = useMutation(
		trpc.dictionaries.saveOrganizationType.mutationOptions({
			onSuccess: async () => {
				await cache.organizationTypes();
				toast.success(option ? "Option updated" : "Option added");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	return (
		<form
			className="space-y-4 rounded-lg border p-4"
			onSubmit={(event) => {
				event.preventDefault();
				save.mutate({
					key: dictionaryKey,
					id: option?.id,
					label,
					color,
					archived: option?.archived ?? false,
				});
			}}
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="type-name">Option name</Label>
					<Input
						id="type-name"
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						required
						maxLength={40}
						autoFocus
						placeholder="e.g. Startup"
						disabled={save.isPending}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="type-color">Color</Label>
					<Select
						value={color}
						onValueChange={(value) =>
							setColor(value as z.infer<typeof tagColor>)
						}
						disabled={save.isPending}
					>
						<SelectTrigger id="type-color">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{TAG_COLORS.map((tone) => (
								<SelectItem key={tone} value={tone}>
									<ColorTag color={tone}>
										<span>
											{tone[0]?.toUpperCase()}
											{tone.slice(1)}
										</span>
									</ColorTag>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<span className="text-sm text-muted-foreground">Preview</span>
					<ColorTag color={color}>
						<span>{label.trim() || "Organization type"}</span>
					</ColorTag>
				</div>
				<div className="flex gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={onDone}
						disabled={save.isPending}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={!label.trim() || save.isPending}>
						{save.isPending ? "Saving…" : "Save option"}
					</Button>
				</div>
			</div>
		</form>
	);
}

function DictionaryPanel({
	dictionary,
}: {
	dictionary: (typeof ORGANIZATION_DICTIONARIES)[number];
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const query = useQuery(
		trpc.dictionaries.organizationTypes.queryOptions({ key: dictionary.key }),
	);
	const [editing, setEditing] = useState<string | null>(null);
	const [showInactive, setShowInactive] = useState(false);
	const save = useMutation(
		trpc.dictionaries.saveOrganizationType.mutationOptions({
			onSuccess: async () => {
				await cache.organizationTypes();
				toast.success("Option updated");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	if (query.isPending) return <Spinner />;
	if (query.isError)
		return (
			<div role="alert">
				<p>Could not load dictionaries.</p>
				<Button variant="outline" onClick={() => query.refetch()}>
					Retry
				</Button>
			</div>
		);
	const { options, canManage } = query.data;
	const visible = options.filter((option) => showInactive || !option.archived);
	return (
		<section className="max-w-3xl space-y-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold">{dictionary.label}</h2>
					<p className="text-sm text-muted-foreground">
						{dictionary.description}
					</p>
				</div>
				{canManage ? (
					<Button onClick={() => setEditing("new")} disabled={editing !== null}>
						Add option
					</Button>
				) : null}
			</div>
			{!canManage ? (
				<p className="text-sm text-muted-foreground">
					Join the CRM team to edit this dictionary.
				</p>
			) : null}
			{editing !== null ? (
				<TypeEditor
					dictionaryKey={dictionary.key}
					key={editing}
					option={options.find((option) => option.id === editing)}
					onDone={() => setEditing(null)}
				/>
			) : null}
			{options.some((option) => option.archived) ? (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setShowInactive(!showInactive)}
				>
					{showInactive ? "Hide inactive options" : "Show inactive options"}
				</Button>
			) : null}
			{visible.length === 0 ? (
				<div className="rounded-lg border border-dashed p-6">
					<p className="font-medium">No options yet</p>
					<p className="text-sm text-muted-foreground">
						Add an option, then select it in an organization’s details.
					</p>
				</div>
			) : (
				<div className="divide-y rounded-lg border">
					{visible.map((option) => (
						<div
							key={option.id}
							className="flex flex-wrap items-center justify-between gap-3 p-4"
						>
							<div className="flex items-center gap-2">
								<ColorTag color={option.color}>
									<span>{option.label}</span>
								</ColorTag>
								{option.archived ? (
									<span className="text-xs text-muted-foreground">
										Inactive
									</span>
								) : null}
							</div>
							{canManage ? (
								<div className="flex gap-2">
									<Button
										variant="ghost"
										size="sm"
										disabled={save.isPending || editing !== null}
										onClick={() => setEditing(option.id)}
										aria-label={`Edit ${option.label}`}
									>
										Edit
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={save.isPending || editing !== null}
										onClick={() =>
											save.mutate({
												key: dictionary.key,
												...option,
												archived: !option.archived,
											})
										}
										aria-label={`${option.archived ? "Restore" : "Deactivate"} ${option.label}`}
									>
										{option.archived ? "Restore" : "Deactivate"}
									</Button>
								</div>
							) : null}
						</div>
					))}
				</div>
			)}
			<p className="text-sm text-muted-foreground">
				Deactivated options stay on existing organizations and cannot be
				selected again until restored.
			</p>
		</section>
	);
}

export function DictionarySettings() {
	return (
		<Tabs defaultValue="organization_type">
			<div className="max-w-full overflow-x-auto">
				<TabsList>
					{ORGANIZATION_DICTIONARIES.map((dictionary) => (
						<TabsTrigger key={dictionary.key} value={dictionary.key}>
							{dictionary.label}
						</TabsTrigger>
					))}
				</TabsList>
			</div>
			{ORGANIZATION_DICTIONARIES.map((dictionary) => (
				<TabsContent key={dictionary.key} value={dictionary.key}>
					<DictionaryPanel dictionary={dictionary} />
				</TabsContent>
			))}
		</Tabs>
	);
}
