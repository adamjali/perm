import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PriorityDatePanel } from "../GreenCardStagePanels";
import { buildGreenCardTimeline } from "@/lib/perm";
import type { BulletinMonth } from "@/lib/perm";

/**
 * A page must not refute itself in adjacent elements.
 *
 * The green-card timeline said the cutoff dates were "not something this can
 * read" and rendered a table of cutoffs directly beneath the sentence. It was
 * true before the bulletin ingest existed and has been false since. What is
 * genuinely not knowable is the DURATION: a cutoff is a position in a queue,
 * not a length of time, and it moves backwards as well as forwards.
 *
 * The panel also headed archive data "Where the line is this month" and
 * printed the month raw as `2026-07`. The archive lags the live bulletin, so
 * "this month" was a claim it could not support.
 */

const BULLETIN = {
  bulletinMonth: "2026-07",
  finalAction: {
    EB2: { india: "01SEP13", worldwide: "C" },
    EB3: { india: "01JAN14", worldwide: "01SEP24" },
  },
  datesForFiling: {},
} as unknown as BulletinMonth;

describe("PriorityDatePanel", () => {
  it("names the bulletin it read rather than claiming this month", () => {
    render(<PriorityDatePanel bulletin={BULLETIN} />);
    expect(screen.getByText(/Where the line stood in July 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/this month/i)).not.toBeInTheDocument();
  });

  it("formats the month instead of printing the raw key", () => {
    const { container } = render(<PriorityDatePanel bulletin={BULLETIN} />);
    expect(container.textContent).not.toContain("2026-07");
    expect(container.textContent).toContain("July 2026");
  });

  it("says the bulletin it holds may not be the one in force, and links the source", () => {
    render(<PriorityDatePanel bulletin={BULLETIN} />);
    expect(
      screen.getByText(/newest one held here and not necessarily the one in force/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /check the current bulletin/i })).toHaveAttribute(
      "href",
      "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
    );
  });

  it("renders nothing at all without a bulletin", () => {
    const { container } = render(<PriorityDatePanel bulletin={null} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("the visa-number stage copy", () => {
  it("stops claiming the bulletin cannot be read", () => {
    const stage = buildGreenCardTimeline({
      pwdQueueMonths: null,
      permDecisionMonths: 14,
      i140Months: 8,
    }).stages.find((s) => s.id === "priority-date")!;

    expect(stage.detail).not.toMatch(/not something this can read/i);
    // The stage still carries no number, and now for the reason that is true:
    // a cutoff is a position, and a position is not a duration.
    expect(stage.months).toBeNull();
    expect(stage.certainty).toBe("unknown");
    expect(stage.detail).toMatch(/position in a queue rather than a length of time/i);
    // And it must keep saying the direction can reverse.
    expect(stage.detail).toMatch(/backwards/i);
  });
});
