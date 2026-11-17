"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@crm/ui/components/dialog";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import { CompanyPicker } from "./company-picker";

export function LinkUsersDialog({
	users,
	onDone,
}: {
	users: { id: string; name: string }[];
	onDone?: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [open, setOpen] = useState(false);
	const [companyId, setCompanyId] = useState("");
	const mutation = useMutation(
		trpc.contacts.bulkSetCompany.mutationOptions({
			onSuccess: async (result) => {
				await Promise.all([cache.contact(), cache.company(), cache.activity()]);
				if (result.failed) {
					toast.error(
						`${result.succeeded} users linked; ${result.failed} could not be linked.`,
					);
					return;
				}
				toast.success(`${result.succeeded} inbound users linked.`);
				setOpen(false);
				onDone?.();
			},
		}),
	);
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!mutation.isPending) {
					setOpen(next);
					mutation.reset();
					setCompanyId("");
				}
			}}
		>
			<DialogTrigger asChild>
				<Button size="sm" variant="outline" disabled={!users.length}>
					Link to organization
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Link inbound users</DialogTitle>
					<DialogDescription>
						Select an existing organization. This replaces each user's primary
						organization. Their notes stay with them.
					</DialogDescription>
				</DialogHeader>
				<ul className="max-h-40 overflow-y-auto text-sm">
					{users.map((user) => (
						<li key={user.id}>{user.name}</li>
					))}
				</ul>
				<CompanyPicker
					value={companyId}
					onValueChange={setCompanyId}
					disabled={mutation.isPending}
				/>
				{mutation.error ? <p role="alert">{mutation.error.message}</p> : null}
				<DialogFooter>
					<Button
						variant="outline"
						disabled={mutation.isPending}
						onClick={() => setOpen(false)}
					>
						Cancel
					</Button>
					<Button
						disabled={!companyId || mutation.isPending}
						onClick={() =>
							mutation.mutate({ ids: users.map((user) => user.id), companyId })
						}
					>
						{mutation.isPending ? "Linking…" : `Link ${users.length} users`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
