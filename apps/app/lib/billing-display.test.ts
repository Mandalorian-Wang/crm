import { describe, expect, it } from "bun:test";
import { billingTimestamp, billingWindow } from "./billing-display";

describe("billing time display", () => {
	it("converts the UTC window to Shanghai without changing its boundaries", () => {
		const result = billingWindow(
			"2026-11-01T00:00:00.000Z → 2026-11-09T11:38:03.303Z",
		);
		expect(result).toContain("08:00");
		expect(result).toContain("19:38");
		expect(result).toContain("北京时间");
		expect(result).not.toContain(".303Z");
	});
	it("does not render malformed timestamps", () => {
		expect(billingWindow("bad")).toBe("—");
		expect(billingTimestamp("bad")).toBe("—");
	});
});
