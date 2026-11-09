"use client";
import ClockIcon from "@carbon/icons-react/es/Time";
import { Button } from "@crm/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	type RecordFieldEntry,
	RecordFields,
} from "@/components/crm/fields/record-fields";
import {
	DetailSheetProperties,
	DetailSheetProperty,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { useTRPC } from "@/lib/trpc/client";

function timestamp(value: string | null) {
	return value
		? `${new Intl.DateTimeFormat("en-GB", {
				timeZone: "Asia/Shanghai",
				dateStyle: "medium",
				timeStyle: "short",
			}).format(new Date(value))} (Shanghai)`
		: "Never";
}

export function membershipMessage(fields: RecordFieldEntry[], count: number) {
	const value = (key: string) =>
		fields.find((field) => field.key === key)?.value;
	const status = String(value("cloud_members_sync_status") ?? "");
	const expected = value("cloud_member_count");
	if (status.startsWith("Incomplete"))
		return "Member sync is incomplete. Existing links are preserved; the sync job will retry.";
	if (status.startsWith("Synced") && expected === 0)
		return "The latest Cloud response reports no members.";
	if (expected !== null && expected !== undefined && Number(expected) > count)
		return "Cloud reports more members than are linked here. Some profiles are pending, archived or excluded; the membership list is incomplete.";
	if (!status && value("cloud_organization_id"))
		return "Member sync has not been confirmed for this organization.";
	return count
		? "Includes Cloud memberships across organizations and manually linked inbound users."
		: "No active inbound users are linked. The source does not establish why.";
}

export function CompanyCloudInfo({ fields }: { fields: RecordFieldEntry[] }) {
	const trpc = useTRPC();
	const status = useQuery(trpc.companies.syncStatus.queryOptions());
	const billing = (field: RecordFieldEntry) =>
		field.key.startsWith("cloud_billing_") ||
		field.key.startsWith("cloud_settled_");
	const labels = new Map(
		Object.entries({
			cloud_billing_window: "Usage window",
			cloud_billing_synced_at: "Billing updated",
			cloud_synced_at: "Cloud data updated",
		}),
	);
	const shown = fields
		.filter(
			(field) =>
				field.key.startsWith("cloud_") &&
				![
					"cloud_billing_synced_at",
					"cloud_synced_at",
					"cloud_members_sync_status",
				].includes(field.key),
		)
		.map((field) => ({
			...field,
			label: labels.get(field.key) ?? field.label,
			showOnSheet: true,
		}));
	return (
		<>
			{[
				{ title: "Cloud information", items: shown.filter((f) => !billing(f)) },
				{ title: "Billing", items: shown.filter(billing) },
			].map((group) => (
				<DetailSheetSection
					key={group.title}
					title={
						<span className="inline-flex items-center gap-1">
							{group.title}
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-xs"
										aria-label={`${group.title} sync time`}
									>
										<ClockIcon />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{status.error
										? "Sync time unavailable"
										: timestamp(
												status.data?.find(
													(source) =>
														source.source ===
														(group.title === "Billing" ? "billing" : "cloud"),
												)?.lastSuccess ?? null,
											)}
								</TooltipContent>
							</Tooltip>
						</span>
					}
				>
					<DetailSheetProperties columns={2}>
						<RecordFields
							fields={group.items}
							saving={() => false}
							onSave={() => undefined}
						/>
						{group.title === "Billing" ? (
							<DetailSheetProperty label="Balance">
								<span title="The connected API does not provide wallet balances.">
									—
								</span>
							</DetailSheetProperty>
						) : null}
					</DetailSheetProperties>
				</DetailSheetSection>
			))}
		</>
	);
}

export function CopyValue({ value, label }: { value: string; label: string }) {
	return (
		<div className="flex min-w-0 items-center gap-2">
			<span className="min-w-0 break-all">{value}</span>
			<Button
				variant="ghost"
				size="sm"
				aria-label={`Copy ${label}`}
				onClick={() =>
					navigator.clipboard
						.writeText(value)
						.then(() => toast.success(`${label} copied.`))
						.catch(() =>
							toast.error(
								"Could not copy. Select and copy the value manually.",
							),
						)
				}
			>
				Copy
			</Button>
		</div>
	);
}
