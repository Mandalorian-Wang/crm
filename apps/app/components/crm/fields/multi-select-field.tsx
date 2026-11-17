"use client";

import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { useId, useState } from "react";

export function MultiSelectField({
	label,
	value,
	options,
	saving,
	onSave,
}: {
	label: string;
	value: string[];
	options: { id: string; label: string; archived?: boolean }[];
	saving: boolean;
	onSave: (value: string[]) => void;
}) {
	const id = useId();
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState(value);
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) setDraft(value);
			}}
		>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					disabled={saving}
					aria-label={`Edit ${label}`}
					title={value
						.map((id) => options.find((o) => o.id === id)?.label ?? id)
						.join(", ")}
				>
					{value.length ? `${value.length} selected` : "Select options"}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start">
				<div className="space-y-3">
					<p className="text-sm font-medium">{label}</p>
					<div className="max-h-64 space-y-2 overflow-y-auto">
						{options.map((option) => (
							<label
								key={option.id}
								htmlFor={`${id}-${option.id}`}
								className="flex items-center gap-2 text-sm"
							>
								<Checkbox
									id={`${id}-${option.id}`}
									checked={draft.includes(option.id)}
									disabled={
										saving || (option.archived && !value.includes(option.id))
									}
									onCheckedChange={(checked) =>
										setDraft((current) =>
											checked
												? [...current, option.id]
												: current.filter((id) => id !== option.id),
										)
									}
								/>
								<span className="break-words">{option.label}</span>
							</label>
						))}
						{!options.length ? (
							<p className="text-sm text-muted-foreground">
								Add options in Settings → Dictionaries.
							</p>
						) : null}
					</div>
					<div className="flex justify-between gap-2">
						<Button variant="ghost" size="sm" onClick={() => setDraft([])}>
							Clear
						</Button>
						<Button
							size="sm"
							disabled={saving}
							onClick={() => {
								onSave(draft);
								setOpen(false);
							}}
						>
							Apply
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
