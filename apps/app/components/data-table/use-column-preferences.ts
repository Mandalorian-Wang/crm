"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function useColumnPreferences(table: "companies" | "contacts") {
	const trpc = useTRPC();
	const client = useQueryClient();
	const options = trpc.users.tablePreference.queryOptions({ table });
	const query = useQuery(options);
	const mutationKey = ["column-preferences", table];
	const save = useMutation({
		scope: { id: `column-preferences:${table}` },
		...trpc.users.saveTablePreference.mutationOptions({
			onMutate: async (input) => {
				await client.cancelQueries({ queryKey: options.queryKey });
				client.setQueryData(options.queryKey, {
					hiddenColumns: input.hiddenColumns,
				});
			},
			onError: () =>
				toast.error("Could not save your columns. Please try again."),
			onSettled: () => {
				if (client.isMutating({ mutationKey }) === 1)
					void client.invalidateQueries({ queryKey: options.queryKey });
			},
		}),
		mutationKey,
	});
	return {
		hiddenColumns: query.data?.hiddenColumns ?? null,
		loading: query.isPending || query.isError,
		onChange: (hiddenColumns: string[]) =>
			save.mutate({ table, hiddenColumns }),
	};
}
