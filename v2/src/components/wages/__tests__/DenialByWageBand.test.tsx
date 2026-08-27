import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { toBands, type Ladder, type WageBandSeries } from "@/lib/wageLadder";

import { DenialByWageBand } from "../DenialByWageBand";
import { LadderByYear } from "../LadderByYear";

const counts = (xs: number[]) =>
  toBands(
    xs.map((pct, i) => ({
      from: [0, 60_000, 80_000, 100_000, 130_000][i]!,
      decided: 10_000,
      denied: Math.round(100 * pct),
    })),
  );

/** The measured shapes: FY2024 falls, FY2025 and FY2026 hump, pooled flattens. */
const BY_YEAR: WageBandSeries[] = [
  { fiscalYear: "2024", bands: counts([9.44, 5.65, 3.87, 2.7, 1.47]) },
  { fiscalYear: "2025", bands: counts([2.57, 3.61, 1.53, 1.2, 0.82]) },
  { fiscalYear: "2026", bands: counts([4.94, 6.62, 3.44, 2.44, 2.24]) },
];
const POOLED = counts([5.22, 5.21, 2.88, 2.04, 1.47]);

describe("DenialByWageBand", () => {
  it("states the reading above the drawing, not under it", () => {
    // A reader who forms an impression from the pooled panel and only then
    // reaches the caveat has already been misled. Same rule the calculators
    // follow: doubt goes above the figures.
    const { container } = render(
      <DenialByWageBand byYear={BY_YEAR} pooled={POOLED} />,
    );
    const reading = screen.getByText(/does not fall in a straight line/i);
    const grid = container.querySelector(".grid");
    expect(grid).not.toBeNull();
    expect(
      reading.compareDocumentPosition(grid as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("names the years that hump and the years that fall, from the data", () => {
    render(<DenialByWageBand byYear={BY_YEAR} pooled={POOLED} />);
    const text = screen.getByText(/does not fall in a straight line/i).textContent ?? "";
    expect(text).toContain("FY2025 and FY2026");
    expect(text).toContain("FY2024");
  });

  it("draws a panel per year plus the pooled window", () => {
    render(<DenialByWageBand byYear={BY_YEAR} pooled={POOLED} />);
    expect(screen.getByText("FY2024")).toBeTruthy();
    expect(screen.getByText("FY2026")).toBeTruthy();
    expect(screen.getByText("All three years")).toBeTruthy();
  });

  it("prints 'withheld' for a band under the floor instead of a bar", () => {
    const thin = toBands([{ from: 0, decided: 9, denied: 9 }]);
    render(
      <DenialByWageBand
        byYear={[{ fiscalYear: "2026", bands: thin }]}
        pooled={thin}
      />,
    );
    expect(screen.getAllByText("withheld").length).toBeGreaterThan(0);
  });

  it("carries the population beside every band", () => {
    render(<DenialByWageBand byYear={BY_YEAR} pooled={POOLED} />);
    expect(screen.getAllByText("10,000").length).toBeGreaterThan(0);
  });

  it("offers no cause for the shape", () => {
    render(<DenialByWageBand byYear={BY_YEAR} pooled={POOLED} />);
    expect(screen.getByText(/not established here/i)).toBeTruthy();
  });
});

const year = (fy: string, count: number, p50: number): Ladder => ({
  label: `FY${fy}`,
  key: fy,
  count,
  p5: p50 * 0.64,
  p10: p50 * 0.71,
  p25: p50 * 0.84,
  p50,
  p75: p50 * 1.15,
  p90: p50 * 1.33,
  p95: p50 * 1.44,
  mean: p50 * 1.01,
});

describe("LadderByYear", () => {
  it("warns when the years are not measuring the same population", () => {
    // The real Meat Cutters shape: 756 certified cases in FY2024 against
    // 6,165 in FY2025, with the median falling 10.7%. Reading that as a pay
    // cut is the mistake this guard exists to stop.
    render(
      <LadderByYear
        years={[year("2024", 756, 29_120), year("2025", 6_165, 26_000)]}
      />,
    );
    expect(screen.getByText(/not measuring the same group/i)).toBeTruthy();
  });

  it("stays quiet when the counts are comparable", () => {
    // Software Developers: 18,275 then 23,460, a ratio of 1.28.
    render(
      <LadderByYear
        years={[year("2024", 18_275, 134_992), year("2026", 23_460, 142_002)]}
      />,
    );
    expect(screen.queryByText(/not measuring the same group/i)).toBeNull();
  });

  it("reports the move rung by rung, not just at the median", () => {
    const { container } = render(
      <LadderByYear
        years={[year("2024", 18_275, 100_000), year("2026", 20_000, 110_000)]}
      />,
    );
    const dl = container.querySelector("dl");
    expect(dl).not.toBeNull();
    expect(within(dl as HTMLElement).getAllByText(/\+10\.0% since FY2024/)).toHaveLength(4);
  });

  it("renders nothing with a single year, which has nothing to compare", () => {
    const { container } = render(<LadderByYear years={[year("2026", 100, 90_000)]} />);
    expect(container.firstChild).toBeNull();
  });
});
