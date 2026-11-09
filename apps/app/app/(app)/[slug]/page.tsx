import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { CloudOverview } from "./cloud-overview";

export default function OverviewPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Cloud overview</PageShellTitle>
					<PageShellDescription>
						Cloud acquisition and Box usage by reporting window.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Overview />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Overview() {
	await requireSession();
	await getServerQueryClient().prefetchQuery(
		getServerTrpc().dashboard.cloudOverview.queryOptions({ page: 1 }),
	);
	return (
		<HydrateClient>
			<CloudOverview />
		</HydrateClient>
	);
}
