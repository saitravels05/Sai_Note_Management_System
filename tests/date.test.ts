import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatBusinessDate, parseBusinessDate, getMonthName, getPeriodDisplayName } from "../src/lib/date";

describe("Date & Time Formatting for Accounting", () => {
  test("formats date in standard DD-MM-YYYY format", () => {
    const d = new Date(2026, 8, 29); // 29 September 2026
    assert.equal(formatBusinessDate(d), "29-09-2026");
  });

  test("parses DD-MM-YYYY string safely", () => {
    const parsed = parseBusinessDate("29-09-2026");
    assert.notEqual(parsed, null);
    if (parsed) {
      assert.equal(parsed.getDate(), 29);
      assert.equal(parsed.getMonth(), 8); // 0-indexed September
      assert.equal(parsed.getFullYear(), 2026);
    }
  });

  test("returns correct month and period names", () => {
    assert.equal(getMonthName(9), "September");
    assert.equal(getPeriodDisplayName(2026, 9), "September 2026");
  });
});
