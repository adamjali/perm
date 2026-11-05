import { describe, expect, it } from "vitest";

import { buildMonthShare, monthParts } from "@/lib/monthShare";
import type { MonthMakeup } from "@/lib/monthMakeup";

const makeup = (over: Partial<MonthMakeup> = {}): MonthMakeup => ({
  total: 20000,
  decided: 8200,
  certified: 7000,
  denied: 200,
  withdrawn: 1000,
  otherDecided: 0,
  inLine: 11000,
  outside: 800,
  ...over,
});

describe("buildMonthShare", () => {
  it("leads with the month's share decided and dates it to the census", () => {
    const m = buildMonthShare({ month: "2026-02", makeup: makeup(), asOf: "2026-11-05", line: { month: "2026-01", asOf: "2026-11-05" } });
    expect(m.label).toBe("February 2026");
    expect(m.share).toBe("41%");
    expect(m.lead).toBe("8,200 of the 20,000 PERM applications filed in February 2026 have a decision.");
    expect(m.stamp).toBe("Counted Nov 5, 2026 from DOL's case-status service");
    expect(m.line).toBe("DOL is deciding cases filed in January 2026, by our daily check.");
    expect(m.address).toBe("permtracker.app/perm-queue/2026-02");
    expect(m.title).toBe("PERM applications filed in February 2026");
    expect(m.tally).toBe("8,200 of 20,000 have a decision");
  });

  it("splits decided and waiting into the house status colours, in reading order, and drops empty parts", () => {
    const m = buildMonthShare({ month: "2026-02", makeup: makeup({ denied: 0 }), asOf: "2026-11-05", line: null });
    expect(m.parts.map((p) => p.key)).toEqual(["certified", "withdrawn", "inLine", "outside"]);
    expect(m.parts.map((p) => p.count)).toEqual([7000, 1000, 11000, 800]);
    expect(m.parts.reduce((n, p) => n + p.count, 0)).toBe(19800);
  });

  it("counts any other final status with certified, as the month page does", () => {
    const m = buildMonthShare({ month: "2025-06", makeup: makeup({ certified: 100, otherDecided: 5, decided: 105, withdrawn: 0, denied: 0 }), asOf: "2026-11-05", line: null });
    expect(m.parts.find((p) => p.key === "certified")?.count).toBe(105);
  });

  it("says when most of what's decided is withdrawals, which employers file", () => {
    const m = buildMonthShare({
      month: "2026-06",
      makeup: makeup({ total: 9000, decided: 300, certified: 10, denied: 0, withdrawn: 290, inLine: 8600, outside: 100 }),
      asOf: "2026-11-05",
      line: { month: "2026-01", asOf: "2026-11-05" },
    });
    expect(m.note).toBe("290 of the 300 decided are withdrawals, which employers file. DOL hasn't reached this month.");
  });

  it("leaves the note out when DOL's decisions lead", () => {
    expect(buildMonthShare({ month: "2026-02", makeup: makeup(), asOf: "2026-11-05", line: null }).note).toBeNull();
  });

  it("never prints a clean 0% or 100% the counts don't have", () => {
    expect(buildMonthShare({ month: "2026-02", makeup: makeup({ decided: 19999, total: 20000 }), asOf: "2026-11-05", line: null }).share).not.toBe("100%");
    expect(buildMonthShare({ month: "2026-10", makeup: makeup({ decided: 3, total: 20000 }), asOf: "2026-11-05", line: null }).share).not.toBe("0%");
  });

  it("names no DOL month when our check can't say", () => {
    expect(buildMonthShare({ month: "2026-02", makeup: makeup(), asOf: "2026-11-05", line: null }).line).toBeNull();
  });

  it("carries every figure in its alt text, so the picture says nothing a screen reader misses", () => {
    const m = buildMonthShare({ month: "2026-02", makeup: makeup(), asOf: "2026-11-05", line: { month: "2026-01", asOf: "2026-11-05" } });
    for (const s of ["February 2026", "41%", "7,000 certified", "200 denied", "1,000 withdrawn", "11,000 in DOL's line", "800 on hold, at an RFI or on appeal", "Nov 5, 2026", "January 2026"]) {
      expect(m.alt).toContain(s);
    }
  });

  it("refuses a month that isn't one, and a month with no cases", () => {
    expect(() => buildMonthShare({ month: "2026-13", makeup: makeup(), asOf: "2026-11-05", line: null })).toThrow();
    expect(() => buildMonthShare({ month: "2026-02", makeup: makeup({ total: 0 }), asOf: "2026-11-05", line: null })).toThrow();
  });

  it("words a single decision, none at all, and a month of one case", () => {
    expect(buildMonthShare({ month: "2026-09", makeup: makeup({ decided: 1, certified: 0, denied: 0, withdrawn: 1 }), asOf: "2026-11-05", line: null }).lead).toBe(
      "1 of the 20,000 PERM applications filed in September 2026 has a decision.",
    );
    expect(buildMonthShare({ month: "2026-10", makeup: makeup({ decided: 0, certified: 0, denied: 0, withdrawn: 0 }), asOf: "2026-11-05", line: null }).lead).toBe(
      "None of the 20,000 PERM applications filed in October 2026 has a decision yet.",
    );
    expect(buildMonthShare({ month: "2026-10", makeup: makeup({ total: 1, decided: 0, certified: 0, denied: 0, withdrawn: 0, inLine: 1, outside: 0 }), asOf: "2026-11-05", line: null }).lead).toBe(
      "The one PERM application filed in October 2026 has no decision yet.",
    );
  });

  it("says all, not a fraction, when every decision is a withdrawal, and leaves DOL's reach out when DOL is past the month", () => {
    const m = buildMonthShare({
      month: "2025-10",
      makeup: makeup({ total: 9000, decided: 40, certified: 0, denied: 0, withdrawn: 40, inLine: 8900, outside: 60 }),
      asOf: "2026-11-05",
      line: { month: "2026-01", asOf: "2026-11-05" },
    });
    expect(m.note).toBe("All 40 decided are withdrawals, which employers file.");
  });

  it("refuses a census day that isn't one, so the picture never carries an undated count", () => {
    expect(() => buildMonthShare({ month: "2026-02", makeup: makeup(), asOf: "Nov 5", line: null })).toThrow();
  });

  it("is the month page's own status bar: the same parts in the same order", () => {
    expect(monthParts(makeup({ otherDecided: 3 })).map((p) => [p.key, p.count])).toEqual([
      ["certified", 7003],
      ["denied", 200],
      ["withdrawn", 1000],
      ["inLine", 11000],
      ["outside", 800],
    ]);
  });
});
