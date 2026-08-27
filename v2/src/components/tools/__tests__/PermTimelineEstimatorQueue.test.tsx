import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { PermTimelineEstimator } from "../PermTimelineEstimator";
import type { MonthQueue } from "@/lib/queueAhead";

/**
 * The queue band, isolated. Every model input is null on purpose so the
 * estimate/envelope half of the component renders nothing and these assertions
 * can only be about the pending-count half.
 */

function month(
  filingMonth: string,
  total: number,
  decided: number,
  stages: Partial<MonthQueue> = {},
): MonthQueue {
  return {
    filingMonth,
    total,
    pending: total - decided,
    decided,
    decidedPct: total > 0 ? (decided / total) * 100 : null,
    ...stages,
  };
}

const MONTHS: MonthQueue[] = [
  month("2025-06", 10_000, 10_000),
  month("2025-07", 10_000, 8_000),
  month("2025-08", 10_000, 4_000, {
    analystReview: 4_000,
    rfiIssued: 1_000,
    auditResponse: 500,
  }),
  month("2025-09", 10_000, 0),
];

function renderQueue(extra: Record<string, unknown> = {}) {
  return render(
    <PermTimelineEstimator
      frontier={null}
      cohorts={[]}
      frontierAdvance={null}
      disclosure={null}
      today="2026-08-26"
      months={MONTHS}
      activeRange={{ from: "2025-07", to: "2025-08" }}
      queueSource="example.test (mirror)"
      {...extra}
    />,
  );
}

describe("PermTimelineEstimator queue band", () => {
  it("counts only pending cases from earlier months", () => {
    renderQueue();
    fireEvent.change(screen.getByLabelText(/Month DOL received/i), {
      target: { value: "2025-08" },
    });
    // June contributes 0 pending, July 2,000. August's own 6,000 is separate.
    // Scoped to the card: 2,000 legitimately appears twice on the page,
    // once as this total and once as July's own row in the chart below.
    const card = screen.getByText("Cases ahead of you").closest("div");
    expect(card).toHaveTextContent("2,000");
    expect(card).toHaveTextContent("still undecided, filed before August 2025");
  });

  it("states the active range in words", () => {
    renderQueue();
    expect(screen.getByText(/July 2025 to August 2025/)).toBeInTheDocument();
  });

  it("splits the chosen month's pending across DOL's separate queues", () => {
    renderQueue();
    fireEvent.change(screen.getByLabelText(/Month DOL received/i), {
      target: { value: "2025-08" },
    });
    expect(screen.getByText(/6,000 still undecided in August 2025/)).toBeInTheDocument();
    expect(screen.getByText(/4,000 in analyst review/)).toBeInTheDocument();
    expect(screen.getByText(/1,000 answering a request for information/)).toBeInTheDocument();
  });

  it("states the remainder rather than leaving the buckets not adding up", () => {
    renderQueue();
    fireEvent.change(screen.getByLabelText(/Month DOL received/i), {
      target: { value: "2025-08" },
    });
    // 4,000 + 1,000 + 500 = 5,500 of 6,000 pending, so 500 sit elsewhere.
    expect(screen.getByText(/500 in none of those three/)).toBeInTheDocument();
  });

  it("names the mirror where the pending counts are, not in a footnote", () => {
    renderQueue();
    expect(screen.getByText(/example\.test \(mirror\)/)).toBeInTheDocument();
    expect(screen.getByText(/no pending rows at all/)).toBeInTheDocument();
  });

  it("renders no queue band at all when the series is absent", () => {
    render(
      <PermTimelineEstimator
        frontier={null}
        cohorts={[]}
        frontierAdvance={null}
        disclosure={null}
        today="2026-08-26"
      />,
    );
    expect(screen.queryByText(/Cases ahead of you/)).not.toBeInTheDocument();
    expect(screen.queryByText(/How far DOL has got/)).not.toBeInTheDocument();
  });

  it("moves the answer when a case number is pasted", () => {
    renderQueue();
    fireEvent.change(screen.getByLabelText(/case number/i), {
      target: { value: "G-100-25213-100000" }, // day 213 of 2025 = 2025-08-01
    });
    expect(screen.getByText(/still undecided, filed before August 2025/)).toBeInTheDocument();
  });
});
