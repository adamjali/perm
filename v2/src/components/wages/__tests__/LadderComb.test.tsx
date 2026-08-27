import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import type { Ladder } from "@/lib/wageLadder";

import { LadderComb, TwoMarketsNote } from "../LadderComb";
import { WageLadderRow } from "../WageLadderRow";
import { axisTicks, niceStep, WageAxis } from "../WageAxis";
import { SplitLadderNote } from "../SplitLadderNote";

/**
 * The doctrine, not the layout.
 *
 * Three things have to hold whatever this is restyled into: the caller's
 * ORDER survives (the two-markets figure is only a finding while the rows are
 * in volume order), an incomplete ladder is withheld rather than drawn short,
 * and the separation sentence is derived from the numbers instead of typed,
 * so it stops making the claim when the claim stops being true.
 */

const software: Ladder = {
  label: "Software Developers",
  key: "15-1252.00",
  count: 73_058,
  p5: 89_565,
  p10: 98_904,
  p25: 116_938,
  p50: 139_027,
  p75: 159_810,
  p90: 184_662,
  p95: 199_779,
  mean: 140_930,
};

const meat: Ladder = {
  label: "Meat, Poultry, and Fish Cutters and Trimmers",
  key: "51-3022.00",
  count: 9_214,
  p5: 22_464,
  p10: 22_464,
  p25: 23_000,
  p50: 26_000,
  p75: 30_202,
  p90: 31_200,
  p95: 31_408,
  mean: 26_800,
};

const fastFood: Ladder = {
  label: "Fast Food and Counter Workers",
  key: "35-3023.00",
  count: 7_489,
  p5: 20_800,
  p10: 21_000,
  p25: 22_880,
  p50: 26_390,
  p75: 30_940,
  p90: 33_000,
  p95: 34_320,
  mean: 26_900,
};

describe("WageLadderRow", () => {
  it("places every rung as a percentage of the shared domain", () => {
    const { container } = render(
      <WageLadderRow ladder={software} domain={[0, 200_000]} />,
    );
    const spans = [...container.querySelectorAll<HTMLElement>("span[style]")];
    const lefts = spans.map((s) => s.style.left);
    // p5 at 89,565 of 200,000 is 44.78%; the median at 139,027 is 69.51%.
    expect(lefts).toContain("44.7825%");
    expect(lefts.some((l) => l.startsWith("69.51"))).toBe(true);
  });

  it("clamps a value outside the domain instead of drawing past the track", () => {
    const { container } = render(
      <WageLadderRow ladder={software} domain={[100_000, 150_000]} />,
    );
    const lefts = [...container.querySelectorAll<HTMLElement>("span[style]")].map(
      (s) => parseFloat(s.style.left),
    );
    expect(Math.min(...lefts)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...lefts)).toBeLessThanOrEqual(100);
  });

  it("withholds an incomplete ladder rather than drawing a short one", () => {
    render(
      <WageLadderRow ladder={{ ...software, p95: null }} domain={[0, 200_000]} />,
    );
    expect(screen.getByText(/No ladder is published/i)).toBeTruthy();
  });

  it("carries its own figures in the accessible name", () => {
    render(<WageLadderRow ladder={software} domain={[0, 200_000]} />);
    const img = screen.getByRole("img");
    const label = img.getAttribute("aria-label") ?? "";
    expect(label).toContain("$89,565");
    expect(label).toContain("$139,027");
    expect(label).toContain("73,058");
  });
});

describe("LadderComb", () => {
  it("renders rows in the order given, never re-sorted by wage", () => {
    // The finding is the alternation. Sorting by wage inside the component
    // would turn the figure into an ordinary ranking without anything
    // visibly breaking.
    const order = [software, meat, fastFood];
    const { container } = render(<LadderComb ladders={order} />);
    // Scoped to the row list: the key above it is also a <ul> of <li>, and an
    // unscoped selector counts four legend entries as ladders.
    const labels = [...container.querySelectorAll("ol > li p:first-child")].map(
      (p) => p.textContent?.trim(),
    );
    expect(labels).toEqual(order.map((l) => l.label));
  });

  it("drops an incomplete ladder from the set instead of drawing it", () => {
    const { container } = render(
      <LadderComb ladders={[software, { ...meat, p50: null }]} />,
    );
    expect(container.querySelectorAll("ol > li")).toHaveLength(1);
  });

  it("renders nothing when no ladder in the set is drawable", () => {
    const { container } = render(
      <LadderComb ladders={[{ ...software, p5: null }]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("prints each row's population next to its median", () => {
    render(<LadderComb ladders={[software]} />);
    expect(screen.getByText(/\$139,027 median · 73,058 certified cases/)).toBeTruthy();
  });
});

describe("TwoMarketsNote", () => {
  it("states the separation when the ladders really are disjoint", () => {
    render(<TwoMarketsNote ladders={[software, meat, fastFood]} />);
    const text = screen.getByText(/do not meet/i).textContent ?? "";
    expect(text).toContain("$89,565");
    // 89,565 / 31,408 = 2.85.
    expect(text).toContain("2.9 times");
  });

  it("says so instead when the extremes overlap", () => {
    // The point of deriving the sentence: a future ingest that closes the gap
    // must not leave a claim on the page that the data no longer supports.
    const overlapping: Ladder = { ...meat, p95: 120_000, p90: 110_000 };
    render(<TwoMarketsNote ladders={[software, overlapping]} />);
    expect(screen.queryByText(/do not meet/i)).toBeNull();
    expect(screen.getByText(/now overlap/i)).toBeTruthy();
  });

  it("renders nothing with fewer than two drawable ladders", () => {
    const { container } = render(<TwoMarketsNote ladders={[software]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("SplitLadderNote", () => {
  /** Georgia: poultry processing and Atlanta software through one process. */
  const georgia: Ladder = {
    label: "GA", key: "GA", count: 21_597,
    p5: 19_635, p10: 20_571, p25: 24_360, p50: 30_202,
    p75: 100_000, p90: 137_000, p95: 150_000, mean: 61_620,
  };
  const california: Ladder = {
    label: "CA", key: "CA", count: 61_569,
    p5: 36_400, p10: 51_888, p25: 104_000, p50: 142_000,
    p75: 176_134, p90: 204_257, p95: 226_325, mean: 139_219,
  };

  it("names the ladder that jumps and quotes the jump it measured", () => {
    render(<SplitLadderNote ladders={[california, georgia]} />);
    const text = screen.getByText(/jump rather than climb/i).textContent ?? "";
    expect(text).toContain("GA");
    expect(text).toContain("3.3 times");
    expect(text).toContain("$30,202");
    expect(text).toContain("$100,000");
  });

  it("stays silent for a wide but single distribution", () => {
    // California is the calibration case: 2.00x, the widest ladder on the site
    // that is still ONE population. A threshold that names it names half the
    // country and therefore says nothing. Derived, not typed, so an ingest
    // that evens the rungs out removes the sentence rather than leaving a
    // claim behind.
    const { container } = render(<SplitLadderNote ladders={[california]} />);
    expect(container.firstChild).toBeNull();
  });

  it("ignores an incomplete ladder rather than measuring a partial one", () => {
    const { container } = render(
      <SplitLadderNote ladders={[{ ...georgia, p75: null }]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("WageAxis", () => {
  it("picks a round step rather than dividing the span evenly", () => {
    expect(niceStep(180_000, 5)).toBe(50_000);
    expect(niceStep(9_000, 5)).toBe(2_000);
  });

  it("puts every tick on a round dollar inside the domain", () => {
    const ticks = axisTicks([20_000, 210_000], 5);
    expect(ticks).toEqual([50_000, 100_000, 150_000, 200_000]);
  });

  it("turns the end labels inward so neither runs past the track", () => {
    const { container } = render(<WageAxis domain={[0, 200_000]} />);
    const labels = [...container.querySelectorAll("span.font-mono")];
    expect(labels.length).toBeGreaterThan(2);
    expect(labels[0]!.className).toContain("translate-x-0");
    expect(labels[labels.length - 1]!.className).toContain("-translate-x-full");
    expect(labels[1]!.className).toContain("-translate-x-1/2");
  });

  it("never picks a step its own formatter cannot show", () => {
    // moneyShort rounds to thousands, so a sub-$1,000 step draws several
    // ticks at different positions all reading "$100k".
    expect(niceStep(1, 5)).toBeGreaterThanOrEqual(1_000);
    expect(niceStep(600, 5)).toBeGreaterThanOrEqual(1_000);
  });

  it("renders nothing when the domain admits no round tick", () => {
    const { container } = render(<WageAxis domain={[100_001, 100_002]} ticks={5} />);
    expect(container.firstChild).toBeNull();
  });
});
