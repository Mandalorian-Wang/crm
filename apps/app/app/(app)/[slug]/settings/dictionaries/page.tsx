import type { Metadata } from "next";
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
import { DictionarySettings } from "./dictionary-settings";

export const metadata: Metadata = { title: "Dictionaries" };

export default function DictionariesPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Dictionaries</PageShellTitle>
					<PageShellDescription>
						Manage the labels your team uses to organize customers.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Content />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Content() {
	await requireSession();
	return <DictionarySettings />;
}
