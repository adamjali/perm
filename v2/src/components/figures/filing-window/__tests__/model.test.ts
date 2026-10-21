import { describe, expect, it } from "vitest";
import { calculateFilingWindow } from "@/lib/perm";
import { readFilingWindow } from "../model";
import { LAST_MAX, LAST_MIN, WAIT, CLOSE } from "../geometry";

describe("the filing-window figure reads the central rule", () => {
  it("a job order that ends on day 30 leaves the widest window", () => {
    const r = readFilingWindow("2026-03-02", LAST_MIN);
    expect(r).toMatchObject({ last: "2026-04-01", opens: "2026-05-01", closes: "2026-08-29" });
    expect(r.sentence).toBe("Last step Apr 1: file from May 1 to Aug 29, 2026.");
  });

  it("a last step on day 150 leaves one day, which the rule still calls a window", () => {
    const r = readFilingWindow("2026-03-02", LAST_MAX);
    expect(r).toMatchObject({ last: "2026-07-30", opens: "2026-08-29", closes: "2026-08-29" });
    expect(r.sentence).toBe("Last step Jul 30: file on Aug 29, 2026 only.");
  });

  it("agrees with calculateFilingWindow on every day the slider reaches", () => {
    for (let day = LAST_MIN; day <= LAST_MAX; day++) {
      const r = readFilingWindow("2026-03-02", day);
      expect(calculateFilingWindow({ firstRecruitmentDate: "2026-03-02", lastRecruitmentDate: r.last })).toMatchObject({ opens: r.opens, closes: r.closes });
    }
  });

  it("draws the rule's own day counts", () => {
    expect([WAIT, CLOSE, LAST_MAX]).toEqual([30, 180, 150]);
  });
});
