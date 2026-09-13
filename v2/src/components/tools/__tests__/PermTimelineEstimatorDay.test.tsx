import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PermTimelineEstimator } from "../PermTimelineEstimator";
import { measurePace } from "@/lib/perm";
import type { MonthQueue } from "@/lib/queueAhead";

/**
 * The DAY input, which the owner asked for at the start and which only became
 * meaningful when the decision-pace model landed.
 *
 * BEFORE THAT MODEL, a day could not change anything: every estimate was
 * anchored to a filing MONTH, so a day field would have been a control that
 * did nothing. `casesAheadOfDay` prorates the filing month, so these tests
 * exist to prove the control is wired to the answer rather than decorative -
 * which is the whole failure mode a form field like this invites.
 */

const month = (filingMonth: string, total: number, decided: number): MonthQueue => ({
  filingMonth,
  total,
  pending: total - decided,
  decided,
  decidedPct: total > 0 ? (decided / total) * 100 : null,
});

// A big filing month is what makes the day matter: ~15,000 pending at DOL's
// ~625 a day is about three weeks between the 1st and the 31st.
const MONTHS: MonthQueue[] = [
  month("2025-11", 15_000, 7_500),
  month("2025-12", 15_000, 500),
  month("2026-01", 12_000, 200),
];

const PACE = measurePace(
  Array.from({ length: 28 }, (_, i) => {
    const dayOfWeek = (i + 1) % 7;
    const weekend = dayOfWeek === 0 || dayOfWeek === 6;
    return { dayOfWeek, n: weekend ? 210 : 790 };
  }),
)!;

function renderTool() {
  return render(
    <PermTimelineEstimator
      today="2026-09-13"
      frontier={{ analystQueueMonth: "2025-11", officialAvgDays: 336, asOf: "2026-08-31" }}
      cohorts={[]}
      frontierAdvance={{ rate: 1.0, slowest: 0.8, fastest: 2.0 }}
      disclosure={null}
      months={MONTHS}
      decisionPace={PACE}
      sweepAgeDays={0}
      initialMonth="2025-12"
    />,
  );
}

/** The estimate's headline date, as the page prints it. */
function anchorText(): string {
  const el = screen.getByText(/^Around /);
  return el.textContent ?? "";
}

describe("the day input", () => {
  it("offers a day, and defaults to not requiring one", () => {
    renderTool();
    const day = screen.getByLabelText(/^Day/i) as HTMLSelectElement;
    expect(day.value).toBe("");
    // Blank must read as a real answer, not a missing one.
    expect(screen.getByText(/middle of the month/i)).toBeTruthy();
  });

  it("CHANGES THE ANSWER - the control is wired, not decorative", () => {
    renderTool();
    const before = anchorText();
    fireEvent.change(screen.getByLabelText(/^Day/i), { target: { value: "1" } });
    const first = anchorText();
    fireEvent.change(screen.getByLabelText(/^Day/i), { target: { value: "28" } });
    const last = anchorText();
    expect(first).not.toBe(last);
    // The 1st must not be LATER than the 28th: fewer cases were filed ahead.
    expect(Date.parse(first.replace("Around ", ""))).toBeLessThan(
      Date.parse(last.replace("Around ", "")),
    );
    expect(before).not.toBe("");
  });

  it("offers only days the chosen month actually has", () => {
    renderTool();
    fireEvent.change(screen.getByLabelText(/month DOL received/i), {
      target: { value: "2026-02" },
    });
    const day = screen.getByLabelText(/^Day/i) as HTMLSelectElement;
    const values = Array.from(day.options).map((o) => o.value).filter(Boolean);
    // February 2026 is not a leap year.
    expect(values).toHaveLength(28);
    expect(values).not.toContain("30");
  });

  it("clears a day the new month cannot have, rather than silently clamping", () => {
    renderTool();
    fireEvent.change(screen.getByLabelText(/^Day/i), { target: { value: "31" } });
    fireEvent.change(screen.getByLabelText(/month DOL received/i), {
      target: { value: "2026-02" },
    });
    // "the 28th" is not what they said, so it goes back to Any.
    expect((screen.getByLabelText(/^Day/i) as HTMLSelectElement).value).toBe("");
  });

  it("names the date it is counting to once a day is chosen", () => {
    renderTool();
    fireEvent.change(screen.getByLabelText(/^Day/i), { target: { value: "3" } });
    expect(screen.getByText(/Counting the cases filed before/i)).toBeTruthy();
  });
});

describe("the answer is shown at the resolution it earned", () => {
  it("prints a DAY, not a month, when the counting model leads", () => {
    // The display used to print a month unless the employer initial was given,
    // on the reasoning that the initial is the only thing placing a case
    // inside its filing month. Decision-pace counts the cases filed before
    // yours, which places you directly - so a reader could pick a filing day,
    // watch the arithmetic move, and still be shown "Around November 2026".
    renderTool();
    const headline = screen.getByText(/^Around /).textContent ?? "";
    expect(headline).toMatch(/Around (\w{3}, )?\w{3} \d{1,2}, \d{4}/);
  });

  it("prints the window in days too", () => {
    renderTool();
    const win = screen.getByText(/Likely decision window/).textContent ?? "";
    expect(win).toMatch(/\w{3} \d{1,2}, \d{4}[\s\S]*to[\s\S]*\w{3} \d{1,2}, \d{4}/);
  });

  it("shows the LEAD model's own band, not a span across every model", () => {
    // The owner asked for the scenario band and not the whole range, and the
    // case page has always shown the lead model's band. Two surfaces
    // describing one estimate must not disagree about what the estimate is.
    renderTool();
    expect(screen.getByText(/pace scenario, not a confidence interval/i)).toBeTruthy();
    expect(screen.queryByText(/models on different bases/i)).toBeNull();
  });

  it("falls back to months when no counting model can run", () => {
    // No pace and no queue: the month-anchored models answer, and a day would
    // be precision they do not have.
    render(
      <PermTimelineEstimator
        today="2026-09-13"
        frontier={{ analystQueueMonth: "2025-11", officialAvgDays: 336, asOf: "2026-08-31" }}
        cohorts={[]}
        frontierAdvance={{ rate: 1.0, slowest: 0.8, fastest: 2.0 }}
        disclosure={null}
        months={MONTHS}
        decisionPace={null}
        sweepAgeDays={0}
        initialMonth="2025-12"
      />,
    );
    const headline = screen.getAllByText(/^Around /)[0]?.textContent ?? "";
    expect(headline).not.toMatch(/Around (\w{3}, )?\w{3} \d{1,2}, \d{4}/);
  });
});
