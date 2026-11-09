import { SYNC } from "./config";
import { runSource } from "./jobs";

console.info(
	"BoxLite CRM imports run daily at 08:00 Asia/Shanghai (00:00 UTC), with missed-run recovery.",
);
while (true) {
	for (const source of ["overview", "github", "cloud", "billing"] as const) {
		try {
			await runSource(source);
		} catch {
			console.error(JSON.stringify({ source, status: "RETRY_SCHEDULED" }));
		}
	}
	await Bun.sleep(SYNC.pollIntervalMs);
}
