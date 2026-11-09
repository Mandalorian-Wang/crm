"use client";
import { useSession } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import type { TableQueryState } from "@crm/ui/lib/table-query";

export function AssignedToMe({
	query,
	onChange,
}: {
	query: TableQueryState;
	onChange: () => void;
}) {
	const { data: session } = useSession();
	const id = session?.user.id;
	const selected = Boolean(
		id && query.filters.owner?.length === 1 && query.filters.owner[0] === id,
	);
	return (
		<Button
			size="sm"
			variant={selected ? "contrast" : "outline"}
			aria-pressed={selected}
			disabled={!id}
			onClick={() => {
				if (id) {
					onChange();
					query.setFilter("owner", selected ? [] : [id]);
				}
			}}
		>
			Assigned to me
		</Button>
	);
}
