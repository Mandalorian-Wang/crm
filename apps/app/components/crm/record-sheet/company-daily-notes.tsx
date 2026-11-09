"use client";
import { Button } from "@crm/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
	DetailSheetBody,
	DetailSheetMain,
	DetailSheetProse,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	NoteContent,
	type NoteDraft,
	NoteMentionEditor,
} from "./note-mention-editor";

function timestamp(value: string) {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Shanghai",
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
export function CompanyDailyNotes({ companyId }: { companyId: string }) {
	const trpc = useTRPC();
	const client = useQueryClient();
	const options = trpc.companies.dailyNotes.queryOptions({ id: companyId });
	const notes = useQuery({ ...options, refetchInterval: 60_000 });
	const [draft, setDraft] = useState<NoteDraft>({ body: "", mentions: [] });
	const [requestId, setRequestId] = useState(() => crypto.randomUUID());
	const refresh = () =>
		client.invalidateQueries({ queryKey: options.queryKey });
	const add = useMutation(
		trpc.companies.addDailyNote.mutationOptions({
			onSuccess: async () => {
				setDraft({ body: "", mentions: [] });
				setRequestId(crypto.randomUUID());
				await refresh();
				toast.success("Note saved.");
			},
		}),
	);
	return (
		<DetailSheetBody>
			<DetailSheetMain>
				<DetailSheetSection title="Daily note">
					<DetailSheetProse>
						Append notes throughout the day. Notes become read-only at midnight,
						Beijing time (UTC+8). Newest notes appear first.
					</DetailSheetProse>
					<form
						className="space-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							add.mutate({ companyId, requestId, ...draft });
						}}
					>
						<NoteMentionEditor
							label="New daily note"
							value={draft}
							onChange={setDraft}
							disabled={add.isPending}
						/>
						{add.error ? <p role="alert">{add.error.message}</p> : null}
						<Button
							type="submit"
							disabled={!draft.body.trim() || add.isPending}
						>
							{add.isPending ? "Saving…" : "Add note"}
						</Button>
					</form>
					{notes.isPending ? (
						<DetailSheetProse>Loading notes…</DetailSheetProse>
					) : null}
					{notes.error ? (
						<div role="alert">
							{notes.error.message}
							<Button variant="outline" onClick={() => notes.refetch()}>
								Retry
							</Button>
						</div>
					) : null}
					{notes.data?.length === 0 ? (
						<DetailSheetProse>No daily notes yet.</DetailSheetProse>
					) : null}
					<ol className="space-y-6">
						{notes.data?.map((note) => (
							<Note
								key={note.id}
								note={note}
								companyId={companyId}
								refresh={refresh}
							/>
						))}
					</ol>
				</DetailSheetSection>
			</DetailSheetMain>
		</DetailSheetBody>
	);
}
function Note({
	note,
	companyId,
	refresh,
}: {
	note: RouterOutputs["companies"]["dailyNotes"][number];
	companyId: string;
	refresh: () => Promise<void>;
}) {
	const trpc = useTRPC();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState<NoteDraft>({
		body: note.body,
		mentions: note.mentions,
	});
	const [version, setVersion] = useState(note.version);
	const update = useMutation(
		trpc.companies.updateDailyNote.mutationOptions({
			onSuccess: async () => {
				setEditing(false);
				await refresh();
				toast.success("Note updated.");
			},
			onError: () => {
				void refresh();
			},
		}),
	);
	return (
		<li className="space-y-3 border-t pt-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="text-sm text-muted-foreground">
					{timestamp(note.createdAt)} · {note.editable ? "Today" : "Read-only"}
				</span>
				{note.editable && !editing ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setDraft({ body: note.body, mentions: note.mentions });
							setVersion(note.version);
							setEditing(true);
							update.reset();
						}}
					>
						Edit
					</Button>
				) : null}
			</div>
			{editing && note.editable ? (
				<form
					className="space-y-3"
					onSubmit={(event) => {
						event.preventDefault();
						update.mutate({ companyId, id: note.id, version, ...draft });
					}}
				>
					<NoteMentionEditor
						label="Edit daily note"
						value={draft}
						onChange={setDraft}
						disabled={update.isPending}
					/>
					<div className="flex gap-2">
						<Button
							type="submit"
							disabled={!draft.body.trim() || update.isPending}
						>
							Save changes
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={update.isPending}
							onClick={() => setEditing(false)}
						>
							Cancel
						</Button>
					</div>
				</form>
			) : (
				<NoteContent body={note.body} mentions={note.mentions} />
			)}
			{update.error ? <p role="alert">{update.error.message}</p> : null}
			<p className="text-xs text-muted-foreground">
				Last updated by {note.updatedBy} · {timestamp(note.updatedAt)} (UTC+8)
			</p>
		</li>
	);
}
