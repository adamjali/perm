import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import {
  WAGE_BAND_EDGES_FINE,
  toBands,
  type Ladder,
  type WageBandSeries,
} from "@/lib/wageLadder";

import { DenialByWageBand } from "../DenialByWageBand";
import { LadderByYear } from "../LadderByYear";

/**
 * REAL measured counts at FINE resolution, not rates turned back into counts.
 *
 * The previous fixture built five coarse bands from rounded percentages. When
 * `toBands` moved to a fine default, that fixture kept its five coarse rows and
 * silently picked up ELEVEN-band labels, so the component rendered "under $40k
 * at 5.22%" - a coarse rate wearing a fine label. Nothing errored; one
 * assertion about the peak caught it. Fixtures are real counts now.
 */
const POOLED = toBands(
  [
    { from: 0, decided: 80_118, denied: 3_970 },
    { from: 40_000, decided: 16_436, denied: 1_193 },
    { from: 50_000, decided: 15_857, denied: 700 },
    { from: 60_000, decided: 12_690, denied: 880 },
    { from: 70_000, decided: 13_013, denied: 460 },
    { from: 80_000, decided: 15_920, denied: 435 },
    { from: 90_000, decided: 18_561, denied: 557 },
    { from: 100_000, decided: 30_188, denied: 680 },
    { from: 115_000, decided: 33_022, denied: 611 },
    { from: 130_000, decided: 65_782, denied: 891 },
    { from: 160_000, decided: 52_851, denied: 850 },
  ],
  WAGE_BAND_EDGES_FINE,
);

/** FY2024 at fine resolution: the year the coarse view wrongly called monotonic. */
const FY2024 = toBands(
  [
    { from: 0, decided: 25_469, denied: 2_412 },
    { from: 40_000, decided: 4_779, denied: 582 },
    { from: 50_000, decided: 5_034, denied: 311 },
    { from: 60_000, decided: 3_607, denied: 259 },
    { from: 70_000, decided: 3_648, denied: 155 },
    { from: 80_000, decided: 5_580, denied: 160 },
    { from: 90_000, decided: 6_167, denied: 287 },
    { from: 100_000, decided: 9_446, denied: 307 },
    { from: 115_000, decided: 10_674, denied: 234 },
    { from: 130_000, decided: 21_353, denied: 292 },
    { from: 160_000, decided: 14_332, denied: 233 },
  ],
  WAGE_BAND_EDGES_FINE,
);

const BY_YEAR: WageBandSeries[] = [{ fiscalYear: "2024", bands: FY2024 }];

describe("DenialByWageBand", () => {
  it("states the reading above the drawing, not under it", () => {
    // A reader who forms an impression from the pooled panel and only then
    // reaches the caveat has already been misled. Same rule the calculators
    // follow: doubt goes above the figures.
    const { container } = render(
      <DenialByWageBand byYear={BY_YEAR} pooled={POOLED} />,
    );
    const reading = screen.getByText(/broadly falls/i);
    const grid = container.querySelector(".grid");
    expect(grid).not.toBeNull();
    expect(
      reading.compareDocumentPosition(grid as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("never claims a year falls at every step", () => {
    // The retracted finding. At five bands FY2024 read 9.44 / 5.65 / 3.87 /
    // 2.70 / 1.47 and the page said it fell at every step. At eleven bands the
    // same cases go 9.47% then 12.18%, so the claim was a property of the
    // edges. No wording that asserts a monotonic year may come back.
    render(<DenialByWageBand byYear={BY_YEAR} pooled={POOLED} />);
    expect(screen.queryByText(/falls at every step/i)).toBeNull();
    expect(screen.queryByText(/highest rate sits in the middle/i)).toBeNull();
  });

  it("states the robust claim and names the peak it actually measured", () => {
    render(<DenialByWageBand byYear={BY_YEAR} pooled={POOLED} />);
    const text = screen.getByText(/broadly falls/i).textContent ?? "";
    expect(text).toMatch(/does not fall smoothly/i);
    // $40k to $50k at 7.26%, not the bottom of the range.
    expect(text).toContain("$40k to $50k");
    expect(text).toContain("7.26%");
  });

  it("says the bumps move with the band edges and offers no cause", () => {
    render(<DenialByWageBand byYear={BY_YEAR} pooled={POOLED} />);
    const text = screen.getByText(/broadly falls/i).textContent ?? "";
    expect(text).toMatch(/moves with the band edges/i);
    expect(text).toMatch(/entangled/i);
  });

  it("draws the fine view first and labels the coarse one as a summary", () => {
    const { container } = render(<DenialByWageBand byYear={BY_YEAR} pooled={POOLED} />);
    const fine = screen.getByText(/Eleven bands/i);
    const summary = screen.getByText(/five wide bands/i);
    expect(
      fine.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // And the summary is derived, so it must carry the coarse band labels.
    expect(container.textContent).toContain("Derived from the eleven-band view");
  });

  it("prints 'withheld' for a band under the floor instead of a bar", () => {
    const thin = toBands([{ from: 0, decided: 9, denied: 9 }], WAGE_BAND_EDGES_FINE);
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
    expect(screen.getAllByText("80,118").length).toBeGreaterThan(0);
  });

  it("shows the coarse summary summing to the same totals as the fine view", () => {
    // A summary that could disagree with its own detail is worse than none.
    render(<DenialByWageBand byYear={BY_YEAR} pooled={POOLED} />);
    expect(screen.getAllByText("112,411").length).toBeGreaterThan(0);
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
