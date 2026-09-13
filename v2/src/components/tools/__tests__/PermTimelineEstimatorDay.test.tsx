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

describe("the filing-date field", () => {
  it("is ONE date field, not a month list plus a day list", () => {
    // The owner asked for an unbounded forward range and a <select> cannot
    // hold one - you cannot enumerate every future month. A date field can,
    // and it collapses two controls into the thing a person actually knows.
    renderTool();
    const el = screen.getByLabelText(/DOL received your case/i) as HTMLInputElement;
    expect(el.tagName).toBe("INPUT");
    expect(screen.queryByLabelText(/^Day/i)).toBeNull();
  });


  it("CHANGES THE ANSWER - the control is wired, not decorative", () => {
    renderTool();
    const before = anchorText();
    fireEvent.change(screen.getByLabelText(/DOL received your case/i), { target: { value: "2025-12-01" } });
    const first = anchorText();
    fireEvent.change(screen.getByLabelText(/DOL received your case/i), { target: { value: "2025-12-28" } });
    const last = anchorText();
    expect(first).not.toBe(last);
    // The 1st must not be LATER than the 28th: fewer cases were filed ahead.
    expect(Date.parse(first.replace("Around ", ""))).toBeLessThan(
      Date.parse(last.replace("Around ", "")),
    );
    expect(before).not.toBe("");
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

describe("a filing date in the FUTURE", () => {
  const future = "2027-03-15";

  function renderFuture() {
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

  it("accepts a date past today at all", () => {
    // The month list stopped at the current month, so this was impossible.
    renderFuture();
    const el = screen.getByLabelText(/DOL received your case/i) as HTMLInputElement;
    fireEvent.change(el, { target: { value: future } });
    expect(screen.getByLabelText(/expect to file/i)).toBeTruthy();
  });

  it("switches the label to the future tense", () => {
    renderFuture();
    expect(screen.getByLabelText(/DOL received your case/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/DOL received your case/i), {
      target: { value: future },
    });
    // "Date DOL received your case" is wrong for someone who has not filed.
    expect(screen.queryByLabelText(/DOL received your case/i)).toBeNull();
    expect(screen.getByLabelText(/Date you expect to file/i)).toBeTruthy();
  });

  it("says which half is counted and which is assumed", () => {
    renderFuture();
    fireEvent.change(screen.getByLabelText(/DOL received your case/i), {
      target: { value: future },
    });
    // Today's backlog is counted; the arrivals before you are projected, and
    // the rate's own window is named rather than hidden.
    expect(screen.getByText(/waiting now/i)).toBeTruthy();
    expect(screen.getByText(/filed before you get there/i)).toBeTruthy();
    // The rate's own window moved to "How this was worked out" with the
    // other explanations - it explains a number, so it belongs beside
    // the number rather than under the control that feeds it.
    expect(screen.getByText(/a day filed before you/i)).toBeTruthy();
  });

  it("gives a LATER answer the further out you file", () => {
    // Counting only today's backlog gives every future date the same answer,
    // which is what both rivals ship and is transparently wrong.
    renderFuture();
    const field = screen.getByLabelText(/DOL received your case/i);
    fireEvent.change(field, { target: { value: "2026-11-15" } });
    const near = screen.getByText(/^Around /).textContent ?? "";
    fireEvent.change(screen.getByLabelText(/expect to file/i), {
      target: { value: "2027-09-15" },
    });
    const far = screen.getByText(/^Around /).textContent ?? "";
    expect(near).not.toBe(far);
    expect(Date.parse(near.replace(/^Around (\w{3}, )?/, ""))).toBeLessThan(
      Date.parse(far.replace(/^Around (\w{3}, )?/, "")),
    );
  });

  it("makes the INTRO copy follow the tense too, not just the label", () => {
    // It said "Pick the month DOL received your ETA-9089" - wrong twice over
    // once the control became a date field that reaches forward: it asks for
    // a month when a day is what changes the answer, and it is past tense for
    // someone who has not filed yet.
    renderFuture();
    // The intro paragraph is gone - it restated the heading. The tense now
    // lives in the label, which is where it belongs.
    expect(screen.getByLabelText(/DOL received your case/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/DOL received your case/i), {
      target: { value: future },
    });
    expect(screen.queryByLabelText(/DOL received your case/i)).toBeNull();
    expect(screen.getByLabelText(/expect to file/i)).toBeTruthy();
    // and it must never say "month" again
    expect(screen.queryByText(/Pick the month/i)).toBeNull();
  });
});

describe("the page is empty until a date is chosen", () => {
  /**
   * It used to open on DOL's current frontier month and show a complete
   * answer - a date, a window, a queue position - for a month the reader had
   * never picked. That reads as "your estimate" rather than "an example", and
   * a reader took it for their own.
   */
  function renderBare() {
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
      />,
    );
  }

  it("starts with the field empty", () => {
    renderBare();
    expect((screen.getByLabelText(/DOL received your case/i) as HTMLInputElement).value).toBe("");
  });

  it("shows no date, no window and no queue until one is given", () => {
    renderBare();
    expect(screen.queryByText(/^Around /)).toBeNull();
    expect(screen.queryByText(/Likely decision window/)).toBeNull();
  });

  it("says what picking a date will do, rather than showing an empty frame", () => {
    renderBare();
    expect(screen.getByText(/Pick a date above/i)).toBeTruthy();
  });

  it("fills in once a date is chosen, and empties again when cleared", () => {
    renderBare();
    const field = screen.getByLabelText(/DOL received your case/i);
    fireEvent.change(field, { target: { value: "2025-12-15" } });
    expect(screen.getByText(/^Around /)).toBeTruthy();
    // Clearable, and everything downstream goes with it.
    fireEvent.change(field, { target: { value: "" } });
    expect(screen.queryByText(/^Around /)).toBeNull();
    expect(screen.getByText(/Pick a date above/i)).toBeTruthy();
  });

  it("still honours a date asked for by the caller", () => {
    // `?month=` and the homepage hand-off are a choice made elsewhere; the
    // bare page is not.
    render(
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
    expect(screen.getAllByText(/^Around /)[0]).toBeTruthy();
  });
});
