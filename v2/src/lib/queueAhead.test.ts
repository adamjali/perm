import { describe, expect, it } from "vitest";

import {
  casesAheadOfDay,
  deriveActiveRange,
  deriveQueueAhead,
  findVolumeAnomalies,
  type MonthQueue,
  aheadOfDay,
  measureFilingRate,
} from "./queueAhead";

/** A MonthQueue fixture: total received, and how many are still pending. */
const m = (filingMonth: string, total: number, pending: number): MonthQueue => ({
  filingMonth, total, pending, decided: total - pending,
  decidedPct: total > 0 ? ((total - pending) / total) * 100 : null,
});

/**
 * A month row, with decidedPct derived rather than passed, so a fixture can
 * never claim a percentage its own total and decided count disagree with.
 */
function month(filingMonth: string, total: number, decided: number): MonthQueue {
  return {
    filingMonth,
    total,
    pending: total - decided,
    decided,
    decidedPct: total > 0 ? (decided / total) * 100 : null,
  };
}

/**
 * Shaped like the real series: old months finished, a band in progress, and
 * recent months untouched. October is the shutdown collapse.
 */
const SERIES: MonthQueue[] = [
  month("2025-06", 14_000, 14_000),
  month("2025-07", 13_500, 13_400),
  month("2025-08", 14_200, 9_000),
  month("2025-09", 13_800, 4_000),
  month("2025-10", 1_616, 300),
  month("2025-11", 14_100, 0),
  month("2025-12", 13_900, 0),
];

describe("deriveQueueAhead", () => {
  it("counts pending cases in earlier months only", () => {
    const r = deriveQueueAhead(SERIES, "2025-09");
    // 0 + 100 + 5,200 pending from Jun/Jul/Aug.
    expect(r.ahead).toBe(0 + 100 + 5_200);
  });

  it("excludes the subject month from what is ahead of it", () => {
    const r = deriveQueueAhead(SERIES, "2025-09");
    expect(r.sameMonth).toBe(9_800);
    expect(r.subject?.filingMonth).toBe("2025-09");
    // Its own 9,800 pending are reported separately and are NOT in `ahead`:
    // the two together are what the whole series before October holds.
    const throughSubject = SERIES.filter((m) => m.filingMonth <= "2025-09").reduce(
      (n, m) => n + m.pending,
      0,
    );
    expect(r.ahead + r.sameMonth).toBe(throughSubject);
    expect(r.ahead).toBe(throughSubject - 9_800);
  });

  it("counts PENDING, not total - the error that flatters a wait", () => {
    const r = deriveQueueAhead(SERIES, "2025-09");
    const totalsAhead = 14_000 + 13_500 + 14_200;
    expect(r.ahead).toBeLessThan(totalsAhead);
    // Summing totals instead would be ~7x the honest figure and still plausible.
    expect(totalsAhead / r.ahead).toBeGreaterThan(5);
  });

  it("returns zero ahead for the oldest month", () => {
    expect(deriveQueueAhead(SERIES, "2025-06").ahead).toBe(0);
  });

  it("still totals earlier months for a month it holds no row for", () => {
    const r = deriveQueueAhead(SERIES, "2026-05");
    expect(r.subject).toBeNull();
    expect(r.sameMonth).toBe(0);
    expect(r.ahead).toBe(SERIES.reduce((n, m) => n + m.pending, 0));
  });

  it("handles an empty series without throwing", () => {
    expect(deriveQueueAhead([], "2025-09")).toEqual({
      ahead: 0,
      sameMonth: 0,
      subject: null,
    });
  });
});

describe("deriveActiveRange", () => {
  it("spans the months started but not finished", () => {
    // Jun is 100% and Nov/Dec are 0%, so neither end is being worked.
    expect(deriveActiveRange(SERIES)).toEqual({ from: "2025-08", to: "2025-10" });
  });

  it("is null when nothing is part-done", () => {
    expect(
      deriveActiveRange([month("2025-06", 100, 100), month("2025-07", 100, 0)]),
    ).toBeNull();
  });
});

describe("findVolumeAnomalies", () => {
  it("finds the collapsed month and reports how far it fell", () => {
    const found = findVolumeAnomalies(SERIES);
    expect(found.map((a) => a.filingMonth)).toEqual(["2025-10"]);
    expect(found[0]!.neighbourMean).toBe(13_950);
    expect(found[0]!.ratio).toBeCloseTo(0.116, 3);
  });

  it("finds nothing in an even series", () => {
    const even = ["2025-06", "2025-07", "2025-08", "2025-09"].map((m) =>
      month(m, 14_000, 1_000),
    );
    expect(findVolumeAnomalies(even)).toEqual([]);
  });

  it("never flags the newest month, which is partial by construction", () => {
    const partial = [...SERIES.slice(0, 3), month("2025-09", 400, 0)];
    expect(findVolumeAnomalies(partial).map((a) => a.filingMonth)).not.toContain(
      "2025-09",
    );
  });

  it("does not flag an ordinary dip", () => {
    const dip = [
      month("2025-06", 14_000, 0),
      month("2025-07", 9_000, 0),
      month("2025-08", 14_000, 0),
    ];
    expect(findVolumeAnomalies(dip)).toEqual([]);
  });
});

describe("casesAheadOfDay", () => {
  const months = [
    { filingMonth: "2025-11", total: 100, pending: 4000, decided: 0, decidedPct: 0 },
    { filingMonth: "2025-12", total: 100, pending: 6000, decided: 0, decidedPct: 0 },
    { filingMonth: "2026-01", total: 100, pending: 3100, decided: 0, decidedPct: 0 },
  ];

  it("counts every earlier month in full", () => {
    // 1 Dec: nothing of December is ahead, all of November is.
    expect(casesAheadOfDay(months, "2025-12-01")).toBe(4000);
  });

  it("PRORATES the filing month rather than dropping it", () => {
    // Dropping it is the bug this exists for: at DOL's ~625/day, December's
    // 6,000 pending is nearly ten days of the answer.
    const mid = casesAheadOfDay(months, "2025-12-16");
    expect(mid).toBeGreaterThan(4000);
    expect(mid).toBe(4000 + Math.round(6000 * (15 / 31)));
  });

  it("excludes cases filed on your own day", () => {
    // (day - 1): a case filed the same day is not ahead of you.
    expect(casesAheadOfDay(months, "2025-12-01")).toBe(4000);
  });

  it("uses the real length of the month, not 30.44", () => {
    const feb = [
      { filingMonth: "2026-01", total: 1, pending: 1000, decided: 0, decidedPct: 0 },
      { filingMonth: "2026-02", total: 1, pending: 2800, decided: 0, decidedPct: 0 },
    ];
    // 2026 is not a leap year, so February is 28 days.
    expect(casesAheadOfDay(feb, "2026-02-15")).toBe(1000 + Math.round(2800 * (14 / 28)));
  });

  it("returns null for a month the series does not hold", () => {
    // Never 0 - that reads as "nothing ahead of you", the one answer this
    // must not invent.
    expect(casesAheadOfDay(months, "2030-06-15")).toBeNull();
  });

  it("returns null on a malformed date", () => {
    expect(casesAheadOfDay(months, "2026-01")).toBeNull();
  });
});

describe("measureFilingRate", () => {
  // Real 2026 shape: the newest months are still growing and must not count.
  const MONTHS: MonthQueue[] = [
    m("2026-02", 5_492, 5_000), m("2026-03", 7_036, 6_500),
    m("2026-04", 7_306, 6_000), m("2026-05", 8_661, 5_000),
    m("2026-06", 10_627, 4_000), m("2026-07", 9_167, 2_000),
    m("2026-08", 8_940, 200), m("2026-09", 3_873, 40),
  ];

  it("EXCLUDES the months that are still filling in", () => {
    // Measured: over one week August gained 1,261 cases (+16.4%) and June 463
    // (+4.6%), while July gained 40 (+0.4%). Counting the unsettled ones makes
    // filings look slower, which makes a future estimate look SOONER - the
    // error points the flattering way, which is the kind that survives review.
    const r = measureFilingRate(MONTHS, "2026-09-13")!;
    expect(r.to).toBe("2026-07");
    expect(r.from).toBe("2026-02");
    expect(r.monthsUsed).toBe(6);
  });

  it("gives a calendar-day rate, not a working-day one", () => {
    const r = measureFilingRate(MONTHS, "2026-09-13")!;
    // 48,289 over 6 months / 30.44
    expect(Math.round(r.perDay)).toBe(264);
  });

  it("returns null rather than guessing from too little", () => {
    expect(measureFilingRate(MONTHS.slice(-3), "2026-09-13")).toBeNull();
    expect(measureFilingRate(MONTHS, "nonsense")).toBeNull();
  });
});

describe("aheadOfDay: past, present and future", () => {
  const MONTHS: MonthQueue[] = [
    m("2026-06", 10_000, 4_000), m("2026-07", 10_000, 2_000),
    m("2026-08", 10_000, 500), m("2026-09", 4_000, 100),
  ];
  const pending = MONTHS.reduce((a, x) => a + x.pending, 0);

  it("a date inside the census counts, and projects nothing", () => {
    const r = aheadOfDay(MONTHS, "2026-08-15")!;
    expect(r.projected).toBe(0);
    expect(r.total).toBe(r.pending);
  });

  it("a date BEFORE our data is still refused", () => {
    // We genuinely do not know. Null, never 0.
    expect(aheadOfDay(MONTHS, "2019-05-15")).toBeNull();
  });

  it("a FUTURE date counts every pending case", () => {
    const r = aheadOfDay(MONTHS, "2026-11-15", { today: "2026-09-13", filingRate: 264 })!;
    expect(r.pending).toBe(pending);
  });

  it("and ADDS the people who will file before you", () => {
    // Without this every future date gives the same answer, which is what
    // both rivals ship and is transparently wrong.
    const near = aheadOfDay(MONTHS, "2026-10-13", { today: "2026-09-13", filingRate: 264 })!;
    const far = aheadOfDay(MONTHS, "2027-09-13", { today: "2026-09-13", filingRate: 264 })!;
    expect(near.total).toBeLessThan(far.total);
    expect(far.projected).toBeGreaterThan(90_000);
    expect(near.projected).toBe(Math.round(264 * 30));
  });

  it("keeps counted and projected SEPARATE", () => {
    const r = aheadOfDay(MONTHS, "2026-12-13", { today: "2026-09-13", filingRate: 264 })!;
    expect(r.total).toBe(r.pending + r.projected);
    expect(r.pending).toBe(pending);
    expect(r.projected).toBeGreaterThan(0);
  });

  it("answers a future date without a rate, projecting nothing", () => {
    // Answerable but not projectable: say what was counted and no more.
    const r = aheadOfDay(MONTHS, "2026-11-15", { today: "2026-09-13" })!;
    expect(r.total).toBe(pending);
    expect(r.projected).toBe(0);
  });
});
