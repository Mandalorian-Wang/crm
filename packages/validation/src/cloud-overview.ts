import { z } from "zod";

export const cloudOverviewEvidence = z.record(
	z.string(),
	z.object({
		createdAt: z.string().datetime({ offset: true }),
		createdBox: z.boolean().nullable(),
		memberIds: z.array(z.string()).nullable(),
		memberCount: z.number().int().nonnegative().optional(),
	}),
);

export const CLOUD_OVERVIEW = {
	timezone: "Asia/Shanghai",
	utcOffsetMs: 8 * 60 * 60 * 1000,
	dayMs: 24 * 60 * 60 * 1000,
	pageSize: 20,
} as const;

export function previousShanghaiDay(now: Date, days = 1) {
	const today = new Date(now.getTime() + CLOUD_OVERVIEW.utcOffsetMs)
		.toISOString()
		.slice(0, 10);
	const end = new Date(`${today}T00:00:00+08:00`);
	const start = new Date(end.getTime() - days * CLOUD_OVERVIEW.dayMs);
	return {
		start,
		end,
		date: new Date(start.getTime() + CLOUD_OVERVIEW.utcOffsetMs)
			.toISOString()
			.slice(0, 10),
	};
}

export function createdBoxInWindow(
	lastCreatedAt: string | null,
	start: Date,
	end: Date,
): boolean | null {
	if (lastCreatedAt === null) return null;
	const timestamp = new Date(lastCreatedAt).getTime();
	if (!Number.isFinite(timestamp) || timestamp >= end.getTime()) return null;
	return timestamp >= start.getTime() ? true : null;
}

export const cloudWindowDays = z.union([
	z.literal(1),
	z.literal(7),
	z.literal(15),
]);
export function cloudOverviewKey(date: string, days: number) {
	return days === 1 ? date : `${date}:${days}`;
}
