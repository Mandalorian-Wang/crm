"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@crm/ui/components/input-group";
import { toast } from "sonner";
import type { RouterOutputs } from "@/lib/trpc/types";
import { CopyValue } from "../copy-value";
import { codexSetupPrompt } from "./codex-setup";

type CreatedApiKey = RouterOutputs["apiKeys"]["create"];

export function CreatedApiKeyDialog({
	apiKey,
	onOpenChange,
}: {
	apiKey: CreatedApiKey | null;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={apiKey !== null} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{apiKey?.name ?? "API key"} created</DialogTitle>
					<DialogDescription>
						Copy it now. Nobody, including us, can show it to you again.
					</DialogDescription>
				</DialogHeader>

				<InputGroup>
					<InputGroupInput
						value={apiKey?.key ?? ""}
						readOnly
						className="font-mono"
					/>
					<InputGroupAddon align="inline-end">
						<CopyValue value={apiKey?.key ?? ""} label="API key" />
					</InputGroupAddon>
				</InputGroup>

				<div className="space-y-2">
					<p className="text-sm font-medium">Use with Codex</p>
					<p className="text-sm text-muted-foreground">
						Download your private setup file and copy the setup prompt. Paste
						the prompt into Codex. This key uses your CRM permissions.
					</p>
					<Button
						variant="outline"
						disabled={!apiKey}
						onClick={async () => {
							if (!apiKey) return;
							const endpoint = `${window.location.origin}/api/mcp/crm`;
							const url = URL.createObjectURL(
								new Blob(
									[JSON.stringify({ url: endpoint, apiKey: apiKey.key })],
									{ type: "application/json" },
								),
							);
							const link = document.createElement("a");
							link.href = url;
							link.download = "boxlite-crm-mcp.json";
							link.click();
							setTimeout(() => URL.revokeObjectURL(url), 1000);
							try {
								await navigator.clipboard.writeText(codexSetupPrompt(endpoint));
								toast.success(
									"Setup file downloaded. Paste the copied prompt into Codex.",
								);
							} catch {
								toast.error(
									"Could not copy the prompt. Allow clipboard access and try again.",
								);
							}
						}}
					>
						Set up Codex: download &amp; copy prompt
					</Button>
				</div>
				<DialogFooter>
					<Button onClick={() => onOpenChange(false)}>Done</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
