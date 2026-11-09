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
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

export function SubmitRequest() {
	const trpc = useTRPC();
	const titleId = useId();
	const contentId = useId();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [requestId, setRequestId] = useState<string | null>(null);
	const submit = useMutation(trpc.linear.submitRequest.mutationOptions());
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!submit.isPending) setOpen(next);
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					提需求
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>提交 CRM 需求</DialogTitle>
					<DialogDescription>
						提交到 Linear 的 Internal CRM system 项目，自动添加 CRM
						标签并记录提交人。
					</DialogDescription>
				</DialogHeader>
				{submit.data ? (
					<div className="flex flex-col gap-3">
						<p>提交成功：{submit.data.identifier}</p>
						<Button asChild variant="outline">
							<a
								href={submit.data.url}
								target="_blank"
								rel="noopener noreferrer"
							>
								在 Linear 查看
							</a>
						</Button>
						<Button
							onClick={() => {
								submit.reset();
								setTitle("");
								setContent("");
								setRequestId(null);
							}}
						>
							再提一个需求
						</Button>
					</div>
				) : (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							const id = requestId ?? crypto.randomUUID();
							setRequestId(id);
							submit.mutate({ requestId: id, title, content });
						}}
					>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor={titleId}>标题</FieldLabel>
								<Input
									id={titleId}
									required
									maxLength={200}
									value={title}
									disabled={submit.isPending}
									onChange={(event) => setTitle(event.target.value)}
									placeholder="简述你希望改进的功能"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={contentId}>内容</FieldLabel>
								<Textarea
									id={contentId}
									required
									maxLength={20000}
									rows={7}
									disabled={submit.isPending}
									value={content}
									onChange={(event) => setContent(event.target.value)}
									placeholder="描述使用场景、遇到的问题和期望效果"
								/>
							</Field>
							{submit.error ? (
								<p role="alert">{submit.error.message}。内容已保留，可重试。</p>
							) : null}
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									disabled={submit.isPending}
									onClick={() => setOpen(false)}
								>
									取消
								</Button>
								<Button
									type="submit"
									disabled={
										submit.isPending || !title.trim() || !content.trim()
									}
								>
									{submit.isPending ? "提交中…" : "提交需求"}
								</Button>
							</DialogFooter>
						</FieldGroup>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
