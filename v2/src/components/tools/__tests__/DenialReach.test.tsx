import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { DenialReach } from "../DenialReach";

/**
 * The component exists because a rate and a share point in opposite directions
 * on this data, so the tests that matter are the ones proving both are shown
 * and that neither is silently turned into the other.
 *
 * Figures below are the real ones from the current disclosure window, so a
 * change in the shape of the data shows up here as a deliberate edit rather
 * than as a component that quietly keeps rendering.
 */
const TOTAL_DECIDED = 355130;
const TOTAL_DENIED = 11357;

const FLAGS = [
  { label: "Employer had a layoff", decided: 10222, denied: 56 },
  { label: "Worker has an ownership interest", decided: 1308, denied: 275 },
  { label: "Position isn’t full time", decided: 396, denied: 215 },
];

function renderReach() {
  return render(
    <DenialReach
      rows={FLAGS}
      totalDecided={TOTAL_DECIDED}
      totalDenied={TOTAL_DENIED}
      label="Denial reach by declared factor"
      unitLabel="Declared factor"
      caption="Each declared factor's share of decided cases and share of all denials"
    />,
  );
}

/** The pane `DataView` is currently showing; both are in the served HTML. */
function visible(container: HTMLElement): HTMLElement {
  const shown = Array.from(container.querySelectorAll<HTMLElement>("div"))
    .filter((el) => el.hasAttribute("hidden") === false)
    .find((el) => el.querySelector("ul,table"));
  if (!shown) throw new Error("no visible DataView pane");
  return shown;
}

describe("DenialReach", () => {
  it("shows reach and share as two labelled numbers, never one blended figure", () => {
    const { container } = render(
      <DenialReach
        rows={[{ label: "Position isn’t full time", decided: 396, denied: 215 }]}
        totalDecided={TOTAL_DECIDED}
        totalDenied={TOTAL_DENIED}
        label="x"
        unitLabel="Declared factor"
        caption="y"
      />,
    );
    const pane = within(visible(container));
    // 396 / 355,130 = 0.11% of cases. 215 / 11,357 = 1.9% of denials.
    expect(pane.getByText("0.1% of cases")).toBeInTheDocument();
    expect(pane.getByText("1.9% of denials")).toBeInTheDocument();
    // The rate (54%) belongs to the rate views on the same page. If it ever
    // appears here the two modules have started saying the same thing.
    expect(pane.queryByText(/54/)).not.toBeInTheDocument();
  });

  it("prints the numerator and denominator behind every pair", () => {
    const { container } = render(
      <DenialReach
        rows={[{ label: "Worker has an ownership interest", decided: 1308, denied: 275 }]}
        totalDecided={TOTAL_DECIDED}
        totalDenied={TOTAL_DENIED}
        label="x"
        unitLabel="Declared factor"
        caption="y"
      />,
    );
    expect(
      within(visible(container)).getByText("275 of 1,308 denied"),
    ).toBeInTheDocument();
  });

  it("scales both series against one maximum", () => {
    // Two bars on separate scales invite a comparison that isn't there. The
    // whole reading of the module is solid-longer-than-outline.
    const { container } = renderReach();
    const widths = Array.from(
      visible(container).querySelectorAll<HTMLElement>("li div[role='img']"),
    ).map((el) => Number.parseFloat(el.style.width));
    // Layoff reaches 2.9% of cases, the largest value in either series here,
    // so it and only it is drawn at full width.
    expect(Math.max(...widths)).toBeCloseTo(100, 5);
    expect(widths.filter((w) => w === 100)).toHaveLength(1);
  });

  it("separates the two series by fill, not by opacity", () => {
    // Two shapes differing only in alpha get read as one thing and end up
    // sharing a caption. These mean opposite things when they diverge.
    const { container } = renderReach();
    const bars = Array.from(
      visible(container).querySelectorAll<HTMLElement>("li div[role='img']"),
    );
    const reach = bars.filter((b) => b.getAttribute("aria-label")!.includes("decided"));
    const share = bars.filter((b) => b.getAttribute("aria-label")!.includes("denials"));
    expect(reach).toHaveLength(FLAGS.length);
    expect(share).toHaveLength(FLAGS.length);
    expect(reach[0]!.className).toContain("bg-background");
    expect(share[0]!.className).toContain("bg-primary");
    expect(reach[0]!.className).not.toContain("opacity");
    expect(share[0]!.className).not.toContain("opacity");
  });

  it("gives every bar its own accessible name", () => {
    const { container } = renderReach();
    const bars = within(visible(container)).getAllByRole("img");
    expect(bars).toHaveLength(FLAGS.length * 2);
    for (const bar of bars) {
      expect(bar.getAttribute("aria-label")).toMatch(/of all (decided cases|denials)$/);
    }
  });

  it("carries the same figures in the table view", () => {
    // The table is what a crawler and a reader without JavaScript get.
    const { container } = renderReach();
    fireEvent.click(screen.getByRole("button", { name: /figures/i }));
    const pane = within(visible(container));
    expect(pane.getByText("10,222")).toBeInTheDocument();
    expect(pane.getByText("215")).toBeInTheDocument();
  });
});
