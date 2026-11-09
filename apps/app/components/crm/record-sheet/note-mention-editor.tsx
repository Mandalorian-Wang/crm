"use client";
import { Button } from "@crm/ui/components/button";
import { Textarea } from "@crm/ui/components/textarea";
import {
	adjustNoteMentions,
	type NoteMention,
} from "@crm/validation/daily-note";
import { useQuery } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

export type NoteDraft = { body: string; mentions: NoteMention[] };
export function NoteMentionEditor({
	value,
	onChange,
	label,
	disabled,
}: {
	value: NoteDraft;
	onChange: (value: NoteDraft) => void;
	label: string;
	disabled: boolean;
}) {
	const trpc = useTRPC();
	const editor = useRef<HTMLTextAreaElement>(null);
	const listId = useId();
	const [cursor, setCursor] = useState(0);
	const [dismissed, setDismissed] = useState(false);
	const [selected, setSelected] = useState(0);
	const prefix = value.body.slice(0, cursor);
	const match = /(?:^|\s)@([^@\n]{0,60})$/.exec(prefix);
	const inside = value.mentions.some(
		(mention) => cursor > mention.start && cursor <= mention.end,
	);
	const open = Boolean(match) && !inside && !dismissed && !disabled;
	const members = useQuery({
		...trpc.users.list.queryOptions(),
		enabled: open,
		staleTime: 300000,
	});
	const term = (match?.[1] ?? "").toLowerCase();
	const results = (members.data ?? [])
		.filter((member) =>
			`${member.name} ${member.email}`.toLowerCase().includes(term),
		)
		.slice(0, 8);
	const choose = (member: (typeof results)[number]) => {
		const start = cursor - (match?.[1]?.length ?? 0) - 1;
		const name = member.name;
		const text = `@${name}`;
		const body = `${value.body.slice(0, start)}${text} ${value.body.slice(cursor)}`;
		const mentions = adjustNoteMentions(value.body, body, value.mentions);
		mentions.push({ id: member.id, name, start, end: start + text.length });
		onChange({ body, mentions: mentions.sort((a, b) => a.start - b.start) });
		setDismissed(true);
		requestAnimationFrame(() => {
			editor.current?.focus();
			editor.current?.setSelectionRange(
				start + text.length + 1,
				start + text.length + 1,
			);
		});
	};
	return (
		<div className="relative space-y-2">
			<Textarea
				ref={editor}
				aria-label={label}
				aria-autocomplete="list"
				aria-controls={open ? listId : undefined}
				aria-activedescendant={
					open && results[selected] ? `${listId}-${selected}` : undefined
				}
				placeholder="Write a note… Type @ to mention a team member"
				value={value.body}
				maxLength={20000}
				disabled={disabled}
				onChange={(event) => {
					const body = event.target.value;
					onChange({
						body,
						mentions: adjustNoteMentions(value.body, body, value.mentions),
					});
					setCursor(event.target.selectionStart);
					setDismissed(false);
					setSelected(0);
				}}
				onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
				onKeyDown={(event) => {
					if (!open) return;
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						setDismissed(true);
					} else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault();
						setSelected((index) =>
							Math.max(
								0,
								Math.min(
									results.length - 1,
									index + (event.key === "ArrowDown" ? 1 : -1),
								),
							),
						);
					} else if (event.key === "Enter" && results[selected]) {
						event.preventDefault();
						choose(results[selected]);
					}
				}}
			/>
			{open ? (
				<div className="rounded-lg border bg-popover p-2 shadow-sm">
					{members.isPending ? (
						<p className="p-2 text-sm text-muted-foreground">
							Loading team members…
						</p>
					) : null}
					{members.error ? (
						<p role="alert" className="p-2 text-sm">
							Could not load team members.{" "}
							<Button
								type="button"
								variant="link"
								onClick={() => members.refetch()}
							>
								Retry
							</Button>
						</p>
					) : null}
					{!members.isPending && !members.error && !results.length ? (
						<p className="p-2 text-sm text-muted-foreground">
							No matching team members.
						</p>
					) : null}
					<div
						id={listId}
						role="listbox"
						aria-label="team members"
						className="flex flex-col items-start"
					>
						{results.map((member, index) => (
							<Button
								key={member.id}
								id={`${listId}-${index}`}
								type="button"
								role="option"
								aria-selected={index === selected}
								variant={index === selected ? "secondary" : "ghost"}
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => choose(member)}
							>
								{member.name}{" "}
								<span className="text-muted-foreground">{member.email}</span>
							</Button>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}
export function NoteContent({
	body,
	mentions,
}: {
	body: string;
	mentions: NoteMention[];
}) {
	let cursor = 0;
	const parts = mentions.flatMap((mention) => {
		const preceding = body.slice(cursor, mention.start);
		cursor = mention.end;
		return [
			preceding,
			<span
				key={`${mention.start}:${mention.id}`}
				className="font-medium text-primary"
				title={`team member: ${mention.name}`}
			>
				{body.slice(mention.start, mention.end)}
			</span>,
		];
	});
	return (
		<p className="whitespace-pre-wrap break-words">
			{parts}
			{body.slice(cursor)}
		</p>
	);
}
