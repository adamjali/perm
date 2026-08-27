/**
 * The live-queue module's job is to say something the rest of the page
 * cannot, without ever implying the two sources can be added together.
 *
 * Each case here is a way that goes wrong on a real page: a zero printed over
 * an entity the tracker has never seen, a stage code shown without its
 * meaning, a count shown without its denominator.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EntityPending } from "@/lib/turso/entityDetail";

import { LiveQueueBand } from "../LiveQueueBand";

function pending(over: Partial<EntityPending> = {}): EntityPending {
  return {
    tracked: 1769,
    pending: 1768,
    stages: [{ status: "APPLICATION ON HOLD", n: 1768 }],
    oldest: "2025-12-17",
    ...over,
  };
}

describe("LiveQueueBand", () => {
  it("states the pending count against the tracker's own denominator", () => {
    const { container } = render(
      <LiveQueueBand pending={pending()} subject="sponsor" asOf="2026-08-26" />,
    );
    // Scoped to the display figure. The number is echoed in the stage row and
    // twice in the caption, so an unscoped text query matches four nodes.
    expect(container.querySelector(".text-5xl")?.textContent).toBe("1,768");
    expect(
      screen.getByText("Waiting on a decision", { selector: "p" }),
    ).toBeInTheDocument();
    // The denominator is never dropped: 1,768 alone is a size, "1,768 of
    // 1,769" is the fact that everything they filed is still in the queue.
    expect(screen.getByText(/of 1,769 tracked cases/)).toBeInTheDocument();
  });

  it("names the stage and explains it, rather than printing a status code", () => {
    render(
      <LiveQueueBand
        pending={pending({ stages: [{ status: "ANALYST REVIEW", n: 1768 }] })}
        subject="sponsor"
        asOf="2026-08-26"
      />,
    );
    expect(screen.getByText("ANALYST REVIEW")).toBeInTheDocument();
    expect(screen.getByText(/analyst has the application/i)).toBeInTheDocument();
  });

  it("renders nothing at all when the tracker holds no cases for the entity", () => {
    const { container } = render(
      <LiveQueueBand
        pending={pending({ tracked: 0, pending: 0, stages: [], oldest: null })}
        subject="sponsor"
        asOf="2026-08-26"
      />,
    );
    // Absence of data is not a zero. "0 waiting" over an entity the tracker
    // has never seen is a claim the data cannot support.
    expect(container).toBeEmptyDOMElement();
  });

  it("says nothing is waiting, rather than disappearing, when the queue is clear", () => {
    render(
      <LiveQueueBand
        pending={pending({ tracked: 42, pending: 0, stages: [], oldest: null })}
        subject="firm"
        asOf="2026-08-26"
      />,
    );
    expect(screen.getByText(/Nothing for this firm is waiting/)).toBeInTheDocument();
  });

  it("dates the oldest case still waiting and ages it", () => {
    render(<LiveQueueBand pending={pending()} subject="sponsor" asOf="2026-08-26" />);
    expect(screen.getByText(/December 17, 2025/)).toBeInTheDocument();
    expect(screen.getByText(/months ago/)).toBeInTheDocument();
  });

  it("carries the tracker's own as-of date, not the disclosure files'", () => {
    render(<LiveQueueBand pending={pending()} subject="sponsor" asOf="2026-08-26" />);
    expect(screen.getByText(/Live case tracker, as of August 26, 2026/)).toBeInTheDocument();
  });

  it("gives each stage its true share even when one stage swamps the rest", () => {
    render(
      <LiveQueueBand
        pending={pending({
          tracked: 200,
          pending: 100,
          stages: [
            { status: "ANALYST REVIEW", n: 96 },
            { status: "RFI ISSUED", n: 3 },
            { status: "BALCA APPEALS", n: 1 },
          ],
        })}
        subject="sponsor"
        asOf="2026-08-26"
      />,
    );
    // The rules are scaled against the BIGGEST stage so a 1% stage is still
    // visible, but the percentage beside each count is the true share and is
    // what the reader is given to read.
    expect(screen.getByText("96%")).toBeInTheDocument();
    expect(screen.getByText("3%")).toBeInTheDocument();
    expect(screen.getByText("1%")).toBeInTheDocument();
  });

  it("never invites the reader to subtract the two corpora", () => {
    render(<LiveQueueBand pending={pending()} subject="sponsor" asOf="2026-08-26" />);
    // The caption has to say which denominator applies, because a sponsor's
    // pending count routinely exceeds its lifetime decided filings: the
    // tracker sees cases filed after the last disclosure file was cut.
    expect(
      screen.getByText(/never against the lifetime\s+filings above/),
    ).toBeInTheDocument();
  });
});
