import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PermTimelineEstimator } from "../PermTimelineEstimator";

/**
 * Both branches of the envelope headline.
 *
 * A range whose endpoints are equal is one date printed twice with a grey
 * "to" between it, and it reads as a bug. Collapsing it is a presentational
 * ternary on string equality, which is exactly the kind of line somebody
 * later "simplifies" back out. This pins both sides.
 *
 * The distinction that matters: collapsing a DEGENERATE range is not
 * averaging different model answers into one confident number. When two
 * models disagree the spread is the finding and it stays on the page.
 */

const FRONTIER = {
  analystQueueMonth: "2025-09",
  officialAvgDays: 372,
  asOf: "2026-08-20",
};

function renderEstimator(extra: Record<string, unknown> = {}) {
  return render(
    <PermTimelineEstimator
      frontier={FRONTIER}
      cohorts={[]}
      frontierAdvance={null}
      disclosure={null}
      today="2026-08-26"
      {...extra}
    />,
  );
}

describe("PermTimelineEstimator envelope headline", () => {
  it("prints one date when only one model can answer", () => {
    // Model A alone: DOL's published average, which carries no earliest or
    // latest bound, so both ends of the envelope are the same month.
    renderEstimator();
    const heading = screen.getByText(/Likely decision window/).parentElement;
    expect(heading).toHaveTextContent("September 2026");
    expect(heading).not.toHaveTextContent(/September 2026\s*to\s*September 2026/);
    expect(screen.getByText(/One model has enough published data/)).toBeInTheDocument();
  });

  it("keeps both ends when the models actually disagree", () => {
    // Adding a measured advance rate with a slowest and fastest brings in a
    // second model with its own bounds, so there is a real spread to show.
    renderEstimator({
      frontierAdvance: {
        rate: 0.9,
        fromMonth: "2026-01",
        toMonth: "2026-06",
        pointsUsed: 6,
        slowest: 0.5,
        fastest: 1.4,
      },
    });
    // The queue-advance model answers "how long until DOL reaches you", so it
    // only exists for a month AHEAD of the frontier. At the default month the
    // queue is already there and there is genuinely one model, which is the
    // first test.
    fireEvent.change(screen.getByLabelText(/Month DOL received/i), {
      target: { value: "2026-03" },
    });
    const heading = screen.getByText(/Likely decision window/).parentElement;
    const headline = heading?.querySelector("p.font-heading")?.textContent ?? "";
    expect(headline).toContain(" to ");
    // Two DIFFERENT months, which is what makes the range a range. Asserting
    // only on " to " would pass on the degenerate output this guards against.
    const months = headline.split(" to ").map((s) => s.trim());
    expect(months).toHaveLength(2);
    expect(months[0]).not.toBe(months[1]);
  });
});
