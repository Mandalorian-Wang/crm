"use client";

import type { ReactNode } from "react";
import { InputGroup, InputGroupAddon } from "./input-group";

export function NoteComposer({ children }: { children: ReactNode }) {
	return <InputGroup>{children}</InputGroup>;
}

export function NoteComposerFooter({ children }: { children: ReactNode }) {
	return (
		<InputGroupAddon align="block-end" className="gap-2 border-t">
			{children}
		</InputGroupAddon>
	);
}

export function NoteTimelineDay({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<section>
			<h3 className="sticky top-0 z-10 bg-popover py-2 text-xs font-medium text-muted-foreground">
				{label}
			</h3>
			<ul className="divide-y">{children}</ul>
		</section>
	);
}
