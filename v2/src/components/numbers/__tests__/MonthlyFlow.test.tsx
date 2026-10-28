import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { monthlyFlow } from "@/lib/byTheNumbers";

import { MonthlyFlow, flowPeriods, monthsIn, namedMonths } from "../MonthlyFlow";

const flow = monthlyFlow({
  from: "2025-11",
  today: "2026-10-28",
  filed: [
    { month: "2025-11", total: 15000 },
    { month: "2026-10", total: 3000 },
  ],
  decided: [
    { month: "2025-11", source: "dol-disclosure", total: 100, certified: 90, denied: 5, withdrawn: 5 },
    { month: "2026-09", source: "sweep-observed", total: 200, certified: 180, denied: 10, withdrawn: 10 },
  ],
  spans: [
    { source: "dol-disclosure", first: "2015-10-01", last: "2026-06-30" },
    { source: "sweep-observed", first: "2026-08-27", last: "2026-10-26" },
  ],
});

describe("MonthlyFlow", () => {
  it("offers the whole run, each year and the last twelve months", () => {
    expect(flowPeriods(flow).map((p) => p.label)).toEqual(["Since 2025", "2025", "2026", "Last 12 months"]);
    expect(monthsIn(flow, "2025").map((m) => m.month)).toEqual(["2025-11", "2025-12"]);
    expect(monthsIn(flow, "12")).toHaveLength(12);
  });

  it("names the months with no record instead of drawing them as zero", () => {
    expect(namedMonths(["2026-07", "2026-08"])).toBe("July 2026 and August 2026");
    expect(namedMonths(["2026-05", "2026-07", "2026-08"])).toBe("May 2026, July 2026 and August 2026");
    render(<MonthlyFlow months={flow} gapReason="the reason." />);
    expect(screen.getByText(/have no complete record: the reason\./)).toBeTruthy();
  });

  it("totals the months picked, and switching the period changes them", () => {
    render(<MonthlyFlow months={flow} gapReason="r." />);
    const total = (text: string) => screen.queryAllByText(text).some((e) => e.tagName === "DD");
    expect(total("18,000")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "2025" }));
    expect(screen.getByRole("button", { name: "2025" }).getAttribute("aria-pressed")).toBe("true");
    expect(total("15,000")).toBe(true);
    expect(total("18,000")).toBe(false);
    expect(total("90%")).toBe(true);
  });
});
