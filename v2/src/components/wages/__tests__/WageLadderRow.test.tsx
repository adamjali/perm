import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Ladder } from "@/lib/wageLadder";

import { WageLadderRow, ladderTip } from "../WageLadderRow";

const LADDER: Ladder = {
  label: "Software Developers",
  key: "15-1252",
  count: 4210,
  p5: 90000,
  p10: 101000,
  p25: 120500,
  p50: 142000,
  p75: 168000,
  p90: 190000,
  p95: 205000,
  mean: 145000,
};

describe("WageLadderRow tooltips", () => {
  it("names every rung, which the row draws but prints only three of, and its population", () => {
    expect(ladderTip(LADDER)).toBe(
      [
        "Software Developers",
        "5th percentile: $90,000",
        "10th percentile: $101,000",
        "25th percentile: $120,500",
        "Median: $142,000",
        "75th percentile: $168,000",
        "90th percentile: $190,000",
        "95th percentile: $205,000",
        "4,210 certified cases",
      ].join("\n"),
    );
  });

  it("carries the tip on the drawn row, and nothing when the ladder is withheld", () => {
    const { container, rerender } = render(<WageLadderRow ladder={LADDER} domain={[80000, 220000]} />);
    expect(container.querySelector("[data-tip]")?.getAttribute("data-tip")).toContain("Median: $142,000");
    rerender(<WageLadderRow ladder={{ ...LADDER, p90: null }} domain={[80000, 220000]} />);
    expect(container.querySelector("[data-tip]")).toBeNull();
  });
});
