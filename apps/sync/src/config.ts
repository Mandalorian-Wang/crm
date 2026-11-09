import "@crm/env/load";

export const SYNC = {
	githubEnabled: process.env.GITHUB_SYNC_ENABLED === "true",
	backofficeOrigin:
		process.env.BACKOFFICE_API_ORIGIN || "https://api.backoffice.boxlite.ai",
	githubRepository: process.env.GITHUB_STAR_REPOSITORY || "boxlite-ai/boxlite",
	requestTimeoutMs: 35_000,
	requestIntervalMs: 1_100,
	retryDelayMs: 15 * 60_000,
	pollIntervalMs: 60_000,
	maxPages: 10_000,
	ownerEmail: `${process.env.CRM_ADMIN_USERNAME || "admin"}@polygala.ai`,
	timezone: "Asia/Shanghai",
} as const;

export function scheduledDay(now: Date): string {
	return now.toISOString().slice(0, 10);
}
