import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PermTimelineEstimator } from "../PermTimelineEstimator";

/**
 * A filing month DOL's queue has already passed (Oct 7 2026).
 *
 * DOL's published average still names a future day for the month just
 * passed, and backtested it ran typically 29 days late there. So the
 * calculator gives that month no filing-month date: it says how many of the
 * month's waiting cases are still in normal review, and how fast DOL is
 * finishing those, the rate the case page dates them by.
 */

const FRONTIER = { analystQueueMonth: "2025-09", officialAvgDays: 372, asOf: "2026-08-20" };
const STRAGGLERS = {
  asOf: "2026-08-18", frontierMonth: "2025-09", windowDays: 14, pending: 863, pool: 2960,
  decided: 1944, dailyRate: 0.081, medianDays: 9, p80Days: 20,
};
const MONTHS = [
  { filingMonth: "2025-08", total: 9000, pending: 1041, decided: 7959, decidedPct: 88, analystReview: 527 },
  { filingMonth: "2025-09", total: 9200, pending: 7541, decided: 1659, decidedPct: 18, analystReview: 7092 },
];

function renderPassed(extra: Record<string, unknown> = {}) {
  // Filed Aug 15 2025 against a Sep 2025 frontier: filed + 372 days is Aug 22
  // 2026, still ahead of today (Aug 18), so the average alone would answer.
  return render(
    <PermTimelineEstimator
      initialMonth="2025-08"
      frontier={FRONTIER}
      cohorts={[]}
      frontierAdvance={null}
      disclosure={null}
      today="2026-08-18"
      months={MONTHS}
      {...extra}
    />,
  );
}

describe("a filing month DOL's queue has passed", () => {
  it("gives no filing-month date, and states the split and the measured rate", () => {
    renderPassed({ stragglers: STRAGGLERS });
    expect(screen.queryByText(/^Around /)).toBeNull();
    expect(screen.queryByText(/Likely decision window/)).toBeNull();
    expect(screen.queryByText(/How this was worked out/)).toBeNull();
    const line = screen.getByText(/cases filed this month still waiting/);
    expect(line.textContent).toContain("Of the 1,041 cases filed this month still waiting, 527 are still in normal review");
    expect(line.textContent).toContain("about 8% a day: half within 9 days, eight in ten within 20");
    expect(screen.getByRole("link", { name: /Check your case number/ })).toBeTruthy();
  });

  it("still states the split without a rate", () => {
    renderPassed();
    expect(screen.queryByText(/^Around /)).toBeNull();
    const line = screen.getByText(/cases filed this month still waiting/);
    expect(line.textContent).not.toContain("a day");
  });
});
