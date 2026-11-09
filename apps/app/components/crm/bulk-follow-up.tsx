"use client";
import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@crm/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { FollowUpSelect } from "./record-sheet/company-follow-up";

export function BulkFollowUp({
	ids,
	onDone,
}: {
	ids: string[];
	onDone: () => void;
}) {
	const trpc = useTRPC(),
		cache = useCrmCache(),
		id = useId();
	const [open, setOpen] = useState(false),
		[status, setStatus] = useState<
			"NOT_CONTACTED" | "CONTACTED" | "WAITING" | "COMPLETED"
		>("CONTACTED"),
		[changeStatus, setChangeStatus] = useState(true),
		[changeDate, setChangeDate] = useState(false),
		[date, setDate] = useState("");
	const mutation = useMutation(
		trpc.companies.bulkFollowUp.mutationOptions({
			onSuccess: () => cache.followUp(),
		}),
	);
	const submit = (targets: string[]) =>
		mutation.mutate({
			ids: targets,
			data: {
				status: changeStatus ? status : undefined,
				nextFollowUp: changeDate ? date || null : undefined,
			},
		});
	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				if (!mutation.isPending) {
					setOpen(value);
					if (!value && mutation.data) onDone();
				}
			}}
		>
			<DialogTrigger asChild>
				<Button size="sm" variant="outline" onClick={() => mutation.reset()}>
					Update follow-up
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Update {ids.length} organizations</DialogTitle>
				</DialogHeader>
				<FieldGroup>
					<Field orientation="horizontal">
						<Checkbox
							id={`${id}-status`}
							checked={changeStatus}
							onCheckedChange={(value) => setChangeStatus(value === true)}
						/>
						<FieldLabel htmlFor={`${id}-status`}>Change status</FieldLabel>
					</Field>
					<FollowUpSelect
						value={status}
						onChange={setStatus}
						disabled={!changeStatus || mutation.isPending}
					/>
					<Field orientation="horizontal">
						<Checkbox
							id={`${id}-date`}
							checked={changeDate}
							onCheckedChange={(value) => setChangeDate(value === true)}
						/>
						<FieldLabel htmlFor={`${id}-date`}>
							Change follow-up date (blank clears it)
						</FieldLabel>
					</Field>
					<Input
						type="date"
						aria-label="Next follow-up date"
						value={date}
						onChange={(e) => setDate(e.target.value)}
						disabled={!changeDate || mutation.isPending}
					/>
					{mutation.error ? <p role="alert">{mutation.error.message}</p> : null}
					{mutation.data ? (
						<p role="status">
							{mutation.data.succeeded} updated; {mutation.data.failed.length}{" "}
							failed.
						</p>
					) : null}
					{mutation.data?.failed.map((failure) => (
						<p key={failure.id}>
							{failure.id}: {failure.message}
						</p>
					))}
				</FieldGroup>
				<DialogFooter>
					<Button
						variant="outline"
						disabled={mutation.isPending}
						onClick={() => {
							setOpen(false);
							if (mutation.data) onDone();
						}}
					>
						Close
					</Button>
					<Button
						disabled={
							mutation.isPending ||
							(!changeStatus && !changeDate) ||
							mutation.data?.failed.length === 0
						}
						onClick={() =>
							submit(mutation.data?.failed.map((f) => f.id) ?? ids)
						}
					>
						{mutation.isPending
							? "Updating…"
							: mutation.data?.failed.length
								? "Retry failed records"
								: "Apply changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
