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

describe("the quarter's chips", () => {
  it("calls volume information, a higher share good and a shorter wait good", async () => {
    const { quarterCountMoved, quarterDaysMoved, quarterShareMoved } = await import("@/lib/quarterReport");
    expect(quarterCountMoved(112, 100)).toEqual({ text: "Up 12% on last quarter", dir: "up", tone: "info" });
    expect(quarterCountMoved(100, 100)?.dir).toBe("level");
    expect(quarterCountMoved(5, 0)).toBeUndefined();
    expect(quarterShareMoved(0.95, 0.93)).toEqual({ text: "2 points higher than last quarter", dir: "up", tone: "good" });
    expect(quarterShareMoved(0.92, 0.93)).toMatchObject({ text: "1 point lower than last quarter", tone: "bad" });
    expect(quarterDaysMoved(400, 420)).toEqual({ text: "20 days quicker than last quarter", dir: "down", tone: "good" });
    expect(quarterDaysMoved(421, 420)?.dir).toBe("level");
    expect(quarterDaysMoved(null, 420)).toBeUndefined();
  });
});
