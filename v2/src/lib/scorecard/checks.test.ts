import { describe, expect, it } from "vitest";

import { estimateChecks, type ChecksInput } from "./checks";

// The stored checks as they read on Nov 4 2026 (perm_docs on the server), trimmed to what the rows read.
const STORED: ChecksInput = {
  perm: {
    t0: "2026-10-14",
    end: "2026-11-03",
    current: { decided: 10119, typicalMissDays: 3, within7Share: 0.869 },
    passed: {
      rate: { cases: 5636, decided: 4526, typicalMissDays: 8.0, within7Share: 0.531 },
      dolAverage: { cases: 5636, decided: 4526, typicalMissDays: 35.0, within7Share: 0.193 },
    },
    rfiClock: { test: { judged: 199, decided: 149, typicalMissDays: 4, insideShare: 0.392 } },
  },
  range: { share: 0.668, judged: 41091, kind: "out-of-sample" },
  pwd: { decided: 9911, typicalMissDays: 1, within7Share: 0.987, through: "2026-11-03" },
  bulletin: { readers: 1853, reached: 1500, typicalMissMonths: 7.7, withinQuarterShare: 0.23 },
  seasonal: { "H-2A": { share: 0.528, cases: 43601 }, "CW-1": { share: 0.58, cases: 1200 } },
};

describe("estimateChecks", () => {
  it("gives a row for every check that has something to quote, in reading order", () => {
    expect(estimateChecks(STORED).map((r) => r.key)).toEqual([
      "perm-line", "perm-range", "perm-passed", "perm-rfi", "pwd-day", "bulletin", "h2a", "cw1",
    ]);
  });

  it("says each result with its days and its count", () => {
    const by = Object.fromEntries(estimateChecks(STORED).map((r) => [r.key, r]));
    expect(by["perm-line"]).toMatchObject({
      result: "3 days typically, 87% within a week",
      basis: "10,119 cases DOL decided from October 14 to November 3, 2026, each dated as the line stood on the first day",
    });
    expect(by["perm-passed"]!.result).toBe("8 days typically, where DOL's own average was 35 days off");
    expect(by["perm-rfi"]!.result).toBe("4 days typically, 39% inside the range");
    expect(by["pwd-day"]!.result).toBe("1 day typically, 99% within a week");
    expect(by["bulletin"]!.result).toBe("7.7 months typically, 23% within a quarter");
    expect(by["h2a"]!.estimate).toBe("When DOL decides an H-2A application");
    expect(by["cw1"]!.estimate).toBe("When DOL decides a CW-1 application");
  });

  it("writes a span inside one year once, and across a year in full", async () => {
    const { dayRange } = await import("./checks");
    expect(dayRange("2026-10-14", "2026-11-03")).toBe("from October 14 to November 3, 2026");
    expect(dayRange("2025-12-22", "2026-01-12")).toBe("from December 22, 2025 to January 12, 2026");
  });

  it("names how the range was tested", () => {
    const at = (kind: "out-of-sample" | "in-sample" | "pace-rule") =>
      estimateChecks({ range: { share: 0.5, judged: 100, kind } })[0]!.basis;
    expect(at("out-of-sample")).toMatch(/start days the range wasn't drawn from/);
    expect(at("in-sample")).toMatch(/the ones the range was measured on/);
    expect(at("pace-rule")).toMatch(/a week or more before/);
  });

  it("leaves out a check with nothing to quote, never as a zero", () => {
    const rows = estimateChecks({
      perm: {
        t0: "2026-10-14",
        end: "2026-11-03",
        current: { decided: 0, typicalMissDays: 3 },
        rfiClock: { test: { decided: 0, typicalMissDays: null } },
      },
      pwd: null,
      bulletin: null,
      seasonal: {},
    });
    expect(rows).toEqual([]);
  });

  it("reads a renamed or wrong-typed field from the Python check as no check", () => {
    const rows = estimateChecks({
      perm: { t0: "2026-10-14", end: "2026-11-03", current: { decided: "10119", typicalMissDays: "3" } },
      range: { share: 1.7, judged: 10, kind: "out-of-sample" },
    });
    expect(rows).toEqual([]);
  });

  it("never carries the rival head-to-head or a cutoff forecast", () => {
    const text = JSON.stringify(estimateChecks(STORED));
    expect(text).not.toMatch(/rival|next month's cutoff/i);
  });
});
