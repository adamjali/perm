import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CaseEstimate } from "../CaseEstimate";

/**
 * The refusal panel must not describe one case's wait as a population average.
 *
 * `buildCaseEstimate` returns `kind: "no-date"` from two places, and they mean
 * different things:
 *
 *   - a MEASURED stage (BALCA appeals, a hold, an RFI) carries the population
 *     mean for that stage, 170 to 714 days, from `queueForecast`;
 *   - the OVERDUE branch has no measured stage, so it carries `today - this
 *     case's filing date`.
 *
 * The panel rendered one sentence for both - "Cases at this stage have been
 * pending a measured average of N days" - so every overdue case saw its own
 * waiting time presented as an average of other people's. It read as true
 * because both numbers land in the same range, on a panel whose heading is
 * "No date can honestly be put on this case".
 *
 * These assertions are on the RENDERED SENTENCE, not the field, because the
 * field was never wrong - the claim made about it was.
 */
const ESTIMATOR = {
  frontier: { analystQueueMonth: "2025-11", officialAvgDays: 336, asOf: "2026-08-31" },
  cohorts: [],
} as never;

const TODAY = "2026-09-10";

describe("CaseEstimate refusal panel", () => {
  it("calls a measured stage figure an average, because it is one", () => {
    render(
      <CaseEstimate
        caseNumber="A-11111-11111"
        filingDate="2024-01-15"
        status="BALCA APPEALS"
        isFinal={false}
        estimator={ESTIMATOR}
        today={TODAY}
      />,
    );
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/Cases at this stage have been pending a measured average of/);
    expect(body).not.toMatch(/This case has been pending/);
  });

  it("does NOT call an overdue case's own wait an average", () => {
    render(
      <CaseEstimate
        caseNumber="A-22222-22222"
        filingDate="2025-01-15"
        status={null}
        isFinal={false}
        estimator={ESTIMATOR}
        today={TODAY}
      />,
    );
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/No date can honestly be put on this case/);
    // The regression, stated as the assertion: this number is one case's wait.
    expect(body).not.toMatch(/measured average/);
    expect(body).toMatch(/This case has been pending/);
  });
});

describe("what happens next", () => {
  it("tells an RFI case it rejoins the queue, which is the useful part", () => {
    render(
      <CaseEstimate
        caseNumber="A-33333-33333"
        filingDate="2025-01-15"
        status={null}
        isFinal={false}
        estimator={ESTIMATOR}
        today={TODAY}
        stageExit={{ to: "ANALYST REVIEW", share: 327 / 359, observed: 359 }}
      />,
    );
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/91% of the 359 cases/);
    expect(body).toMatch(/back into the ordinary queue/);
    // And it must not imply we know the timing, which we do not: 422 RFI
    // entries watched, 3 exits seen.
    expect(body).toMatch(/not something we can measure yet/);
  });

  it("says nothing at all when the exits are not measurable", () => {
    render(
      <CaseEstimate
        caseNumber="A-44444-44444"
        filingDate="2025-01-15"
        status={null}
        isFinal={false}
        estimator={ESTIMATOR}
        today={TODAY}
      />,
    );
    expect(document.body.textContent ?? "").not.toMatch(/What usually happens next/);
  });
});

