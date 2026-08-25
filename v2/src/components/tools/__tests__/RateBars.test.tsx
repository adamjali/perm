import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { RateBars, type RateRow } from "../RateBars";

/**
 * The bars carry a claim about denial rates, so the tests are about honesty:
 * every row shows its own denominator, the baseline is drawn and named, and a
 * rate above the field is visibly distinguished from one below it.
 */

const ROWS: RateRow[] = [
  { label: "Position is not full time", rate: 54.31, decided: 383 },
  { label: "Worker has an ownership interest", rate: 25.74, decided: 338 },
  { label: "Employer had a layoff", rate: 0.59, decided: 9519 },
];

describe("RateBars", () => {
  it("renders nothing rather than an empty frame when it has no rows", () => {
    const { container } = render(<RateBars rows={[]} baseline={2.57} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows every row's own denominator, because a rate over 383 cases and one over 9,519 are different claims", () => {
    render(<RateBars rows={ROWS} baseline={2.57} />);
    expect(screen.getByText(/of 383/)).toBeInTheDocument();
    expect(screen.getByText(/of 9,519/)).toBeInTheDocument();
  });

  it("names the baseline it draws", () => {
    render(<RateBars rows={ROWS} baseline={2.57} />);
    expect(screen.getByText(/Field baseline, 2\.57%/)).toBeInTheDocument();
  });

  it("distinguishes above-baseline rows from below-baseline ones", () => {
    const { container } = render(<RateBars rows={ROWS} baseline={2.57} />);
    // Two rows sit above the baseline (54.31, 25.74) and one below (0.59).
    expect(container.querySelectorAll(".bg-foreground.h-full")).toHaveLength(2);
    expect(container.querySelectorAll(".bg-primary.h-full")).toHaveLength(1);
  });

  it("keeps a small rate visible instead of collapsing it to nothing", () => {
    const { container } = render(<RateBars rows={ROWS} baseline={2.57} />);
    const bars = [...container.querySelectorAll<HTMLElement>(".h-full")];
    const tiny = bars[bars.length - 1]!;
    expect(parseFloat(tiny.style.width)).toBeGreaterThanOrEqual(1.5);
  });

  it("renders a bucket note when one is supplied", () => {
    render(
      <RateBars
        rows={[{ label: "Part time", note: "Form 9089, Section G, Item 1.", rate: 54.31, decided: 383 }]}
        baseline={2.57}
      />,
    );
    expect(screen.getByText(/Section G, Item 1/)).toBeInTheDocument();
  });
});
