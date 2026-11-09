import { z } from "zod";

export const noteMention = z.object({
	start: z.number().int().nonnegative(),
	end: z.number().int().positive(),
	id: z.string().min(1).max(200),
	name: z.string().min(1).max(200),
});
export const noteMentions = z.array(noteMention).max(100);
export type NoteMention = z.infer<typeof noteMention>;
export function validNoteMentions(body: string, mentions: NoteMention[]) {
	let end = 0;
	for (const mention of mentions) {
		if (
			mention.start < end ||
			mention.end <= mention.start ||
			body.slice(mention.start, mention.end) !== `@${mention.name}`
		)
			return false;
		end = mention.end;
	}
	return true;
}
export function adjustNoteMentions(
	before: string,
	after: string,
	mentions: NoteMention[],
) {
	let start = 0;
	while (
		start < before.length &&
		start < after.length &&
		before[start] === after[start]
	)
		start++;
	let oldEnd = before.length,
		newEnd = after.length;
	while (
		oldEnd > start &&
		newEnd > start &&
		before[oldEnd - 1] === after[newEnd - 1]
	) {
		oldEnd--;
		newEnd--;
	}
	const delta = newEnd - oldEnd;
	return mentions.flatMap((mention) => {
		if (mention.end <= start) return [mention];
		if (mention.start >= oldEnd)
			return [
				{ ...mention, start: mention.start + delta, end: mention.end + delta },
			];
		return [];
	});
}
