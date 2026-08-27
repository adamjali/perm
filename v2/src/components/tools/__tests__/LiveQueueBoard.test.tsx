import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { LiveQueueBoard } from "../LiveQueueBoard";
import { MIRROR_COMPLETE, PROVISIONAL_NOTICE } from "@/lib/liveQueueGate";
import type { CohortMonth } from "@/lib/liveQueue";

/**
 * The board's two obligations: name the front correctly, and never let a
 * provisional figure read as a settled one.
 */

function m(month: string, total: number, decided: number): CohortMonth {
  return {
    month,
    total,
    pending: total - decided,
    decided,
    decidedPct: total > 0 ? (decided / total) * 100 : null,
  };
}

const MONTHS: CohortMonth[] = [
  m("2025-04", 10_000, 9_980), // stragglers only
  m("2025-06", 10_000, 8_000), // the front
  m("2025-08", 10_000, 0),
];

describe("LiveQueueBoard", () => {
  it("names the front month, not the oldest with anything pending", () => {
    render(<LiveQueueBoard months={MONTHS} />);
    // Named twice on purpose: as the headline, and as its own row below.
    expect(screen.getAllByText("June 2025")).toHaveLength(2);
    // April has 20 open cases and must not be presented as the work front.
    const headline = screen.getByText(/The queue is working/).parentElement;
    expect(headline).toHaveTextContent("June 2025");
    expect(headline).not.toHaveTextContent("April 2025");
  });

  it("leads with the whole wall and states the smaller figure separately", () => {
    render(<LiveQueueBoard months={MONTHS} />);
    // 20 + 2,000 + 10,000 undecided across every month.
    expect(screen.getByText("12,020")).toBeInTheDocument();
    expect(screen.getByText(/the whole wall/)).toBeInTheDocument();
    // 20 + 2,000 at or before the front: a different claim, labelled as one.
    expect(screen.getByText("2,020")).toBeInTheDocument();
    expect(screen.getByText(/undecided at or before June 2025/)).toBeInTheDocument();
  });

  it("says how far back the front sits", () => {
    render(<LiveQueueBoard months={MONTHS} />);
    expect(screen.getByText(/2 months behind August 2025/)).toBeInTheDocument();
  });

  it("gives every month a row that links to its cohort", () => {
    render(<LiveQueueBoard months={MONTHS} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(MONTHS.length);
    expect(screen.getByRole("link", { name: "June 2025" })).toHaveAttribute(
      "href",
      "/perm-queue/2025-06",
    );
  });

  it("states each row's progress and pending count for a screen reader", () => {
    render(<LiveQueueBoard months={MONTHS} />);
    expect(
      screen.getByLabelText("June 2025: 80% decided, 2,000 still pending"),
    ).toBeInTheDocument();
  });

  it("carries the provisional notice while the mirror is loading", () => {
    render(<LiveQueueBoard months={MONTHS} />);
    if (MIRROR_COMPLETE) {
      expect(screen.queryByText(PROVISIONAL_NOTICE)).not.toBeInTheDocument();
    } else {
      // Above the figures, so a number cannot be absorbed before its caveat.
      const notice = screen.getByText(PROVISIONAL_NOTICE);
      const wall = screen.getByText("12,020");
      expect(notice.compareDocumentPosition(wall) & 4).toBeTruthy();
    }
  });

  it("says there is no front rather than inventing one", () => {
    render(<LiveQueueBoard months={[m("2025-04", 10_000, 10_000)]} />);
    expect(screen.getByText(/no work front to report/)).toBeInTheDocument();
    expect(screen.queryByText(/The queue is working/)).not.toBeInTheDocument();
  });

  it("renders nothing rather than an empty frame with no months", () => {
    render(<LiveQueueBoard months={[]} />);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.getByText(/no work front to report/)).toBeInTheDocument();
  });
});
