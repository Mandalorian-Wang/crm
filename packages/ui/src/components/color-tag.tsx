import type { ComponentProps } from "react";
import { Badge } from "./badge";
import { cn } from "../lib/utils";

const tones = {
 gray: "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200",
 blue: "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200",
 green: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
 amber: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
 purple: "border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200",
 rose: "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200",
 cyan: "border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-950 dark:text-cyan-200",
 orange: "border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200",
} as const;

export function ColorTag({color = "gray", ...props}: Omit<ComponentProps<typeof Badge>, "color" | "variant" | "className"> & {color?: keyof typeof tones}) {
 return <Badge variant="outline" className={cn("h-6 max-w-48 cursor-default [&_span]:truncate [&:is(button)]:cursor-pointer [&:is(button)]:hover:brightness-95", tones[color])} {...props} />;
}
