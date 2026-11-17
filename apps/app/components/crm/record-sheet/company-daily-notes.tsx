"use client";
import { Button } from "@crm/ui/components/button";
import { NoteTimelineDay } from "@crm/ui/components/note-composer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { DailyNoteComposer, type DailyNoteDraft } from "./daily-note-composer";
import { NoteImages } from "./note-images";
import { NoteContent } from "./note-mention-editor";

function timestamp(value: string) {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Shanghai",
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
export function CompanyDailyNotes({ companyId }: { companyId: string }) {
	const trpc = useTRPC();
	const [reading, setReading] = useState(false);
	const client = useQueryClient();
	const options = trpc.companies.dailyNotes.queryOptions({ id: companyId });
	const notes = useQuery({ ...options, refetchInterval: 60_000 });
	const [draft, setDraft] = useState<DailyNoteDraft>({
		body: "",
		mentions: [],
		images: [],
	});
	const [requestId, setRequestId] = useState(() => crypto.randomUUID());
	const refresh = () =>
		client.invalidateQueries({ queryKey: options.queryKey });
	const add = useMutation(
		trpc.companies.addDailyNote.mutationOptions({
			onSuccess: async () => {
				setDraft({ body: "", mentions: [], images: [] });
				setRequestId(crypto.randomUUID());
				await refresh();
				toast.success("Note saved.");
			},
		}),
	);
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="shrink-0 border-b px-5 py-3">
				<form
					className="space-y-3"
					onSubmit={(event) => {
						event.preventDefault();
						if (
							reading ||
							add.isPending ||
							(!draft.body.trim() && !draft.images.length)
						)
							return;
						add.mutate({ companyId, requestId, ...draft });
					}}
				>
					<DailyNoteComposer
						onReading={setReading}
						label="New daily note"
						value={draft}
						onChange={setDraft}
						disabled={add.isPending || reading}
					/>
					{add.error ? <p role="alert">{add.error.message}</p> : null}
				</form>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
				{notes.isPending ? (
					<p className="py-4 text-sm text-muted-foreground">Loading notes…</p>
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
					<p className="py-4 text-sm text-muted-foreground">
						No daily notes yet.
					</p>
				) : null}
				{Array.from(
					Map.groupBy(notes.data ?? [], (note) =>
						new Intl.DateTimeFormat("en-GB", {
							timeZone: "Asia/Shanghai",
							dateStyle: "full",
						}).format(new Date(note.createdAt)),
					),
					([day, entries]) => (
						<NoteTimelineDay key={day} label={day}>
							{entries.map((note) => (
								<Note
									key={note.id}
									note={note}
									companyId={companyId}
									refresh={refresh}
								/>
							))}
						</NoteTimelineDay>
					),
				)}
			</div>
		</div>
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
	const [reading, setReading] = useState(false);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState<DailyNoteDraft>({
		body: note.body,
		mentions: note.mentions,
		images: note.images,
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
		<li className="space-y-2 py-3 text-sm">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="text-sm text-muted-foreground">
					Last updated by {note.updatedBy} · {timestamp(note.updatedAt)}
				</span>
				{!note.editable ? (
					<span
						role="img"
						aria-label="Locked note"
						title="Notes become read-only at midnight (Shanghai)"
					>
						🔒
					</span>
				) : null}
				{note.editable && !editing ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setDraft({
								body: note.body,
								mentions: note.mentions,
								images: note.images,
							});
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
						if (
							reading ||
							update.isPending ||
							(!draft.body.trim() && !draft.images.length)
						)
							return;
						update.mutate({ companyId, id: note.id, version, ...draft });
					}}
				>
					<DailyNoteComposer
						onReading={setReading}
						label="Edit daily note"
						submitLabel="Save changes"
						onCancel={() => setEditing(false)}
						value={draft}
						onChange={setDraft}
						disabled={update.isPending || reading}
					/>
				</form>
			) : (
				<div className="space-y-3">
					<NoteContent body={note.body} mentions={note.mentions} />
					<NoteImages images={note.images} />
				</div>
			)}
			{update.error ? <p role="alert">{update.error.message}</p> : null}
		</li>
	);
}
