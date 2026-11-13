"use client";

import { ColorTag } from "@crm/ui/components/color-tag";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function OrganizationTypeTag({
	companyId,
	value,
}: {
	companyId: string;
	value: unknown;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const workspaceUrl = useWorkspaceUrl();
	const query = useQuery(trpc.dictionaries.organizationTypes.queryOptions());
	const update = useMutation(
		trpc.companies.update.mutationOptions({
			onSuccess: () => cache.company(companyId),
			onError: (error) => toast.error(error.message),
		}),
	);
	const selected = query.data?.options.find((option) => option.id === value);
	const active = query.data?.options.filter((option) => !option.archived) ?? [];
	return (
		<span>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<ColorTag asChild color={selected?.color}>
						<button
							type="button"
							onClick={(event) => event.stopPropagation()}
							onKeyDown={(event) => event.stopPropagation()}
							disabled={query.isPending || update.isPending || query.isError}
							aria-label={`Organization type: ${selected?.label ?? "Not set"}`}
							title={
								query.isError
									? "Could not load organization types"
									: selected?.archived
										? "This type is inactive. Select another type to replace it."
										: "Change organization type"
							}
						>
							<span>
								{update.isPending
									? "Saving…"
									: selected
										? `${selected.label}${selected.archived ? " · inactive" : ""}`
										: "+ Type"}
							</span>
						</button>
					</ColorTag>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					onClick={(event) => event.stopPropagation()}
					onKeyDown={(event) => event.stopPropagation()}
				>
					<DropdownMenuRadioGroup
						value={typeof value === "string" ? value : "none"}
						onValueChange={(next) =>
							update.mutate({
								id: companyId,
								data: {
									fields: { organization_type: next === "none" ? null : next },
								},
							})
						}
					>
						<DropdownMenuRadioItem value="none">No type</DropdownMenuRadioItem>
						{active.map((option) => (
							<DropdownMenuRadioItem key={option.id} value={option.id}>
								<ColorTag color={option.color}>
									<span>{option.label}</span>
								</ColorTag>
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
					{active.length === 0 ? (
						<DropdownMenuItem disabled>No types configured</DropdownMenuItem>
					) : null}
					<DropdownMenuSeparator />
					<DropdownMenuItem asChild>
						<Link href={workspaceUrl("/settings/dictionaries")}>
							Manage types
						</Link>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</span>
	);
}
