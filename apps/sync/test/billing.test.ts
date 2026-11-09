import { describe, expect, it } from "bun:test";
import { moneyFromMinor } from "../src/billing";

describe("settled usage money", () => {
	it("keeps minor-unit precision without floating point conversion", () => {
		expect(moneyFromMinor("USD", 9007199254740993n)).toBe(
			"USD 90071992547409.93",
		);
		expect(moneyFromMinor("USD", 1n)).toBe("USD 0.01");
	});
	it("respects currency exponents", () => {
		expect(moneyFromMinor("JPY", 123n)).toBe("JPY 123");
		expect(moneyFromMinor("KWD", 1234n)).toBe("KWD 1.234");
	});
});
