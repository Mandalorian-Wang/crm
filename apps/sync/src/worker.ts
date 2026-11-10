import { SYNC } from "./config";
import { runSource } from "./jobs";

console.info(
	"BoxLite CRM imports run hourly at the start of each hour, with missed-run recovery.",
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
