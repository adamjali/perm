import { describe, expect, it } from "vitest";

import { homeMonths } from "@/lib/homeMonths";

const months = [
  { month: "2025-08", decided: 900, pending: 10 },
  { month: "2025-09", decided: 800, pending: 20 },
  // October 2025 is missing: the shutdown month.
  { month: "2025-11", decided: 700, pending: 300 },
  { month: "2025-12", decided: 600, pending: 900 },
  { month: "2026-01", decided: 100, pending: 1400 },
  { month: "2026-02", decided: 5, pending: 1500 },
];

describe("homeMonths", () => {
  it("draws every month from five before the front to this month, gaps included", () => {
    const w = homeMonths(months, "2026-01-01", "2026-03");
    expect(w.map((m) => m.month)).toEqual([
      "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
    ]);
    const oct = w.find((m) => m.month === "2025-10")!;
    expect(oct).toMatchObject({ decided: 0, waiting: 0, total: 0 });
  });

  it("marks the front month and the month still taking filings", () => {
    const w = homeMonths(months, "2026-01", "2026-03");
    expect(w.filter((m) => m.isFront).map((m) => m.month)).toEqual(["2026-01"]);
    expect(w.filter((m) => m.isPartial).map((m) => m.month)).toEqual(["2026-03"]);
    expect(w.find((m) => m.month === "2026-01")).toMatchObject({ decided: 100, waiting: 1400, total: 1500 });
  });

  it("draws nothing for an unreadable or impossible front", () => {
    expect(homeMonths(months, null, "2026-03")).toEqual([]);
    expect(homeMonths(months, "Jan 2026", "2026-03")).toEqual([]);
    expect(homeMonths(months, "2026-05", "2026-03")).toEqual([]);
    expect(homeMonths(months, "2026-01", "March")).toEqual([]);
  });
});
