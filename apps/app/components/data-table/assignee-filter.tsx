"use client";
import CheckIcon from "@carbon/icons-react/es/Checkmark";
import ChevronDownIcon from "@carbon/icons-react/es/ChevronDown";
import { Button } from "@crm/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@crm/ui/components/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import type { TableQueryState } from "@crm/ui/lib/table-query";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function AssigneeFilter({
	query,
	onChange,
}: {
	query: TableQueryState;
	onChange: () => void;
}) {
	const trpc = useTRPC();
	const users = useQuery(trpc.users.list.queryOptions());
	const me = useQuery(trpc.users.me.queryOptions());
	const selected = query.filters.owner ?? [];
	const set = (ids: string[]) => {
		onChange();
		query.setFilter("owner", ids);
	};
	const label =
		selected.length === 1
			? (users.data?.find((user) => user.id === selected[0])?.name ??
				"Unassigned")
			: selected.length
				? `${selected.length} selected`
				: "All";
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant={selected.length ? "contrast" : "outline"} size="sm">
					Assignee: {label}
					<ChevronDownIcon />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start">
				<Command>
					<CommandInput placeholder="Search team members…" />
					<CommandList>
						<CommandEmpty>
							{users.isPending
								? "Loading team members…"
								: "No matching team members."}
						</CommandEmpty>
						<CommandGroup>
							<CommandItem value="All assignees" onSelect={() => set([])}>
								All assignees
							</CommandItem>
							{me.data ? (
								<CommandItem
									value="Assigned to me"
									onSelect={() => set([me.data.id])}
								>
									Me
								</CommandItem>
							) : null}
							<CommandItem
								value="Unassigned"
								onSelect={() =>
									set(
										selected.includes("unassigned")
											? selected.filter((id) => id !== "unassigned")
											: [...selected, "unassigned"],
									)
								}
							>
								{selected.includes("unassigned") ? <CheckIcon /> : null}
								Unassigned
							</CommandItem>
							{users.data?.map((user) => (
								<CommandItem
									key={user.id}
									value={`${user.name} ${user.email}`}
									onSelect={() =>
										set(
											selected.includes(user.id)
												? selected.filter((id) => id !== user.id)
												: [...selected, user.id],
										)
									}
								>
									{selected.includes(user.id) ? <CheckIcon /> : null}
									<span>
										{user.name}
										<span className="block text-xs text-muted-foreground">
											{user.email}
										</span>
									</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
				{users.error ? (
					<p role="alert">
						Could not load team members.{" "}
						<Button variant="link" onClick={() => users.refetch()}>
							Retry
						</Button>
					</p>
				) : null}
			</PopoverContent>
		</Popover>
	);
}
