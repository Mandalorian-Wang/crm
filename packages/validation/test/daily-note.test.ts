import { expect, test } from "bun:test";
import { adjustNoteMentions, validNoteMentions } from "../src/daily-note";

const mentions = [{ id: "crm-member", name: "Alex", start: 6, end: 11 }];
test("mention offsets follow inserted text and drop edited names", () => {
	expect(adjustNoteMentions("Hello @Alex", "Hi Hello @Alex", mentions)).toEqual(
		[{ ...mentions[0], start: 9, end: 14 }],
	);
	expect(adjustNoteMentions("Hello @Alex", "Hello @Al", mentions)).toEqual([]);
	expect(adjustNoteMentions("Hello @Alex", "Hello @Alex!", mentions)).toEqual(
		mentions,
	);
});
test("mention text and ranges must agree", () => {
	expect(validNoteMentions("Hello @Alex", mentions)).toBe(true);
	expect(validNoteMentions("Hello @Bob", mentions)).toBe(false);
	expect(validNoteMentions("Hello @Alex", [...mentions, ...mentions])).toBe(
		false,
	);
});
