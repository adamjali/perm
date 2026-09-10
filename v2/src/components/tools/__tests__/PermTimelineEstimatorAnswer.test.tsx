import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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
 * And the day: DOL publishes at MONTH resolution and works through a month
 * alphabetically by employer, so the initial is the only input that says where
 * inside the month a case falls. It is worth about 27 days end to end,
 * measured over 339,518 decided cases. With no initial the anchor stays a
 * month, because a day we cannot place inside the month is precision we do not
 * have.
 */
const FRONTIER = {
  analystQueueMonth: "2025-09",
  officialAvgDays: 372,
  asOf: "2026-08-20",
};

/** Two ends of the real measured spread; the middle is not needed to pin behaviour. */
const ALPHABET = {
  cases: 339518,
  letters: [
    { letter: "A", deltaDays: -11.4 },
    { letter: "Z", deltaDays: 15.7 },
  ],
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

describe("the employer initial", () => {
  it("is absent entirely when the measurement is not available", () => {
    renderEstimator();
    expect(screen.queryByLabelText(/First letter of the employer/)).toBeNull();
  });

  it("is optional, and defaults to telling us nothing", () => {
    renderEstimator({ alphabet: ALPHABET });
    const select = screen.getByLabelText(/First letter of the employer/);
    // Blank, not "A". A defaulted initial would silently shift every estimate.
    expect((select as HTMLSelectElement).value).toBe("");
    expect(screen.getByText(/Not sure \/ skip/)).toBeInTheDocument();
  });

  it("keeps the anchor at a month while no initial is given", () => {
    renderEstimator({ alphabet: ALPHABET });
    expect(screen.getByText(/^Around September 2026$/)).toBeInTheDocument();
  });

  it("sharpens the anchor to a day once an initial is chosen", () => {
    renderEstimator({ alphabet: ALPHABET });
    fireEvent.change(screen.getByLabelText(/First letter of the employer/), {
      target: { value: "A" },
    });
    // A day, with a weekday, not a month.
    // en-US: "Around Mon, Sep 14, 2026" - weekday, month, day, year.
    expect(screen.getByText(/^Around \w{3}, \w{3} \d{1,2}, \d{4}$/)).toBeInTheDocument();
    expect(screen.queryByText(/^Around September 2026$/)).toBeNull();
  });

  it("moves the date the way the measurement says, not arbitrarily", () => {
    // A is measured 11.4 days BELOW the corpus mean and Z 15.7 above, so an
    // A employer must land earlier than a Z one. If this ever inverts, the
    // sign of the term has been flipped somewhere.
    const { unmount } = renderEstimator({ alphabet: ALPHABET });
    fireEvent.change(screen.getByLabelText(/First letter of the employer/), {
      target: { value: "A" },
    });
    const early = screen.getByText(/^Around \w{3}, /).textContent ?? "";
    unmount();

    renderEstimator({ alphabet: ALPHABET });
    fireEvent.change(screen.getByLabelText(/First letter of the employer/), {
      target: { value: "Z" },
    });
    const late = screen.getByText(/^Around \w{3}, /).textContent ?? "";

    expect(early).not.toEqual(late);
    expect(Date.parse(early.replace("Around ", ""))).toBeLessThan(
      Date.parse(late.replace("Around ", "")),
    );
  });

  it("states the size of the term and what it was measured over", () => {
    renderEstimator({ alphabet: ALPHABET });
    // The number is the guard against it reading as a lever: 27 days, not 160.
    expect(screen.getByText(/worth about/)).toBeInTheDocument();
    expect(screen.getByText(/339,518 decided cases/)).toBeInTheDocument();
  });
});
