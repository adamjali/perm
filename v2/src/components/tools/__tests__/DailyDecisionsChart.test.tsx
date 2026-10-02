import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DailyDecisionsChart } from "../DailyDecisionsChart";

/** One weekday row per day from `from` for `days` days, `n` decisions each. */
function series(from: string, days: number, n = 100) {
  const out: { date: string; total: number }[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push({ date: d.toISOString().slice(0, 10), total: n });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe("DailyDecisionsChart", () => {
  it("draws weeks for a record under three years", () => {
    const { container } = render(<DailyDecisionsChart points={series("2024-01-01", 700)} />);
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toMatch(/^Decisions per week from/);
    expect(container.textContent).toContain("Weekly totals");
  });

  it("draws months once the record runs past three years", () => {
    const { container } = render(<DailyDecisionsChart points={series("2015-10-01", 3_900)} />);
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toMatch(/^Decisions per month from/);
    expect(container.textContent).toContain("Monthly totals");
    const pts = container.querySelector("polyline")?.getAttribute("points")?.split(" ") ?? [];
    // About 128 months, less the partial first and last: far from 550 weeks.
    expect(pts.length).toBeGreaterThan(100);
    expect(pts.length).toBeLessThan(140);
  });
});
