"use client";
import { Button } from "@crm/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
	DetailSheetBody,
	DetailSheetMain,
	DetailSheetProse,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

export const FOLLOW_UP_LABELS = {
	NOT_CONTACTED: "Not contacted",
	CONTACTED: "Contacted",
	WAITING: "Waiting for reply",
	COMPLETED: "Completed",
} as const;
type Status = keyof typeof FOLLOW_UP_LABELS;
export function FollowUpSelect({
	value,
	onChange,
	disabled,
}: {
	value: Status;
	onChange: (value: Status) => void;
	disabled?: boolean;
}) {
	return (
		<Select
			value={value}
			onValueChange={(value) => {
				if (value in FOLLOW_UP_LABELS) onChange(value as Status);
			}}
			disabled={disabled}
		>
			<SelectTrigger aria-label="Follow-up status">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					{Object.entries(FOLLOW_UP_LABELS).map(([value, label]) => (
						<SelectItem key={value} value={value}>
							{label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}
export function CompanyFollowUp({
	companyId,
	contacts,
}: {
	companyId: string;
	contacts: { id: string; firstName: string; lastName: string | null }[];
}) {
	const trpc = useTRPC();
	const query = useQuery(
		trpc.companies.followUp.queryOptions({ id: companyId }),
	);
	return (
		<DetailSheetBody>
			<DetailSheetMain>
				{query.error ? (
					<DetailSheetProse>
						{query.error.message}
						<Button onClick={() => query.refetch()}>Retry</Button>
					</DetailSheetProse>
				) : null}
				{query.data ? (
					<FollowUpEditor
						key={`${companyId}:${query.data.status}:${query.data.nextFollowUp}`}
						companyId={companyId}
						contacts={contacts}
						data={query.data}
					/>
				) : (
					<DetailSheetProse>Loading follow-up…</DetailSheetProse>
				)}
			</DetailSheetMain>
		</DetailSheetBody>
	);
}
function FollowUpEditor({
	companyId,
	contacts,
	data,
}: {
	companyId: string;
	contacts: { id: string; firstName: string; lastName: string | null }[];
	data: RouterOutputs["companies"]["followUp"];
}) {
	const trpc = useTRPC(),
		cache = useCrmCache();
	const id = useId();
	const [status, setStatus] = useState<Status>(data.status),
		[date, setDate] = useState(data.nextFollowUp ?? "");
	const [body, setBody] = useState(""),
		[channel, setChannel] = useState<
			"Email" | "Discord" | "Call" | "Meeting" | "Other"
		>("Email"),
		[contactId, setContactId] = useState("none"),
		[occurredAt, setOccurredAt] = useState("");
	const [requestId, setRequestId] = useState(() => crypto.randomUUID());
	const update = useMutation(
		trpc.companies.updateFollowUp.mutationOptions({
			onSuccess: () => cache.followUp(companyId),
			onError: (error) => toast.error(error.message),
		}),
	);
	const log = useMutation(
		trpc.companies.logContact.mutationOptions({
			onSuccess: async () => {
				setBody("");
				setRequestId(crypto.randomUUID());
				await cache.followUp(companyId);
				toast.success("Contact recorded.");
			},
		}),
	);
	const pending = update.isPending || log.isPending;
	return (
		<>
			<DetailSheetSection title="Follow-up">
				<FieldGroup>
					<Field>
						<FieldLabel>Status</FieldLabel>
						<FollowUpSelect
							value={status}
							onChange={setStatus}
							disabled={pending}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-due`}>
							Next follow-up (Shanghai date)
						</FieldLabel>
						<Input
							id={`${id}-due`}
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							disabled={pending}
						/>
					</Field>
					<Button
						disabled={pending}
						onClick={() =>
							update.mutate({
								companyId,
								data: { status, nextFollowUp: date || null },
							})
						}
					>
						Save follow-up
					</Button>
				</FieldGroup>
				<DetailSheetProse>
					Last contacted:{" "}
					{data.lastContacted
						? `${new Date(data.lastContacted).toLocaleString("en-GB", {
								timeZone: "Asia/Shanghai",
							})} (Shanghai)`
						: "—"}
				</DetailSheetProse>
			</DetailSheetSection>
			<DetailSheetSection title="Record a contact">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						log.mutate({
							companyId,
							requestId,
							body,
							channel,
							contactId: contactId === "none" ? null : contactId,
							occurredAt: occurredAt
								? new Date(`${occurredAt}:00+08:00`).toISOString()
								: new Date().toISOString(),
						});
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel>Channel</FieldLabel>
							<Select
								value={channel}
								onValueChange={(value) => setChannel(value as typeof channel)}
								disabled={pending}
							>
								<SelectTrigger aria-label="Contact channel">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{["Email", "Discord", "Call", "Meeting", "Other"].map(
											(item) => (
												<SelectItem key={item} value={item}>
													{item}
												</SelectItem>
											),
										)}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel>Inbound user (optional)</FieldLabel>
							<Select
								value={contactId}
								onValueChange={setContactId}
								disabled={pending}
							>
								<SelectTrigger aria-label="Contact person">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectItem value="none">Organization only</SelectItem>
										{contacts.map((contact) => (
											<SelectItem key={contact.id} value={contact.id}>
												{[contact.firstName, contact.lastName]
													.filter(Boolean)
													.join(" ")}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-time`}>
								Contact time (Shanghai, blank means now)
							</FieldLabel>
							<Input
								id={`${id}-time`}
								type="datetime-local"
								value={occurredAt}
								onChange={(e) => setOccurredAt(e.target.value)}
								disabled={pending}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`${id}-note`}>Contact note</FieldLabel>
							<Textarea
								id={`${id}-note`}
								value={body}
								onChange={(e) => setBody(e.target.value)}
								maxLength={20000}
								required
								disabled={pending}
							/>
						</Field>
						{log.error ? (
							<p role="alert">{log.error.message} Your note is preserved.</p>
						) : null}
						<Button type="submit" disabled={pending || !body.trim()}>
							{log.isPending ? "Recording…" : "Record contact"}
						</Button>
					</FieldGroup>
				</form>
			</DetailSheetSection>
			<DetailSheetSection title="Contact history">
				<DetailSheetProse>
					Latest 50 contacts, ordered by contact time.
				</DetailSheetProse>
				{data.logs.length ? (
					data.logs.map((entry) => (
						<div key={entry.id} className="flex flex-col gap-1 py-3">
							<p className="font-medium">
								{entry.channel} · {entry.author}
								{entry.contact ? ` · ${entry.contact}` : ""}
							</p>
							<p className="text-xs text-muted-foreground">
								{new Date(entry.occurredAt).toLocaleString("en-GB", {
									timeZone: "Asia/Shanghai",
								})}{" "}
								(Shanghai)
							</p>
							<p className="whitespace-pre-wrap break-words">{entry.body}</p>
						</div>
					))
				) : (
					<DetailSheetProse>No contacts recorded yet.</DetailSheetProse>
				)}
			</DetailSheetSection>
		</>
	);
}
