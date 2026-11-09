import { db } from "@crm/db";
import { runSource } from "./jobs";

let failed = false;
for (const source of ["overview", "github", "cloud", "billing"] as const) {
	try {
		await runSource(source, process.argv.includes("--force"));
	} catch {
		failed = true;
	}
}
await db.$disconnect();
if (failed) process.exitCode = 1;
