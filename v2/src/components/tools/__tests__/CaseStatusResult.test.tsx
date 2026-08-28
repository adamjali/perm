import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CaseStatusResult } from "../CaseStatusResult";
import { CaseNotFound } from "../CaseNotFound";
import { buildWall, neighbourMonths } from "@/lib/casePosition";
import type { CohortMonth, StatusCount } from "@/lib/liveQueue";
import { parseCaseNumber } from "@/lib/permCaseNumber";
import type { CaseLookupResult } from "@/lib/turso/caseLookup";

/**
 * A page that answers a real case number is the one place on this site where
 * a plausible wrong figure does the most damage, because it looks tailored.
 * These tests are almost all about restraint: what must NOT appear, and what
 * must be attributed to somebody other than the reader.
 */

const TODAY = "2026-08-27";

/**
 * The alert form derives its endpoint from NEXT_PUBLIC_CONVEX_URL and renders
 * NOTHING when that is absent, which is correct (a form that cannot submit
 * should not appear) and made these tests silently env-dependent: they passed
 * locally with .env.local loaded and would have gone red on CI. Pinned here
 * so the assertions are about the component, not the machine.
 */
const REAL_CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
beforeAll(() => {
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://test-deployment.convex.cloud";
});
afterAll(() => {
  if (REAL_CONVEX_URL === undefined) delete process.env.NEXT_PUBLIC_CONVEX_URL;
  else process.env.NEXT_PUBLIC_CONVEX_URL = REAL_CONVEX_URL;
});

/** A miniature of the real backlog shape, with the front at 2025-09. */
function m(month: string, total: number, decided: number): CohortMonth {
  return {
    month,
    total,
    pending: total - decided,
    decided,
    decidedPct: total > 0 ? (decided / total) * 100 : null,
  };
}

const BACKLOG: CohortMonth[] = [
  m("2025-08", 9_677, 8_954),
  m("2025-09", 13_629, 11_539), // the front, 85% decided
  m("2025-10", 1_616, 355),
  m("2025-11", 15_034, 567),
  m("2025-12", 14_888, 432),
  m("2026-01", 11_094, 310),
  m("2026-04", 6_929, 179),
  m("2026-05", 8_172, 273),
];

const COHORT_STATUSES: StatusCount[] = [
  { status: "ANALYST REVIEW", count: 7_898, isFinal: false },
  { status: "WITHDRAWN", count: 273, isFinal: true },
  { status: "IN PROCESS", count: 1, isFinal: false },
];

/** The real pending case that shaped this page. */
const PENDING: CaseLookupResult = {
  caseNumber: "P-100-26125-868956",
  live: {
    status: "ANALYST REVIEW",
    isFinal: false,
    filingDate: "2026-05-05",
    employerName: "Psomagen, Inc.",
    jobTitle: "Senior Biomedical Laboratory Technologist",
    lastCheckedAt: "2026-08-25T22:31:24",
  },
  decided: null,
  cohort: {
    month: "2026-05",
    total: 8_172,
    decided: 273,
    pending: 7_899,
    decidedPct: 3.34,
    aheadOfMonth: 63_603,
    sameMonthPending: 7_899,
  },
  employer: {
    name: "Psomagen Inc",
    slug: "psomagen-inc",
    total: 7,
    certified: 7,
    denied: 0,
    approvalRate: 100,
    medianDays: 507,
  },
  statusOutlook: { status: "ANALYST REVIEW", nowInStatus: 94_435 },
};

/**
 * Estimator data for the stage-aware estimate block. Shaped like
 * `getEstimatorData`'s output; the settled cohort carries readable
 * percentiles so a dated estimate can render when a test wants one.
 */
const ESTIMATOR = {
  frontier: {
    analystQueueMonth: "2025-09",
    officialAvgDays: 372,
    asOf: "2026-08-20",
  },
  cohorts: [
    {
      cohortMonth: "2024-06",
      decided: 8_200,
      totalReceived: 8_400,
      p25: 410,
      p50: 455,
      p75: 505,
      p90: 540,
    },
  ],
  frontierAdvance: { rate: 1.8, slowest: 1.05, fastest: 2.0 },
} as const;

function renderPending(
  overrides: Partial<CaseLookupResult> = {},
  estimator: typeof ESTIMATOR | null = null,
) {
  const result = { ...PENDING, ...overrides };
  const month = result.cohort?.month ?? "2026-05";
  return render(
    <CaseStatusResult
      result={result}
      backlog={BACKLOG}
      cohortStatuses={COHORT_STATUSES}
      wall={buildWall(BACKLOG, month)}
      neighbours={neighbourMonths(BACKLOG, month, 2)}
      publishedFront="2025-09"
      publishedAsOf="2026-08-20"
      wage={null}
      duration={null}
      estimator={estimator}
      today={TODAY}
    />,
  );
}

describe("CaseStatusResult, pending case", () => {
  it("leads with the status and the position, not a stat grid", () => {
    renderPending();
    expect(screen.getAllByText(/Analyst Review/).length).toBeGreaterThan(0);
    // 723 + 2,090 + 1,261 + 14,467 + 14,456 + 10,784 + 6,750 undecided before
    // 2026-05, summed off the fixture rather than restated.
    const ahead = BACKLOG.filter((x) => x.month < "2026-05").reduce(
      (n, x) => n + x.pending,
      0,
    );
    expect(screen.getAllByText(ahead.toLocaleString("en-US")).length).toBeGreaterThan(0);
  });

  it("says how far behind DOL's work front the filing month sits", () => {
    renderPending();
    expect(screen.getAllByText(/September 2025/).length).toBeGreaterThan(0);
    expect(screen.getByText("8 months")).toBeInTheDocument();
  });

  it("invents no date when the estimator data is absent, and says what a date here is", () => {
    // Deploy skew or a failed fetch: `estimator` arrives null. The estimate
    // block must simply not render - a dated figure with nothing behind it
    // is the exact defect the old full-refusal doctrine existed to prevent.
    const { container } = renderPending();
    const text = container.textContent ?? "";
    for (const banned of [
      /you (should|can) expect/i,
      /by (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}, your/i,
      /\bdays remaining\b/i,
      /\bdecision expected\b/i,
    ]) {
      expect(text).not.toMatch(banned);
    }
    expect(text).not.toMatch(/When this case could be decided/i);
    // The refusals block still speaks, in its post-estimate wording: what the
    // page never gives is a GUARANTEED date, and it says so out loud.
    expect(text).toMatch(/will not tell you/i);
    expect(text).toMatch(/A guaranteed decision date/i);
  });

  it("renders the estimate labeled as an estimate, stage-adjusted, when the data exists", () => {
    const { container } = renderPending({}, ESTIMATOR);
    const text = container.textContent ?? "";
    // The label IS the contract: an unlabeled date on a page that answers a
    // case number would be read as a promise.
    expect(text).toMatch(/Estimate · not a promise/i);
    expect(text).toMatch(/When this case could be decided/i);
    // ANALYST REVIEW reads the middle of its month, and says so.
    expect(text).toMatch(/ordinary path/i);
    // The model and its source are on the page, not in a footnote elsewhere.
    expect(text).toMatch(/timeline calculator/i);
  });

  it("refuses a date for an appeal and shows the measured age instead", () => {
    const { container } = renderPending(
      {
        live: { ...PENDING.live!, status: "BALCA APPEALS" },
        statusOutlook: { status: "BALCA APPEALS", nowInStatus: 167 },
      },
      ESTIMATOR,
    );
    const text = container.textContent ?? "";
    expect(text).toMatch(/No date can honestly be put on this case/i);
    expect(text).not.toMatch(/When this case could be decided/i);
    // The measured mean age for BALCA, from lib/queueForecast's table.
    expect(text).toMatch(/714 days/);
  });

  it("never scores the odds, and says why the status count is not one", () => {
    const { container } = renderPending();
    const text = container.textContent ?? "";
    // A flat character class, not `\d+(\.\d+)?`: the nested quantifier is
    // the ReDoS shape the security lint flags, and this needs neither.
    expect(text).not.toMatch(/[0-9.]+% ?(chance|likely|probability)/i);
    expect(text).not.toMatch(/your (odds|chances)/i);
    // The count is present AND explicitly framed as a scale. The reason
    // updated when the direct DOL feed began observing transitions
    // (2026-08-27): the honest ground is now sample youth, not blindness.
    expect(screen.getAllByText(/94,435 cases/).length).toBeGreaterThan(0);
    expect(text).toMatch(/cannot honestly price the odds/i);
  });

  it("offers alerts while the case can still change", () => {
    const { container } = renderPending();
    expect(container.textContent).toMatch(/Watch this case/);
    expect(container.textContent).toMatch(/stop once it&apos;s decided|stop once it's decided/);
  });

  it("renders no alert form at all when the endpoint is not configured", () => {
    // A form that cannot submit must not appear. This is the control for the
    // two assertions above: without it they would pass on a component that
    // renders the form unconditionally.
    const saved = process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    try {
      const { container } = renderPending();
      expect(container.textContent).not.toMatch(/Watch this case/);
    } finally {
      process.env.NEXT_PUBLIC_CONVEX_URL = saved;
    }
  });

  it("dates the status rather than implying it is current", () => {
    renderPending();
    expect(screen.getAllByText(/August 25, 2026/).length).toBeGreaterThan(0);
    // And never claims WE did the checking.
    expect(document.body.textContent).not.toMatch(/we (checked|verified|read)/i);
  });

  it("warns when the status is old, because a case moves in two months", () => {
    const { container } = renderPending({
      live: { ...PENDING.live!, lastCheckedAt: "2026-07-01T10:00:00" },
    });
    // "DOL showed this status", not "we last read it": the timestamp is the
    // upstream tracker's own check time, written straight through.
    expect(container.textContent).toMatch(/DOL showed this status 57 days ago/);
    expect(screen.getAllByText("flag.dol.gov").length).toBeGreaterThan(0);
  });

  it("does not raise the staleness warning for a fresh read", () => {
    const { container } = renderPending();
    expect(container.textContent).not.toMatch(/DOL showed this status \d+ days ago/);
  });

  it("shows a small employer's counts and withholds the percentage", () => {
    renderPending();
    // Scoped to the employer SECTION. The whole page legitimately carries
    // percentages (the cohort is 3.3% decided), so a container-wide scan
    // would fail on a figure that has nothing to do with this rule.
    const section = screen
      .getByRole("heading", { name: /This employer.s own record/ })
      .closest("section")!;
    const text = section.textContent ?? "";
    // 7 of 7 certified is worth knowing and is not a 100% approval rate.
    expect(text).toMatch(/it is not a rate/);
    expect(text).not.toMatch(/\d+(\.\d)?%/);
    expect(screen.getByRole("link", { name: /Psomagen Inc/ })).toHaveAttribute(
      "href",
      "/perm-employers/psomagen-inc",
    );
  });

  it("publishes a rate once the employer's sample can carry one", () => {
    const { container } = renderPending({
      employer: {
        name: "Big Sponsor LLC",
        slug: "big-sponsor-llc",
        total: 1_000,
        certified: 940,
        denied: 60,
        approvalRate: 94,
        medianDays: 480,
      },
    });
    expect(container.textContent).toMatch(/94\.0%/);
    expect(container.textContent).toMatch(/carries no claim about this one/);
    expect(container.textContent).not.toMatch(/too small a sample/);
  });

  it("decodes the status with its regulation, not a paraphrase", () => {
    const { container } = renderPending({
      live: { ...PENDING.live!, status: "PENDING AUDIT RESPONSE" },
      statusOutlook: { status: "PENDING AUDIT RESPONSE", nowInStatus: 1 },
    });
    const text = container.textContent ?? "";
    expect(text).toMatch(/30 days from the date of the audit letter/);
    expect(text).toMatch(/refusal to exhaust administrative remedies/);
    expect(
      screen.getByRole("link", { name: "20 CFR 656.20(a)(2)" }),
    ).toHaveAttribute(
      "href",
      "https://www.ecfr.gov/current/title-20/chapter-V/part-656/section-656.20",
    );
  });

  it("says plainly that it cannot decode an unknown status", () => {
    const { container } = renderPending({
      live: { ...PENDING.live!, status: "SOME NEW DOL STATE" },
      statusOutlook: null,
    });
    expect(container.textContent).toMatch(/has not been written up here yet/);
  });

  it("explains the gap between the wall it draws and the figure it quotes", () => {
    const { container } = renderPending();
    // 723 sit in a month DOL has otherwise finished, so the drawn segments
    // hold less than `ahead`. A reader adding up the columns must find that
    // difference explained rather than contradicted.
    expect(container.textContent).toMatch(
      /Another 723 were filed earlier still and remain open/,
    );
  });
});

describe("CaseStatusResult, decided case", () => {
  const DECIDED: CaseLookupResult = {
    caseNumber: "G-100-24011-633982",
    live: {
      status: "CERTIFIED",
      isFinal: true,
      filingDate: "2024-01-11",
      employerName: "Acme Corp",
      jobTitle: "Network and Computer Systems Administrator",
      lastCheckedAt: "2026-04-20T09:00:00",
    },
    decided: {
      status: "certified",
      receivedDate: "2024-01-11",
      decisionDate: "2025-05-28",
      days: 503,
      employerName: "Acme Corp",
      jobTitle: "Network and Computer Systems Administrator",
      socTitle: "Network and Computer Systems Administrators",
      state: "TN",
      wage: 93_205,
    },
    cohort: {
      month: "2024-01",
      total: 11_906,
      decided: 11_890,
      pending: 16,
      decidedPct: 99.87,
      aheadOfMonth: 400,
      sameMonthPending: 16,
    },
    employer: null,
    statusOutlook: null,
  };

  function renderDecided(duration: { n: number; medianDays: number | null; p25Days: number | null; p75Days: number | null } | null) {
    return render(
      <CaseStatusResult
        result={DECIDED}
        backlog={BACKLOG}
        cohortStatuses={[]}
        wall={null}
        neighbours={[]}
        publishedFront="2025-09"
        publishedAsOf="2026-08-20"
        wage={null}
        duration={duration}
        today={TODAY}
      estimator={null}
    />,
    );
  }

  it("shows DOL's own record, including the fields the mirror lacks", () => {
    const { container } = renderDecided(null);
    const text = container.textContent ?? "";
    expect(text).toMatch(/May 28, 2025/);
    expect(screen.getAllByText("503").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$93,205").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TN").length).toBeGreaterThan(0);
  });

  it("compares against the cohort when the disclosure files cover it", () => {
    const { container } = renderDecided({
      n: 11_906,
      medianDays: 494,
      p25Days: 484,
      p75Days: 504,
    });
    expect(container.textContent).toMatch(
      /9 days longer than the middle of its month/,
    );
  });

  it("withholds the comparison when the files hold only the early exits", () => {
    // 291 of 8,172, whose median is 5 days. Publishing that as "your month"
    // is the survivorship trap this guard exists for.
    const { container } = renderDecided({
      n: 291,
      medianDays: 5,
      p25Days: 0,
      p75Days: 20,
    });
    expect(container.textContent).not.toMatch(/the middle one took/);
  });

  it("does not offer a queue position for a case that is already decided", () => {
    const { container } = renderDecided(null);
    expect(container.textContent).not.toMatch(/Filed before this case/);
  });

  it("does not offer alerts on a case that is already decided", () => {
    const { container } = renderDecided(null);
    expect(container.textContent).not.toMatch(/Watch this case/);
  });

  it("drops the elapsed-days count once a case is finished", () => {
    // "Filed January 11, 2024 (959 days ago)" on a case decided in May 2025
    // reads as though something is still running. The 503 it took is the
    // figure that matters and it has its own row.
    renderDecided(null);
    // Scoped to the Filed row. The "Status read" row keeps its age on
    // purpose: it is provenance, and it stays true for a decided case.
    const filed = screen.getByText("Filed").nextElementSibling;
    expect(filed).toHaveTextContent("January 11, 2024");
    expect(filed).not.toHaveTextContent(/days ago/);
    expect(screen.getByText("Status seen").nextElementSibling).toHaveTextContent(
      /days ago/,
    );
  });

  it("drops the neighbour months, which read as three empty rows", () => {
    const { container } = render(
      <CaseStatusResult
        result={DECIDED}
        backlog={BACKLOG}
        cohortStatuses={[]}
        wall={null}
        neighbours={[
          m("2023-11", 15_330, 15_330),
          m("2023-12", 14_603, 14_603),
          m("2024-01", 11_906, 11_890),
        ]}
        publishedFront="2025-09"
        publishedAsOf="2026-08-20"
        wage={null}
        duration={null}
        today={TODAY}
      estimator={null}
    />,
    );
    expect(container.textContent).not.toMatch(/against its neighbours/);
  });

  it("drops the cohort queue split, which answers a question it does not have", () => {
    // That section exists to explain "DOL passed my month and I still have
    // nothing". On a finished cohort it rendered "0 of the 1 still open are
    // in analyst review", which is noise.
    const { container } = render(
      <CaseStatusResult
        result={DECIDED}
        backlog={BACKLOG}
        cohortStatuses={[
          { status: "CERTIFIED", count: 11_890, isFinal: true },
          { status: "ANALYST REVIEW", count: 1, isFinal: false },
        ]}
        wall={null}
        neighbours={[]}
        publishedFront="2025-09"
        publishedAsOf="2026-08-20"
        wage={null}
        duration={null}
        today={TODAY}
      estimator={null}
    />,
    );
    expect(container.textContent).not.toMatch(/Which queue the rest of/);
  });

  it("flags a case the two federal sources disagree about", () => {
    const { container } = render(
      <CaseStatusResult
        result={{
          ...DECIDED,
          live: { ...DECIDED.live!, status: "DENIED" },
        }}
        backlog={BACKLOG}
        cohortStatuses={[]}
        wall={null}
        neighbours={[]}
        publishedFront="2025-09"
        publishedAsOf="2026-08-20"
        wage={null}
        duration={null}
        today={TODAY}
      estimator={null}
    />,
    );
    expect(container.textContent).toMatch(/two federal sources disagree/i);
    expect(container.textContent).toMatch(/Both are shown below/);
  });

  it("does not cry disagreement over CERTIFIED against certified", () => {
    const { container } = renderDecided(null);
    expect(container.textContent).not.toMatch(/disagree/i);
  });

  it("does not cry disagreement over CERTIFIED - EXPIRED either", () => {
    // 57,038 cases: the mirror knows the 180-day window lapsed and DOL's
    // file still says "certified". That is two sources agreeing about the
    // decision, with one of them holding a later fact.
    const { container } = render(
      <CaseStatusResult
        result={{
          ...DECIDED,
          live: { ...DECIDED.live!, status: "CERTIFIED - EXPIRED" },
        }}
        backlog={BACKLOG}
        cohortStatuses={[]}
        wall={null}
        neighbours={[]}
        publishedFront="2025-09"
        publishedAsOf="2026-08-20"
        wage={null}
        duration={null}
        today={TODAY}
      estimator={null}
    />,
    );
    expect(container.textContent).not.toMatch(/disagree/i);
    expect(container.textContent).toMatch(/180 calendar days/);
  });
});

describe("contrast tokens on paper surfaces", () => {
  /**
   * MEASURED, NOT EYEBALLED. `--primary-on-ink` is lime #2ECC40 in light
   * mode, which is 2.05:1 on a #FAFAFA card: invisible, and it looked
   * completely fine in review. It belongs on an ink block only. `.text-
   * primary` maps to `--primary-text`, which is 4.70:1 light and 8.14:1 dark.
   *
   * Same defect class the other way round on `bg-primary`: the lime does NOT
   * flip between themes but `--foreground` does, so ink-on-lime is 9.83:1 in
   * light and 2.05:1 in dark. `--primary-foreground` is #000 in both.
   */
  it("keeps the ink-only accent off every paper surface in this page", () => {
    const { container } = renderPending();
    const onInk = container.querySelectorAll(".text-primary-on-ink");
    for (const el of Array.from(onInk)) {
      // Every legitimate use sits inside a block that paints the ink ground.
      const ink = el.closest(".bg-foreground");
      expect(
        ink,
        `text-primary-on-ink used outside an ink block: ${el.textContent?.slice(0, 40)}`,
      ).not.toBeNull();
    }
  });

  it("never puts theme-flipping text on the accent, which does not flip", () => {
    const { container } = render(
      <CaseStatusResult
        result={{
          caseNumber: "G-100-24011-633982",
          live: null,
          decided: {
            status: "certified",
            receivedDate: "2024-01-11",
            decisionDate: "2025-05-28",
            days: 503,
            employerName: "Acme Corp",
            jobTitle: "Network Administrator",
            socTitle: "Network and Computer Systems Administrators",
            state: "TN",
            wage: 93_205,
          },
          cohort: null,
          employer: null,
          statusOutlook: null,
        }}
        backlog={BACKLOG}
        cohortStatuses={[]}
        wall={null}
        neighbours={[]}
        publishedFront="2025-09"
        publishedAsOf="2026-08-20"
        wage={{
          socCode: "15-1244.00",
          socTitle: "Network and Computer Systems Administrators",
          state: "TN",
          wage: 93_205,
          occupation: { n: 1_476, avg: 100_000, p5: 62_000, p25: 80_000, p50: 95_000, p75: 118_000, p95: 150_000 },
          inState: null,
        }}
        duration={null}
        today={TODAY}
      estimator={null}
    />,
    );
    for (const el of Array.from(container.querySelectorAll(".bg-primary"))) {
      if ((el.textContent ?? "").trim() === "") continue; // a bare rule or tick
      expect(el.className).toContain("text-primary-foreground");
      expect(el.className).not.toMatch(/\btext-foreground\b/);
    }
  });
});

describe("CaseStatusResult, wage ladder", () => {
  const WAGE = {
    socCode: "15-1244.00",
    socTitle: "Network and Computer Systems Administrators",
    state: "TN",
    wage: 93_205,
    // Real percentiles off the live table for this occupation.
    occupation: { n: 1_476, avg: 100_000, p5: 62_000, p25: 80_000, p50: 95_000, p75: 118_000, p95: 150_000 },
    inState: null,
  };

  function renderWage(over: Partial<typeof WAGE> = {}) {
    const DECIDED: CaseLookupResult = {
      caseNumber: "G-100-24011-633982",
      live: null,
      decided: {
        status: "certified",
        receivedDate: "2024-01-11",
        decisionDate: "2025-05-28",
        days: 503,
        employerName: "Acme Corp",
        jobTitle: "Network Administrator",
        socTitle: WAGE.socTitle,
        state: "TN",
        wage: WAGE.wage,
      },
      cohort: null,
      employer: null,
      statusOutlook: null,
    };
    return render(
      <CaseStatusResult
        result={DECIDED}
        backlog={BACKLOG}
        cohortStatuses={[]}
        wall={null}
        neighbours={[]}
        publishedFront="2025-09"
        publishedAsOf="2026-08-20"
        wage={{ ...WAGE, ...over }}
        duration={null}
        today={TODAY}
      estimator={null}
    />,
    );
  }

  it("puts every label at its own coordinate, not at an even interval", () => {
    // The median of 95,000 on a 62,000 to 150,000 rail is at 37.5%, NOT at
    // the 50% an evenly-spaced axis would put it. This is the exact defect
    // this repo already has a post-mortem for on another diagram.
    const { container } = renderWage();
    const median = Array.from(container.querySelectorAll("p")).find((el) =>
      el.textContent?.includes("median"),
    );
    expect(median).toBeDefined();
    expect(median!.getAttribute("style")).toContain("left: 37.5%");
  });

  it("places the subject's marker by its real value", () => {
    // 93,205 on the same rail is (93205-62000)/88000 = 35.46%.
    const { container } = renderWage();
    const marker = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent === "$93,205",
    );
    expect(marker!.getAttribute("style")).toContain("left: 35.4602");
  });

  it("shades only the middle half, and says what the shading is", () => {
    const { container } = renderWage();
    // p25 80,000 -> 20.45%, p75 118,000 -> 63.63%, so width 43.18%.
    const band = Array.from(container.querySelectorAll("span")).find((el) =>
      el.className.includes("bg-foreground/20"),
    );
    expect(band!.getAttribute("style")).toContain("left: 20.4545");
    expect(container.textContent).toMatch(/shaded band is the middle half/);
    expect(container.textContent).toMatch(/\$80,000 to \$118,000/);
  });

  it("keeps an outlier inside its own figure rather than off the plate", () => {
    const { container } = renderWage({ wage: 400_000 });
    const marker = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent === "$400,000",
    );
    expect(marker!.getAttribute("style")).toContain("left: 100%");
  });

  it("draws nothing rather than half a ladder when the rail has no ends", () => {
    const { container } = renderWage({
      occupation: { n: 40, avg: null, p5: null, p25: null, p50: null, p75: null, p95: null },
    });
    expect(container.textContent).not.toMatch(/Where this wage sits/);
  });

  it("prefers the in-state ladder and names the scope it drew", () => {
    const { container } = renderWage({
      inState: { n: 90, avg: 99_000, p5: 70_000, p25: 82_000, p50: 96_000, p75: 112_000, p95: 140_000 },
    });
    expect(container.textContent).toMatch(/in TN/);
    expect(container.textContent).toMatch(/90 certified cases/);
  });
});

describe("CaseNotFound", () => {
  function renderMissing() {
    const parsed = parseCaseNumber("G-100-26125-999999");
    return render(
      <CaseNotFound
        caseNumber="G-100-26125-999999"
        parsed={parsed}
        cohort={BACKLOG.find((x) => x.month === "2026-05") ?? null}
        wall={buildWall(BACKLOG, "2026-05")}
        neighbours={neighbourMonths(BACKLOG, "2026-05", 2)}
        publishedFront="2025-09"
        publishedAsOf="2026-08-20"
        mirrorSize={412_865}
      />,
    );
  }

  it("says we do not have it, and does not call that a problem with the case", () => {
    const { container } = renderMissing();
    const text = container.textContent ?? "";
    expect(text).toMatch(/We hold no record for/);
    expect(text).toMatch(/not a statement about the case/);
    expect(text).not.toMatch(/invalid|error|not found in DOL/i);
  });

  it("attributes every cohort figure to the MONTH, never to the case", () => {
    // The exact confusion this component exists to prevent: a figure sitting
    // under somebody's own case number reads as being about their case.
    const { container } = renderMissing();
    const text = container.textContent ?? "";
    expect(
      screen.getByRole("heading", { name: /Cases filed in May 2026/ }),
    ).toBeInTheDocument();
    expect(text).toMatch(/None of this was measured on G-100-26125-999999/);
    expect(text).toMatch(/in front of that filing month/);
    // And nothing claims the case itself has a position.
    expect(text).not.toMatch(/Filed before this case/);
    expect(text).not.toMatch(/this case is in/i);
  });

  it("never says 'yours' about a month, in the chart or in its caption", () => {
    // The heading says none of this was measured on their case, and then the
    // drawing labelled a column "Yours" and the caption said "the total filed
    // before yours". Two places, one contradiction, and the chart is the one
    // people read.
    const { container } = renderMissing();
    const text = container.textContent ?? "";
    // NOT a \b-anchored regex. The marker glues to the next block in
    // textContent ("Yours49,808"), so /\bYours\b/ can never match and a
    // negative assertion built on it passes for the wrong reason. This
    // caught itself only because the positive control below went red.
    expect(text).not.toContain("Yours");
    expect(text).not.toMatch(/before yours/);
    expect(text).toContain("This month");
    expect(text).toMatch(/the total filed before that month/);
  });

  it("still says 'yours' when the case really was found", () => {
    // The control. Without it the rule above passes on a component that
    // never attributes anything to anybody.
    const { container } = renderPending();
    expect(container.textContent).toContain("Yours");
    expect(container.textContent).toMatch(/the total filed before yours/);
  });

  it("decodes the number so the month it is showing is accounted for", () => {
    const { container } = renderMissing();
    expect(container.textContent).toMatch(/day 125 of 2026/);
    expect(container.textContent).toMatch(/matches exactly for 89%/);
  });

  it("offers the alert path rather than leaving a dead end", () => {
    renderMissing();
    expect(
      screen.getByRole("link", { name: /Get told when DOL reaches that month/ }),
    ).toHaveAttribute("href", "/perm-processing-times");
  });

  it("still refuses to predict anything, on the empty-handed path too", () => {
    const { container } = renderMissing();
    expect(container.textContent).toMatch(/will not tell you/i);
  });

  it("explains a legacy number rather than showing a month it guessed", () => {
    // 92,248 real cases use the three-segment form. It carries no readable
    // filing date (13.4% exact against a 90.5% control), so there is no
    // cohort to show and the page has to say why instead of guessing one.
    const { container } = render(
      <CaseNotFound
        caseNumber="A-23043-00641"
        parsed={null}
        isLegacy
        cohort={null}
        wall={null}
        neighbours={[]}
        publishedFront="2025-09"
        publishedAsOf="2026-08-20"
        mirrorSize={412_865}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toMatch(/older case-number format/);
    expect(text).toMatch(/13% of the time/);
    expect(text).not.toMatch(/Cases filed in/);
    // And no alert form: every legacy case is already decided.
    expect(text).not.toMatch(/Watch this case/);
  });

  it("offers the alert on a current-format number it cannot find", () => {
    // Normal for a recent filing, and exactly the case worth watching.
    const { container } = renderMissing();
    expect(container.textContent).toMatch(/Watch this case/);
  });

  it("renders without a cohort when the month is one we hold nothing for", () => {
    const { container } = render(
      <CaseNotFound
        caseNumber="G-100-19125-999999"
        parsed={null}
        cohort={null}
        wall={null}
        neighbours={[]}
        publishedFront={null}
        publishedAsOf={null}
        mirrorSize={null}
      />,
    );
    expect(container.textContent).toMatch(/We hold no record for/);
    expect(container.textContent).not.toMatch(/Cases filed in/);
  });
});
