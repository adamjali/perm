import { describe, expect, it } from "vitest";

import { QUARTER_KEY_RE, changeWords, quarterMonths, quarterName } from "@/lib/quarterReport";

describe("a quarter in words", () => {
  it("names its months and its fiscal quarter", () => {
    expect(quarterMonths({ from: "2026-04-01", to: "2026-06-30" })).toBe("April to June 2026");
    expect(quarterMonths({ from: "2025-10-01", to: "2025-12-31" })).toBe("October to December 2025");
    expect(quarterName({ fy: 2026, q: 3 })).toBe("fiscal 2026, Q3");
  });

  it("takes only a real quarter key", () => {
    expect(QUARTER_KEY_RE.test("2026q3")).toBe(true);
    expect(QUARTER_KEY_RE.test("2026q5")).toBe(false);
    expect(QUARTER_KEY_RE.test("2026q3'; --")).toBe(false);
  });
});

describe("changeWords", () => {
  it("says the change as a share, whole above 10% and to a tenth below", () => {
    expect(changeWords(126, 100)).toBe("up 26%");
    expect(changeWords(97.7, 100)).toBe("down 2.3%");
  });

  it("calls a tiny change the same, and a start from nothing 'none before'", () => {
    expect(changeWords(1000, 1001)).toBe("about the same");
    expect(changeWords(5, 0)).toBe("none before");
    expect(changeWords(0, 0)).toBe("about the same");
  });
});
