import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PermTimelineEstimator } from "../PermTimelineEstimator";

/**
 * ONE ANSWER, and a day only when a day is earned.
 *
 * The page used to render every model side by side, each date at `text-4xl`,
 * so a reader met up to four equally loud and different answers and was left
 * to pick. Adam, 2026-09-10: "everything should be focused on one main answer,
 * and the rest is secondary and you can see it if you'd like but not the main
 * thing."
 *
 * And the day: only the counting model (decision pace) places a case inside
 * its filing month. The employer initial used to as well; it was removed on
 * 2026-09-26 after scoring worse than no shift (typical miss 3.9 -> 6.5 days
 * over 7,112 real decisions), so month-anchored models print a month.
 */
const FRONTIER = {
  analystQueueMonth: "2025-09",
  officialAvgDays: 372,
  asOf: "2026-08-20",
};

function renderEstimator(extra: Record<string, unknown> = {}) {
  return render(
    <PermTimelineEstimator
      initialMonth="2025-09"
      frontier={FRONTIER}
      cohorts={[]}
      frontierAdvance={null}
      disclosure={null}
      today="2026-08-26"
      {...extra}
    />,
  );
}

describe("one main answer", () => {
  it("puts the working behind a disclosure, not beside the answer", () => {
    renderEstimator();
    // The answer is present and unconditional.
    expect(screen.getByText(/^Around September 2026$/)).toBeInTheDocument();
    // The models are reachable, but closed by default.
    const summary = screen.getByText(/How this was worked out/);
    expect(summary).toBeInTheDocument();
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details!.hasAttribute("open")).toBe(false);
  });

  it("names which model the headline came from", () => {
    renderEstimator();
    // Without this the disclosure lists dates that differ from the headline
    // with nothing saying which one it is.
    expect(screen.getByText(/the one above/)).toBeInTheDocument();
  });
});

describe("the employer initial is gone (2026-09-26)", () => {
  it("asks for no employer initial at all", () => {
    renderEstimator();
    expect(screen.queryByLabelText(/first letter of the employer/i)).toBeNull();
    expect(document.body.textContent).not.toContain("whole alphabet is worth about");
  });

  it("keeps the anchor at a month when the counting model cannot run", () => {
    renderEstimator();
    const anchor = screen.getByText(/^Around /);
    expect(anchor.textContent).toMatch(/^Around [A-Z][a-z]+ \d{4}$/);
  });
});

describe("with no date chosen", () => {
  it("asks for a date and does not also say the data is missing", () => {
    render(
      <PermTimelineEstimator
        frontier={FRONTIER}
        cohorts={[]}
        frontierAdvance={null}
        disclosure={null}
        today="2026-08-26"
      />,
    );
    expect(document.body.textContent).toMatch(/Pick a date above/);
    expect(document.body.textContent).not.toMatch(/isn.t enough published DOL data/);
  });
});
