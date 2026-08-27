/**
 * The review stages: RFI, holds, NORD, supervised recruitment, and appeals.
 *
 * WHAT THIS FILE CAN AND CANNOT SEE, because every number on the page turns
 * on it.
 *
 * `perm_case_status` is a MIRROR, and a mirror holds ONE observation per
 * case. It knows a case is at RFI ISSUED today. It does not know the case was
 * at RFI ISSUED last month, and it will not know once the case moves on. So
 * everything derived here is a CENSUS - how many cases sit at each stage right
 * now - and never a FLOW. There is no honest way to build a "RFIs issued per
 * month" series out of it, and this file deliberately exposes no function that
 * would let a caller imply one.
 *
 * The one thing a snapshot CAN say about time is where a stage sits in a
 * case's life, because every row carries `filing_date` and the date we
 * observed it. That is `AgeBand`, and it is the spine of the page.
 *
 * The outcome half - what happened to cases that already passed through an
 * RFI - cannot come from here at all, for the reason above. It comes from
 * `rfi_funnel`, a single aggregate row from a different source, and it is
 * kept in its own function with its own provenance so the two can never be
 * mistaken for one dataset.
 */
import "server-only";

import { one, rows } from "./client";

// ---------------------------------------------------------------------------
// Shared SQL: the pending population
// ---------------------------------------------------------------------------

/**
 * PENDING IS `is_final`, NEVER A HARDCODED STATUS LIST. `getLiveBacklog` in
 * publicData.ts settled this: the status count moved from 15 to 16 while that
 * function was being written, and a list would have absorbed the new one
 * silently. The same argument applies with more force here, because a new
 * REVIEW stage is exactly the kind of row this page exists to show.
 */
const PENDING = "is_final = 0";

/**
 * DOL'S OWN TEST FIXTURE IS IN THE LIVE CASE-STATUS FEED, and on the rare
 * stages it is most of the stage.
 *
 * Ten cases carry the employer name `bah-test-company-name` (BAH is the
 * agency's FLAG contractor; one of them lists the job title `BAH_TESTER`).
 * They are spread across seven statuses, and because the review stages are
 * tiny the fixture dominates them: it was the ONLY case at PENDING AUDIT
 * RESPONSE, one of three at SUPERVISED RECRUITMENT, and two of four at
 * REQUEST FOR REVIEW. Publishing those counts unfiltered would have put
 * DOL's test data on the page as a fact about PERM.
 *
 * Excluded by exact name, never by a `LIKE '%test%'` pattern, which matches
 * Educational Testing Service, Intertek Testing Services and forty other real
 * employers. Checked for other spellings: nothing else begins `bah-`.
 *
 * This is the only exclusion in this file. Records that merely look odd stay
 * in, and the page shows the raw contents of every stage small enough for one
 * record to move the number. Deciding which of those are genuine is not a
 * judgement a data page gets to make silently.
 */
const TEST_FIXTURE_EMPLOYER = "bah-test-company-name";
const NOT_FIXTURE = "employer_name IS NOT ?";

/** Days between filing and the moment we observed the case at this stage. */
const AGE_DAYS = `CASE
  WHEN filing_date IS NOT NULL AND filing_date <> '' AND last_checked_at IS NOT NULL
  THEN CAST(julianday(substr(last_checked_at, 1, 10)) - julianday(filing_date) AS INTEGER)
END`;

/**
 * The filing months holding the middle 98% of open RFIs, computed from the
 * data rather than typed in.
 *
 * Open RFIs are not spread across the backlog: they cluster hard in the
 * cohorts DOL's analysts are working through. A rate that divides those RFIs
 * by every filing month ever is dividing by cases DOL has not looked at yet,
 * and it reads as a reassuringly small number for the wrong reason. Scoping
 * to the window is what makes the occupation comparison mean anything.
 *
 * Derived, so it moves when the queue moves. A hand-typed window is right
 * once and wrong every quarter after that.
 */
const RFI_WINDOW = `
  SELECT MIN(CASE WHEN rn >= MAX(1, n / 100)     THEN m END) AS lo,
         MAX(CASE WHEN rn <= n - MAX(1, n / 100) THEN m END) AS hi
    FROM (SELECT substr(filing_date, 1, 7)                  AS m,
                 ROW_NUMBER() OVER (ORDER BY filing_date)   AS rn,
                 COUNT(*)     OVER ()                       AS n
            FROM perm_case_status
           WHERE current_status = 'RFI ISSUED'
             AND filing_date IS NOT NULL AND filing_date <> ''
             AND ${NOT_FIXTURE})`;

// ---------------------------------------------------------------------------
// The stage census
// ---------------------------------------------------------------------------

/**
 * Where a stage sits in a case's life, in days since filing.
 *
 * Present only when the band is worth drawing. See `ageBand` below for the
 * two conditions and why an unguarded band is actively misleading.
 */
export interface AgeBand {
  p10: number;
  median: number;
  p90: number;
  /** Cases the band was computed from, which is NOT always the stage's size. */
  n: number;
}

export interface ReviewStage {
  status: string;
  cases: number;
  /**
   * DISTINCT NAME STRINGS, not distinct firms. DOL prints one practice under
   * several spellings - the BALCA rows carry PricewaterhouseCoopers and PwC
   * entities under eight of them - so this OVERSTATES how many separate
   * organisations are involved. Named for what it measures, because
   * "employers" would be a claim the data cannot support. Nothing here
   * attempts to merge them: an entity resolver is a real piece of work and a
   * half-built one silently merges two genuinely different companies.
   */
  employerNames: number;
  /** Largest single employer NAME at this stage, and its count. */
  topEmployer: string | null;
  topEmployerCases: number;
  /** Earliest and latest date we observed a case at this stage. */
  seenFrom: string | null;
  seenTo: string | null;
  ageBand: AgeBand | null;
}

/**
 * Every stage a pending case can be at, largest first.
 *
 * The percentiles are computed with a window function and aggregated BEFORE
 * the join. The obvious phrasing - join the per-case rows to the ranked rows
 * on status - is a cross product, and on the 94,435-case analyst-review
 * partition it does not return.
 */
export async function getReviewStages(): Promise<ReviewStage[]> {
  const r = await rows<Record<string, unknown>>(
    `WITH pend AS (
       SELECT current_status AS status, employer_name,
              ${AGE_DAYS} AS days, substr(last_checked_at, 1, 10) AS seen
         FROM perm_case_status WHERE ${PENDING} AND ${NOT_FIXTURE}
     ),
     ranked AS (
       SELECT status, days,
              ROW_NUMBER() OVER (PARTITION BY status ORDER BY days) AS rn,
              COUNT(*)     OVER (PARTITION BY status)               AS aged
         FROM pend WHERE days IS NOT NULL
     ),
     pct AS (
       SELECT status, MAX(aged) AS aged,
              MAX(CASE WHEN rn = MAX(1, aged / 2)        THEN days END) AS d50,
              MAX(CASE WHEN rn = MAX(1, aged / 10)       THEN days END) AS d10,
              MAX(CASE WHEN rn = MAX(1, aged * 9 / 10)   THEN days END) AS d90
         FROM ranked GROUP BY status
     ),
     cen AS (
       SELECT status, COUNT(*) AS cases,
              COUNT(DISTINCT employer_name) AS employer_names,
              MIN(seen) AS seen_from, MAX(seen) AS seen_to
         FROM pend GROUP BY status
     ),
     top AS (
       SELECT status, employer_name, n FROM (
         SELECT status, employer_name, COUNT(*) AS n,
                ROW_NUMBER() OVER (PARTITION BY status ORDER BY COUNT(*) DESC) AS rk
           FROM pend WHERE employer_name IS NOT NULL AND employer_name <> ''
          GROUP BY status, employer_name)
        WHERE rk = 1
     )
     SELECT cen.status, cen.cases, cen.employer_names, cen.seen_from, cen.seen_to,
            pct.aged, pct.d10, pct.d50, pct.d90,
            top.employer_name AS top_employer, top.n AS top_cases
       FROM cen
       LEFT JOIN pct ON pct.status = cen.status
       LEFT JOIN top ON top.status = cen.status
      ORDER BY cen.cases DESC`,
    [TEST_FIXTURE_EMPLOYER],
  );
  return r.map((x) => ({
    status: String(x.status),
    cases: Number(x.cases) || 0,
    employerNames: Number(x.employer_names) || 0,
    topEmployer: x.top_employer == null ? null : String(x.top_employer),
    topEmployerCases: Number(x.top_cases) || 0,
    seenFrom: x.seen_from == null ? null : String(x.seen_from),
    seenTo: x.seen_to == null ? null : String(x.seen_to),
    ageBand: ageBand(x),
  }));
}

/**
 * A day band, or null when drawing one would be dishonest.
 *
 * TWO GUARDS, AND BOTH CAUGHT SOMETHING REAL.
 *
 * `n >= MIN_BAND_N` withholds the stages measured in single digits. A 10th
 * and 90th percentile over two cases is those two cases wearing the clothes
 * of a distribution, and drawn on the same axis as a 94,435-case band it
 * reads as equally solid.
 *
 * `n >= cases / 2` withholds a band computed from a small slice of its own
 * stage. IN PROCESS holds 71 cases and only 3 of them carry both a filing
 * date and an observation date, so its band describes 4% of the stage while
 * being labelled with the stage's name. That is the failure the ratio exists
 * to catch, and nothing about the numbers themselves reveals it.
 */
export const MIN_BAND_N = 20;

/**
 * Exported so the withholding rule can be tested without a database.
 *
 * A guard buried inside an async query is a guard nobody probes, and this one
 * is the difference between a chart that reports where a stage sits and one
 * that reports where three cases sit.
 *
 * @param aged  cases carrying BOTH a filing date and an observation date
 * @param cases the stage's full size
 */
export function bandIsPublishable(aged: number, cases: number): boolean {
  return aged >= MIN_BAND_N && aged * 2 >= cases;
}

function ageBand(x: Record<string, unknown>): AgeBand | null {
  const n = Number(x.aged) || 0;
  const cases = Number(x.cases) || 0;
  if (!bandIsPublishable(n, cases)) return null;
  const p10 = x.d10 == null ? null : Number(x.d10);
  const median = x.d50 == null ? null : Number(x.d50);
  const p90 = x.d90 == null ? null : Number(x.d90);
  if (p10 === null || median === null || p90 === null) return null;
  return { p10, median, p90, n };
}

// ---------------------------------------------------------------------------
// The stages too small to summarise
// ---------------------------------------------------------------------------

/**
 * Below this, one record moves the number enough that a summary statistic is
 * a summary of nothing. Those stages get their contents printed instead.
 */
export const SMALL_STAGE_MAX = 20;

export interface StageRecord {
  status: string;
  employer: string | null;
  jobTitle: string | null;
  filingMonth: string | null;
}

/**
 * Every case at a stage holding fewer than `SMALL_STAGE_MAX`, printed.
 *
 * The alternative was a curated exclusion list, and it is the wrong tool. Two
 * of the supervised-recruitment records name The White House as the employer
 * with the job titles "Wisdom" and "Money"; they do not read as genuine
 * filings, and I am not the right party to strike them from a federal record
 * on that basis. Showing the rows hands the reader the same evidence and
 * costs nothing, and it keeps working when the next odd record is one I would
 * not have recognised.
 *
 * Employer and job title only. Case numbers are deliberately not returned:
 * these are individual people's applications, and a page about the rarest
 * stages should not become a way to look four of them up.
 */
export async function getSmallStageRecords(): Promise<StageRecord[]> {
  const r = await rows<Record<string, unknown>>(
    `WITH small AS (
       SELECT current_status AS status FROM perm_case_status
        WHERE ${PENDING} AND ${NOT_FIXTURE}
        GROUP BY current_status HAVING COUNT(*) < ?
     )
     SELECT c.current_status AS status, c.employer_name, c.job_title,
            substr(c.filing_date, 1, 7) AS month
       FROM perm_case_status c JOIN small ON small.status = c.current_status
      WHERE c.${PENDING} AND c.${NOT_FIXTURE}
      ORDER BY c.current_status, c.filing_date`,
    [TEST_FIXTURE_EMPLOYER, SMALL_STAGE_MAX, TEST_FIXTURE_EMPLOYER],
  );
  return r.map((x) => ({
    status: String(x.status),
    employer: x.employer_name == null ? null : String(x.employer_name),
    jobTitle: x.job_title == null ? null : String(x.job_title),
    filingMonth: x.month == null ? null : String(x.month),
  }));
}

// ---------------------------------------------------------------------------
// Stage by filing cohort
// ---------------------------------------------------------------------------

export interface StageCohort {
  /** Filing month, `YYYY-MM`. */
  month: string;
  filed: number;
  /** Cases from this month at each review stage, keyed by status. */
  stages: Record<string, number>;
}

/**
 * Review-stage counts per filing month, oldest first.
 *
 * This is the closest honest thing to a trend the mirror can produce, and it
 * is worth being exact about what it is NOT. It does not say RFIs are rising
 * or falling. It says which filing cohorts currently hold open RFIs, which is
 * a statement about where DOL is working, not about how often DOL issues one.
 *
 * Months with no review-stage case at all are dropped: the chart's subject is
 * the stages, and 30 empty columns bury the five that carry the shape.
 */
export async function getStageCohorts(statuses: string[]): Promise<StageCohort[]> {
  if (statuses.length === 0) return [];
  // Every status, then filter in JS. `filed` has to count the whole month
  // including decided cases, so the query cannot filter to the wanted
  // statuses without losing its own denominator.
  const r = await rows<Record<string, unknown>>(
    `SELECT substr(filing_date, 1, 7) AS month, current_status AS status, COUNT(*) AS n
       FROM perm_case_status
      WHERE filing_date IS NOT NULL AND filing_date <> '' AND ${NOT_FIXTURE}
      GROUP BY month, status ORDER BY month`,
    [TEST_FIXTURE_EMPLOYER],
  );
  const wanted = new Set(statuses);
  const byMonth = new Map<string, StageCohort>();
  for (const x of r) {
    const month = String(x.month);
    const n = Number(x.n) || 0;
    let row = byMonth.get(month);
    if (!row) {
      row = { month, filed: 0, stages: {} };
      byMonth.set(month, row);
    }
    row.filed += n;
    const status = String(x.status);
    if (wanted.has(status)) row.stages[status] = (row.stages[status] ?? 0) + n;
  }
  return [...byMonth.values()].filter((m) =>
    Object.values(m.stages).some((n) => n > 0),
  );
}

// ---------------------------------------------------------------------------
// What happens after an RFI
// ---------------------------------------------------------------------------

export interface RfiFunnel {
  /** Cases the upstream watch list covers. NOT our mirror's population. */
  totalTracked: number;
  everIssued: number;
  resolved: number;
  certified: number;
  denied: number;
  withdrawn: number;
  /** Ever issued minus resolved: had an RFI, no final decision yet. */
  stillOpen: number;
  medianDaysToDecision: number | null;
  observedAt: number;
  source: string;
}

/**
 * The RFI outcome funnel.
 *
 * `ever_audit` IS DELIBERATELY NOT EXPOSED. The column exists and reads 0,
 * and 0 here is a missing measurement wearing a number's clothes: DOL's own
 * processing-times page publishes a live Audit Review queue, so audits are
 * plainly still happening. Returning the field would put a false "no audits"
 * one `?? 0` away from the page. `ever_reconsideration` and `ever_balca` are
 * withheld for the same reason at a smaller scale: they read 54 and 90 while
 * our own mirror shows 166 and 165 sitting at those stages RIGHT NOW, which
 * cannot both be a complete history.
 *
 * Returns null rather than zeroes when the row is missing, so a caller has to
 * decide what to render instead of silently publishing an empty funnel.
 */
export async function getRfiFunnel(): Promise<RfiFunnel | null> {
  const x = await one<Record<string, unknown>>(
    `SELECT observed_at, total_tracked, ever_rfi, rfi_resolved, rfi_certified,
            rfi_denied, rfi_withdrawn, median_days_to_decision, source
       FROM rfi_funnel ORDER BY observed_at DESC LIMIT 1`,
  );
  if (!x) return null;
  const everIssued = Number(x.ever_rfi) || 0;
  const resolved = Number(x.rfi_resolved) || 0;
  if (everIssued <= 0 || resolved <= 0) return null;
  const median = Number(x.median_days_to_decision) || 0;
  return {
    totalTracked: Number(x.total_tracked) || 0,
    everIssued,
    resolved,
    certified: Number(x.rfi_certified) || 0,
    denied: Number(x.rfi_denied) || 0,
    withdrawn: Number(x.rfi_withdrawn) || 0,
    stillOpen: Math.max(0, everIssued - resolved),
    medianDaysToDecision: median > 0 ? median : null,
    observedAt: Number(x.observed_at) || 0,
    source: String(x.source ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Which occupations are carrying the open RFIs
// ---------------------------------------------------------------------------

/**
 * Wilson score interval for a proportion, in percent.
 *
 * A SECOND COPY, DELIBERATELY, AND THE REPO ALREADY MADE THIS CHOICE ONCE.
 * `RateBars.wilsonInterval` is the original, but RateBars.tsx is a
 * `"use client"` module, so calling its export from a server component throws
 * at runtime: "Attempted to call wilsonInterval() from the server but
 * wilsonInterval is on the client." That is not a type error and jsdom does
 * not reproduce it, so `pnpm typecheck` and the component tests were both
 * green while the section was broken in the browser. `src/lib/wageLadder.ts`
 * hit the same wall and answered it the same way, with an equivalence test
 * pinning the two together; `rfiWilsonMatchesRateBars` in the tests does that
 * job here.
 *
 * Character-for-character the arithmetic in RateBars. The normal
 * approximation is wrong exactly where these rates live - small counts near
 * zero - and would print a negative lower bound.
 *
 * Computed HERE rather than in the component because an interval is a property
 * of the measurement, not of the rendering.
 */
export function wilsonInterval(
  numerator: number,
  denominator: number,
  z = 1.96,
): { lo: number; hi: number } | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0)
    return null;
  const p = numerator / denominator;
  const denom = 1 + (z * z) / denominator;
  const centre = (p + (z * z) / (2 * denominator)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p)) / denominator + (z * z) / (4 * denominator * denominator))) /
    denom;
  return {
    lo: Math.max(0, (centre - half) * 100),
    hi: Math.min(100, (centre + half) * 100),
  };
}

export interface RfiOccupation {
  title: string;
  rfi: number;
  /** Distinct employer names among the RFI cases. */
  rfiEmployers: number;
  filed: number;
  filedEmployers: number;
  /** Open RFIs as a percentage of cases filed with this title in the window. */
  rate: number;
  /** 95% Wilson interval on that rate, in percent. */
  ci: { lo: number; hi: number } | null;
}

export interface RfiOccupationCut {
  /** Inclusive filing months the cut covers, `YYYY-MM`. */
  from: string;
  to: string;
  filed: number;
  rfi: number;
  /** Open RFIs over all filings in the window, as a percentage. */
  baseline: number;
  rows: RfiOccupation[];
  /** Titles that cleared the case floor and failed an employer floor. */
  withheld: number;
}

/**
 * MIN_RFI keeps a title off the chart until it has enough cases to be about
 * an occupation rather than about a coincidence.
 *
 * MIN_EMPLOYERS is the one that matters, and it was not in the first draft.
 * Ranked without it, the two most "at risk" occupations in PERM were
 * DISHWASHERS at 100% and FACILITIES AND GROUND SUPPORT MECHANIC at 90%. Both
 * are one employer's batch of filings, and both would have been published as
 * a fact about the job. A rate over a title only one employer uses is that
 * employer's case wearing an occupation's name. The floor applies to the
 * numerator and the denominator separately, because either one can be a
 * single filer.
 */
export const MIN_RFI = 6;
export const MIN_EMPLOYERS = 5;

/**
 * Whether a title's rate is about the occupation or about one filer.
 *
 * Exported for the same reason as `bandIsPublishable`: this is the guard that
 * kept DISHWASHERS at 100% and FACILITIES AND GROUND SUPPORT MECHANIC at 90%
 * off the page, and both of those are one employer's batch of filings. Both
 * sides are checked, because either the RFI cases or the whole population can
 * come from a single company.
 */
export function occupationIsPublishable(
  rfiEmployers: number,
  filedEmployers: number,
): boolean {
  return rfiEmployers >= MIN_EMPLOYERS && filedEmployers >= MIN_EMPLOYERS;
}

/**
 * Open-RFI rate by job title, inside the filing window RFIs actually live in.
 *
 * TWO LIMITS THAT THE PAGE MUST STATE, because neither is visible in the
 * numbers. The counts are OPEN RFIs, so a title whose RFIs get resolved
 * quickly is undercounted against one whose RFIs sit. And `job_title` is free
 * text the employer typed: `COOK` and `Cook` are one title only because this
 * upper-cases them, while `Cook` and `Line Cook` stay two.
 */
export async function getRfiOccupations(): Promise<RfiOccupationCut | null> {
  const win = await one<Record<string, unknown>>(
    `WITH win AS (${RFI_WINDOW})
     SELECT win.lo AS lo, win.hi AS hi,
            COUNT(*) AS filed,
            SUM(CASE WHEN current_status = 'RFI ISSUED' THEN 1 ELSE 0 END) AS rfi
       FROM perm_case_status, win
      WHERE substr(filing_date, 1, 7) BETWEEN win.lo AND win.hi
        AND ${NOT_FIXTURE}`,
    [TEST_FIXTURE_EMPLOYER, TEST_FIXTURE_EMPLOYER],
  );
  const from = win?.lo == null ? null : String(win.lo);
  const to = win?.hi == null ? null : String(win.hi);
  const filed = Number(win?.filed) || 0;
  const rfi = Number(win?.rfi) || 0;
  if (!from || !to || filed <= 0 || rfi <= 0) return null;

  const r = await rows<Record<string, unknown>>(
    `WITH win AS (${RFI_WINDOW}),
     scoped AS (
       SELECT UPPER(TRIM(job_title)) AS title, employer_name,
              CASE WHEN current_status = 'RFI ISSUED' THEN 1 ELSE 0 END AS is_rfi
         FROM perm_case_status, win
        WHERE job_title IS NOT NULL AND TRIM(job_title) <> ''
          AND substr(filing_date, 1, 7) BETWEEN win.lo AND win.hi
          AND ${NOT_FIXTURE}
     ),
     agg AS (
       SELECT title,
              SUM(is_rfi) AS rfi,
              COUNT(DISTINCT CASE WHEN is_rfi = 1 THEN employer_name END) AS rfi_employers,
              COUNT(*) AS filed,
              COUNT(DISTINCT employer_name) AS filed_employers
         FROM scoped GROUP BY title
     )
     SELECT * FROM agg WHERE rfi >= ? ORDER BY CAST(rfi AS REAL) / filed DESC`,
    [TEST_FIXTURE_EMPLOYER, TEST_FIXTURE_EMPLOYER, MIN_RFI],
  );

  const kept: RfiOccupation[] = [];
  let withheld = 0;
  for (const x of r) {
    const rfiEmployers = Number(x.rfi_employers) || 0;
    const filedEmployers = Number(x.filed_employers) || 0;
    const titleFiled = Number(x.filed) || 0;
    if (titleFiled <= 0) continue;
    if (!occupationIsPublishable(rfiEmployers, filedEmployers)) {
      withheld += 1;
      continue;
    }
    const titleRfi = Number(x.rfi) || 0;
    kept.push({
      title: String(x.title),
      rfi: titleRfi,
      rfiEmployers,
      filed: titleFiled,
      filedEmployers,
      rate: (titleRfi / titleFiled) * 100,
      ci: wilsonInterval(titleRfi, titleFiled),
    });
  }
  return {
    from,
    to,
    filed,
    rfi,
    baseline: (rfi / filed) * 100,
    rows: kept,
    withheld,
  };
}
