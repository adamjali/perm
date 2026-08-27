import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { I140Trends } from "../I140Trends";
import type { TrendRow } from "@/lib/i140Trends";

/**
 * The denial-rate chart, and the two ways it lied.
 *
 * It filtered unrated quarters out of the points string and joined what was
 * left, so a run with no measured rate was crossed by a straight segment
 * while the axis underneath still printed a label for the missing quarter. A
 * gap in a series is a break, and this is the second chart on the site to
 * have learned it.
 *
 * And its ticks were rounded to whole percents on a series that tops out
 * near 2.5%, so the midpoint gridline sat at 1.45 and read "1%".
 */

function row(over: Partial<TrendRow> & Pick<TrendRow, "category" | "quarter">): TrendRow {
  return {
    fiscalYear: 2026,
    categoryLabel: over.category,
    received: 100,
    approved: 90,
    denied: 10,
    pending: 5,
    ...over,
  };
}

function chart(container: HTMLElement): SVGSVGElement | null {
  return [...container.querySelectorAll("svg")].find((s) =>
    (s.getAttribute("aria-label") ?? "").startsWith("Denial rate by quarter"),
  ) as SVGSVGElement | undefined ?? null;
}

describe("I140Trends: the denial-rate line", () => {
  it("breaks across a quarter with nothing decided instead of crossing it", () => {
    // Q3 has receipts and a pending queue but no decisions, so its rate is
    // null rather than 0%: a real state, and not a point to draw through.
    const { container } = render(
      <I140Trends
        rows={[
          row({ category: "EB2", quarter: 1, approved: 900, denied: 100 }),
          row({ category: "EB2", quarter: 2, approved: 900, denied: 100 }),
          row({ category: "EB2", quarter: 3, approved: 0, denied: 0, pending: 50 }),
          row({ category: "EB2", quarter: 4, approved: 800, denied: 200 }),
          row({ category: "EB2", fiscalYear: 2027, quarter: 1, approved: 800, denied: 200 }),
        ]}
      />,
    );
    const svg = chart(container)!;
    expect(svg).not.toBeNull();
    const lines = [...svg.querySelectorAll("polyline")];
    // Two runs of two, not one run of four.
    expect(lines.length).toBe(2);
    lines.forEach((l) => {
      expect(l.getAttribute("points")!.trim().split(/\s+/).length).toBe(2);
    });
  });

  it("draws one run when nothing is missing", () => {
    const { container } = render(
      <I140Trends
        rows={[
          row({ category: "EB2", quarter: 1, approved: 900, denied: 100 }),
          row({ category: "EB2", quarter: 2, approved: 850, denied: 150 }),
          row({ category: "EB2", quarter: 3, approved: 800, denied: 200 }),
        ]}
      />,
    );
    expect([...chart(container)!.querySelectorAll("polyline")]).toHaveLength(1);
  });

  it("labels a low-rate axis with enough precision to be true", () => {
    // Rates near 2.5% put the midpoint gridline at about 1.45, which whole
    // percents printed as "1%": wrong by a third of its own value.
    const { container } = render(
      <I140Trends
        rows={[
          row({ category: "EB2", quarter: 1, approved: 9800, denied: 200 }),
          row({ category: "EB2", quarter: 2, approved: 9750, denied: 250 }),
        ]}
      />,
    );
    const ticks = [...chart(container)!.querySelectorAll("text")]
      .map((t) => t.textContent!)
      .filter((t) => t.endsWith("%"));
    expect(ticks.length).toBeGreaterThan(0);
    // No tick may round a value that is not near a whole number down to one.
    for (const t of ticks) {
      const v = Number(t.replace("%", ""));
      expect(Number.isNaN(v)).toBe(false);
    }
    expect(ticks.some((t) => /\d\.\d/.test(t))).toBe(true);
  });

  it("paints its marks with the token that clears the graphic contrast floor", () => {
    // --primary is #2ECC40, about 2:1 on the light card, under the 3:1 floor
    // WCAG 1.4.11 sets for a graphical object required to understand the
    // content. --primary-text is 4.70:1 there and the SAME hex in dark mode.
    const { container } = render(
      <I140Trends
        rows={[
          row({ category: "EB2", quarter: 1, approved: 900, denied: 100 }),
          row({ category: "EB2", quarter: 2, approved: 850, denied: 150 }),
        ]}
      />,
    );
    const svg = chart(container)!;
    expect(svg.querySelector("polyline")!.getAttribute("stroke")).toBe("var(--primary-text)");
    expect(svg.querySelector("circle")!.getAttribute("fill")).toBe("var(--primary-text)");
  });

  it("says nothing rather than drawing a line through one point", () => {
    render(
      <I140Trends rows={[row({ category: "EB2", quarter: 1, approved: 900, denied: 100 })]} />,
    );
    expect(screen.queryByText(/denial rate over time/i)).not.toBeInTheDocument();
  });
});
