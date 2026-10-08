import "server-only";

import { estimatePwdDay, estimatePwdQueue } from "@/lib/perm";
import {
  headToHead,
  isGradedOutcome,
  PWD_DAY_MODEL,
  PWD_MODEL,
  type Cell,
  type Program,
  summarise,
  type PredictionRow,
  type Source,
  type Summary,
} from "@/lib/scorecard/score";
import { scorecardAlarms } from "@/lib/scorecard/alarms";
import type { BacktestRangeFields } from "@/lib/rangeCoverage";
import { parseSupplyDivision, readMethods, readOurs, readRival, readSupplyDivision } from "@/lib/scorecard/verdict";
import { SETTLED_BY_FILE_STATUSES } from "@/lib/seasonalDetails";
import { timingView } from "@/lib/seasonalTiming";
import { BULLETIN_FIRST_CAPTURES } from "@/lib/bulletinCaptures";
import { monthAfter, releaseEstimate } from "@/lib/bulletinReleaseEstimate";
import { getSeasonalCheck, getSeasonalTiming } from "@/lib/turso/seasonalTiming";
import { exec, one, rows } from "@/lib/turso/client";
import { getPwdEstimatorData } from "@/lib/turso/estimate";
import { getPwdDayData } from "@/lib/turso/pwdDayQueue";
import { DIRECT_EVENT_SOURCE } from "@/lib/turso/rfi";
import { rfiEnteredOn } from "@/lib/turso/rfiClock";
import { getH2bGroupTiming } from "@/lib/turso/h2bGroups";
import { pickGroup } from "@/lib/h2bGroups";
import { loadPermEstimateContext, estimatePermCase } from "@/lib/turso/permEstimate";
import { easternDay } from "@/lib/time";

/**
 * The automatic scorecard: record a day's predictions, grade the ones DOL has
 * since decided, and write the summary the pages read.
 *
 * EVERY "OURS" ROW IS WHAT THE CASE PAGE WOULD HAVE SHOWN THAT DAY. It goes
 * through `buildCaseEstimate` with inputs from `caseEstimateInputs`, the same
 * two calls the page makes, so the scorecard grades a number a reader could
 * actually have been given. PWD rows go through `estimatePwdQueue` with the
 * inputs `PwdStatusResult` uses.
 *
 * WRITTEN BEFORE THE OUTCOME. A row is inserted on the day it is predicted
 * and never edited afterwards except to add its outcome, so nothing here can
 * be tuned against results already known.
 *
 * Rows live in `estimate_predictions`; the grades land in the same row. The
 * pages read two precomputed docs (`scorecard_summary`, ours only, public;
 * `scorecard_rivals`, every source, admin only), never the table, so a page
 * render costs one point read however long this has been running.
 */

const DDL = [
  `CREATE TABLE IF NOT EXISTS estimate_predictions (
     id TEXT PRIMARY KEY,
     recorded_on TEXT NOT NULL,
     source TEXT NOT NULL,
     program TEXT NOT NULL,
     case_number TEXT NOT NULL,
     filing_date TEXT,
     status_at_record TEXT,
     stratum TEXT,
     model TEXT NOT NULL,
     predicted TEXT NOT NULL,
     band_early TEXT,
     band_late TEXT,
     cases_ahead INTEGER,
     decided_on TEXT,
     outcome TEXT,
     scored_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_ep_open ON estimate_predictions (outcome, program, case_number)`,
  // The seasonal sample records each application once; this answers "already
  // recorded?" without walking the table.
  `CREATE INDEX IF NOT EXISTS idx_ep_case ON estimate_predictions (case_number, program)`,
];

export async function ensurePredictionsTable(): Promise<void> {
  for (const sql of DDL) await exec(sql);
}

/** Cases per filing month, and how many recent months, in the daily PERM sample. */
export const PERM_PER_MONTH = 3;
export const PERM_MONTHS = 14;
/** RFI cases a day, from RFIs our sweep saw begin within the last RFI_RECENT_DAYS. */
export const RFI_PER_DAY = 6;
export const RFI_RECENT_DAYS = 35;
export const PWD_PER_MONTH = 3;
export const PWD_MONTHS = 6;
/**
 * H-2A, H-2B and CW-1: each application recorded ONCE, in its first week, as
 * the case page dated it that day. A timing panel describes a whole wait, so
 * the fair test is the date it gave near the start; sampling the same case
 * again as it aged would grade the cases still waiting over and over.
 */
export const SEASONAL_PER_FORM = 12;
export const SEASONAL_RECENT_DAYS = 7;
const SEASONAL_FORMS = ["H-300-", "H-400-", "C-500-"] as const;
/**
 * Of the day's PERM sample, how many are also put to each rival: all of them,
 * since Oct 3 2026, so every rival is graded on exactly our cases and the
 * head-to-head compares like with like. About 42 cases, two requests each,
 * spaced a second and a half apart: well under one request a second per host.
 */
export const RIVAL_SAMPLE = PERM_PER_MONTH * PERM_MONTHS;

export interface SampledCase {
  caseNumber: string;
  filingDate: string;
  employerName: string | null;
  status: string;
}

const monthEnd = (m: string): string => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
};

/**
 * A few random pending cases from each recent filing month.
 *
 * `ORDER BY random()` inside one month's analyst-review range reads that
 * month's rows off `case_status_stage` (status, is_final, filing_date) and
 * returns three; across 14 months that is roughly the pending queue in row
 * reads a day, which is small against the plan. Stratified by month so the
 * near horizon and the far one are both always represented.
 */
async function samplePerm(months: string[]): Promise<SampledCase[]> {
  const out: SampledCase[] = [];
  for (const m of months) {
    const r = await rows<{ case_number: string; filing_date: string; employer_name: string | null }>(
      `SELECT case_number, filing_date, employer_name FROM perm_case_status
        WHERE current_status = 'ANALYST REVIEW' AND is_final = 0
          AND filing_date >= ? AND filing_date < ?
        ORDER BY random() LIMIT ?`,
      [`${m}-01`, `${monthEnd(m)}-01`, PERM_PER_MONTH],
    );
    for (const x of r) {
      out.push({
        caseNumber: x.case_number,
        filingDate: x.filing_date,
        employerName: x.employer_name,
        status: "ANALYST REVIEW",
      });
    }
  }
  return out;
}

/**
 * The wage requests the case page dates: PERM's own (`PwdStatusResult` shows no
 * estimate for one DOL tags H-1B or E-3, because DOL's backlog figures are for
 * PERM requests). Sampling the others would grade a number nobody was shown.
 */
const PWD_DATED = "(visa_type IS NULL OR upper(visa_type) = 'PERM')";

async function samplePwd(months: string[]): Promise<SampledCase[]> {
  const out: SampledCase[] = [];
  for (const m of months) {
    const r = await rows<{ case_number: string; filing_date: string; employer_name: string | null }>(
      `SELECT case_number, filing_date, employer_name FROM pwd_case_status
        WHERE current_status = 'IN PROCESS' AND is_final = 0 AND ${PWD_DATED}
          AND filing_date >= ? AND filing_date < ?
        ORDER BY random() LIMIT ?`,
      [`${m}-01`, `${monthEnd(m)}-01`, PWD_PER_MONTH],
    );
    for (const x of r) {
      out.push({ caseNumber: x.case_number, filingDate: x.filing_date, employerName: x.employer_name, status: "IN PROCESS" });
    }
  }
  return out;
}

export interface NewPrediction {
  source: Source;
  program: Program;
  caseNumber: string;
  filingDate: string;
  status: string;
  model: string;
  predicted: string;
  bandEarly: string | null;
  bandLate: string | null;
  casesAhead: number | null;
}

async function insertPredictions(recordedOn: string, preds: NewPrediction[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < preds.length; i += 40) {
    const chunk = preds.slice(i, i + 40);
    const placeholders = chunk.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
    const args = chunk.flatMap((p) => [
      `${recordedOn}:${p.source}:${p.caseNumber}`,
      recordedOn,
      p.source,
      p.program,
      p.caseNumber,
      p.filingDate,
      p.status,
      p.filingDate.slice(0, 7),
      p.model,
      p.predicted,
      p.bandEarly,
      p.bandLate,
      p.casesAhead,
    ]);
    // OR IGNORE: a second run on the same day must not overwrite what was
    // recorded first, which is the whole point of recording before the outcome.
    written += await exec(
      `INSERT OR IGNORE INTO estimate_predictions
         (id, recorded_on, source, program, case_number, filing_date, status_at_record,
          stratum, model, predicted, band_early, band_late, cases_ahead)
       VALUES ${placeholders}`,
      args,
    );
  }
  return written;
}

const dayBefore = (day: string, n: number): string => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

/**
 * Today's H-2A, H-2B and CW-1 predictions: pending applications filed in the
 * last SEASONAL_RECENT_DAYS and never recorded, dated by `timingView` with the
 * inputs `SeasonalLookup` uses (the filing day, and the first day of work from
 * the SeasonalJobs posting or DOL's file), so each row is what the case page
 * showed that day.
 */
export async function predictSeasonal(recordedOn: string): Promise<NewPrediction[]> {
  const timing = await getSeasonalTiming().catch(() => null);
  if (!timing) return [];
  const since = dayBefore(recordedOn, SEASONAL_RECENT_DAYS);
  const picked: { case_number: string; filed: string }[] = [];
  for (const prefix of SEASONAL_FORMS) {
    const got = await rows<{ case_number: string; filed: string }>(
      `SELECT s.case_number, substr(COALESCE(s.submitted_date, s.filing_date), 1, 10) AS filed
         FROM seasonal_case_status s
        WHERE s.case_number >= ? AND s.case_number < ? AND s.is_final = 0
          AND substr(COALESCE(s.submitted_date, s.filing_date), 1, 10) >= ?
          AND NOT EXISTS (SELECT 1 FROM estimate_predictions e
                           WHERE e.case_number = s.case_number AND e.program = 'seasonal')
        ORDER BY random() LIMIT ?`,
      [prefix, `${prefix.slice(0, -1)}.`, since, SEASONAL_PER_FORM],
    ).catch(() => []);
    picked.push(...got);
  }
  if (picked.length === 0) return [];
  const nums = picked.map((p) => p.case_number);
  const marks = nums.map(() => "?").join(",");
  const [postings, records] = await Promise.all([
    rows<{ case_number: string; begin_date: string | null }>(
      `SELECT case_number, begin_date FROM seasonal_postings WHERE case_number IN (${marks})`,
      nums,
    ).catch(() => []),
    rows<{ case_number: string; begin_date: string | null }>(
      `SELECT case_number, begin_date FROM seasonal_cases WHERE case_number IN (${marks})`,
      nums,
    ).catch(() => []),
  ]);
  const begin = new Map<string, string>();
  // The page reads the posting first, then the published record.
  for (const r of records) if (r.begin_date) begin.set(r.case_number, r.begin_date.slice(0, 10));
  for (const r of postings) if (r.begin_date) begin.set(r.case_number, r.begin_date.slice(0, 10));
  // H-2B applications in DOL's assignment groups are dated by their group, as
  // the page dates them.
  const h2b = nums.filter((n) => n.startsWith("H-400-"));
  const [groupRows, groupTiming] = h2b.length
    ? await Promise.all([
        rows<{ case_number: string; peak: string; grp: string }>(
          `SELECT case_number, peak, grp FROM h2b_groups WHERE case_number IN (${h2b.map(() => "?").join(",")})`,
          h2b,
        ).catch(() => []),
        getH2bGroupTiming().catch(() => null),
      ])
    : [[], null];
  const groupOf = new Map(groupRows.map((r) => [r.case_number, r]));
  const out: NewPrediction[] = [];
  for (const c of picked) {
    const g = groupOf.get(c.case_number);
    // Filed in a season's first three days: DOL lists its group about five days
    // later, so wait for the list rather than record it by the season method.
    if (c.case_number.startsWith("H-400-") && !g && /-(01|07)-0[1-3]$/.test(c.filed)) continue;
    const view = timingView({
      caseNumber: c.case_number,
      filingDate: c.filed,
      firstDay: begin.get(c.case_number) ?? null,
      today: recordedOn,
      timing,
      group: g && groupTiming ? pickGroup(groupTiming, g.peak, g.grp) : null,
    });
    if (!view) continue;
    out.push({
      source: "ours",
      program: "seasonal",
      caseNumber: c.case_number,
      filingDate: c.filed,
      status: "pending",
      // "H-2B-filed-season": the visa, the clock, and whether one season's
      // figures were used, so a change of method shows in the split.
      model: view.group ? "H-2B-group" : `${view.visa}-${view.basis}${view.season ? "-season" : ""}`,
      predicted: view.typical,
      bandEarly: view.from,
      bandLate: view.to,
      casesAhead: null,
    });
  }
  return out;
}

/**
 * The coming bulletin's release day, recorded once, as the bulletin page
 * reads it, and only up to the start of its middle half: a record written
 * later would already know the bulletin hadn't come out by then.
 */
export async function predictBulletinRelease(recordedOn: string): Promise<NewPrediction[]> {
  const held = await one<{ m: string | null }>("SELECT MAX(bulletin_month) AS m FROM visa_bulletins").catch(() => null);
  if (!held?.m) return [];
  const bulletin = monthAfter(String(held.m));
  const est = releaseEstimate(bulletin, BULLETIN_FIRST_CAPTURES);
  if (!est || recordedOn > est.early) return [];
  return [
    {
      source: "ours",
      program: "bulletin",
      caseNumber: `bulletin:${bulletin}`,
      filingDate: recordedOn,
      status: "not yet published",
      model: "archive-capture-days",
      predicted: est.typical,
      bandEarly: est.early,
      bandLate: est.late,
      casesAhead: null,
    },
  ];
}

/** Our own PERM and PWD predictions for today's sample, as the pages would show them. */
export async function predictOurs(today: string): Promise<{
  perm: NewPrediction[];
  pwd: NewPrediction[];
  sample: SampledCase[];
  /** Pending cases filed before a month, from the same census, for rival C's method. */
  pendingBefore: (month: string) => number;
}> {
  const [ctx, pwdEst, pwdDay] = await Promise.all([
    loadPermEstimateContext(),
    getPwdEstimatorData().catch(() => null),
    getPwdDayData().catch(() => null),
  ]);
  const { backlog } = ctx;

  const permMonths = backlog
    .filter((m) => (m.analystReview ?? 0) > 0)
    .map((m) => m.month)
    .sort()
    .slice(-PERM_MONTHS);
  const sample = await samplePerm(permMonths);

  const perm: NewPrediction[] = [];
  for (const c of sample) {
    const { estimate: est, casesAhead } = estimatePermCase(ctx, c, today);
    if (!est || est.kind !== "date") continue;
    perm.push({
      source: "ours",
      program: "perm",
      caseNumber: c.caseNumber,
      filingDate: c.filingDate,
      status: c.status,
      model: est.modelId,
      predicted: est.estimatedDate,
      bandEarly: est.earliestDate,
      bandLate: est.latestDate,
      casesAhead,
    });
  }

  // RFI cases, dated from their own RFI day (the RFI clock): a few a day from
  // the RFIs our sweep saw begin in the last five weeks. Never put to a rival:
  // the rival sample is analyst-review cases only.
  if (ctx.rfiClock) {
    const since = Date.now() - RFI_RECENT_DAYS * 86_400_000;
    const rfiRows = await rows<{ case_number: string; at: number | string; filing_date: string | null }>(
      `SELECT e.case_number, MAX(e.changed_at) AS at, s.filing_date FROM perm_case_events e
         JOIN perm_case_status s ON s.case_number = e.case_number
        WHERE e.to_status = 'RFI ISSUED' AND e.from_status <> 'RFI ISSUED' AND e.source = ? AND e.changed_at >= ?
          AND s.current_status = 'RFI ISSUED' AND s.is_final = 0
        GROUP BY e.case_number ORDER BY random() LIMIT ?`,
      [DIRECT_EVENT_SOURCE, since, RFI_PER_DAY],
    ).catch(() => []);
    for (const x of rfiRows) {
      if (!x.filing_date) continue;
      const c = { filingDate: x.filing_date, status: "RFI ISSUED", rfiEnteredOn: easternDay(Number(x.at)) };
      const { estimate: est } = estimatePermCase(ctx, c, today);
      if (!est || est.kind !== "date" || est.modelId !== "rfi-clock") continue;
      perm.push({
        source: "ours", program: "perm", caseNumber: x.case_number, filingDate: x.filing_date, status: "RFI ISSUED",
        model: est.modelId, predicted: est.estimatedDate, bandEarly: est.earliestDate, bandLate: est.latestDate, casesAhead: null,
      });
    }
  }

  const pwd: NewPrediction[] = [];
  if (pwdEst && pwdEst.asOf && pwdEst.backlog.length > 0) {
    const pending = await rows<{ m: string }>(
      `SELECT DISTINCT substr(filing_date, 1, 7) AS m FROM pwd_case_status
        WHERE current_status = 'IN PROCESS' AND is_final = 0 AND filing_date IS NOT NULL AND ${PWD_DATED}
        ORDER BY m DESC LIMIT ?`,
      [PWD_MONTHS],
    );
    for (const c of await samplePwd(pending.map((r) => r.m))) {
      // THE DAY, when the page would show one: the same call PwdStatusResult makes.
      const d = pwdDay
        ? estimatePwdDay({ filingDate: c.filingDate.slice(0, 10), today, queue: pwdDay.queue, measuredRange: pwdDay.measuredRange })
        : null;
      if (d && d.kind === "estimate") {
        pwd.push({
          source: "ours",
          program: "pwd",
          caseNumber: c.caseNumber,
          filingDate: c.filingDate,
          status: c.status,
          model: PWD_DAY_MODEL,
          predicted: d.date,
          bandEarly: d.earliest,
          bandLate: d.latest,
          casesAhead: d.requestsAhead,
        });
        continue;
      }
      const q = estimatePwdQueue({
        requestMonth: c.filingDate.slice(0, 7),
        frontierMonth: pwdEst.frontier?.oewsMonth ?? null,
        backlog: pwdEst.backlog,
        asOf: pwdEst.asOf,
        clearancePerMonth: pwdEst.clearancePerMonth,
      });
      if (!q.estimatedMonth) continue;
      // The PWD estimate names a MONTH. It is graded against that month's
      // middle, with the month itself as the band.
      pwd.push({
        source: "ours",
        program: "pwd",
        caseNumber: c.caseNumber,
        filingDate: c.filingDate,
        status: c.status,
        model: PWD_MODEL,
        predicted: `${q.estimatedMonth}-15`,
        bandEarly: `${q.estimatedMonth}-01`,
        bandLate: new Date(Date.UTC(Number(q.estimatedMonth.slice(0, 4)), Number(q.estimatedMonth.slice(5, 7)), 0))
          .toISOString()
          .slice(0, 10),
        casesAhead: q.requestsAhead,
      });
    }
  }
  const pendingBefore = (month: string): number =>
    backlog.filter((m) => m.month < month).reduce((n, m) => n + m.pending, 0);
  return { perm, pwd, sample, pendingBefore };
}

/**
 * The date each subscriber's own case page showed, recorded ONCE per case: the
 * first day the scorecard sees it watched and still in line. The list is case
 * numbers only (perm_docs['watched_cases'], kept by
 * scripts/check_watched_cases.py from Convex's watched set), and the rows are
 * never put to a rival or shown by number: the public doc carries counts only.
 */
export async function predictWatched(today: string): Promise<NewPrediction[]> {
  const doc = await one<{ json: string }>(`SELECT json FROM perm_docs WHERE key = 'watched_cases'`).catch(() => null);
  let numbers: string[] = [];
  try {
    const d = doc ? (JSON.parse(String(doc.json)) as { caseNumbers?: unknown }) : null;
    if (Array.isArray(d?.caseNumbers)) numbers = d.caseNumbers.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
  if (numbers.length === 0) return [];
  const done = new Set(
    (await rows<{ case_number: string }>(`SELECT case_number FROM estimate_predictions WHERE source = 'watched'`))
      .map((r) => r.case_number),
  );
  const todo = numbers.filter((n) => !done.has(n));
  const permNums = todo.filter((n) => /^G-\d{3}-/.test(n));
  const pwdNums = todo.filter((n) => n.startsWith("P-100-"));
  const out: NewPrediction[] = [];
  const inChunks = async <T,>(nums: string[], sql: (ph: string) => string): Promise<T[]> => {
    const got: T[] = [];
    for (let i = 0; i < nums.length; i += 200) {
      const chunk = nums.slice(i, i + 200);
      got.push(...(await rows<T>(sql(chunk.map(() => "?").join(",")), chunk)));
    }
    return got;
  };
  if (permNums.length) {
    const ctx = await loadPermEstimateContext();
    const found = await inChunks<{ case_number: string; filing_date: string | null; employer_name: string | null; current_status: string }>(
      permNums,
      (ph) => `SELECT case_number, filing_date, employer_name, current_status FROM perm_case_status
                WHERE case_number IN (${ph}) AND current_status IN ('ANALYST REVIEW', 'RFI ISSUED') AND is_final = 0`,
    );
    for (const x of found) {
      if (!x.filing_date) continue;
      const status = x.current_status.trim().toUpperCase();
      const rfiEntered = status === "RFI ISSUED" ? await rfiEnteredOn(x.case_number).catch(() => null) : null;
      const c = { caseNumber: x.case_number, filingDate: x.filing_date, employerName: x.employer_name, status, rfiEnteredOn: rfiEntered };
      const { estimate: est, casesAhead } = estimatePermCase(ctx, c, today);
      if (!est || est.kind !== "date") continue;
      out.push({
        source: "watched", program: "perm", caseNumber: c.caseNumber, filingDate: c.filingDate, status: c.status,
        model: est.modelId, predicted: est.estimatedDate, bandEarly: est.earliestDate, bandLate: est.latestDate, casesAhead,
      });
    }
  }
  if (pwdNums.length) {
    const day = await getPwdDayData().catch(() => null);
    if (day) {
      const found = await inChunks<{ case_number: string; filing_date: string | null }>(
        pwdNums,
        (ph) => `SELECT case_number, filing_date FROM pwd_case_status
                  WHERE case_number IN (${ph}) AND current_status = 'IN PROCESS' AND is_final = 0 AND ${PWD_DATED}`,
      );
      for (const x of found) {
        if (!x.filing_date) continue;
        const d = estimatePwdDay({ filingDate: x.filing_date.slice(0, 10), today, queue: day.queue, measuredRange: day.measuredRange });
        if (d.kind !== "estimate") continue;
        out.push({
          source: "watched", program: "pwd", caseNumber: x.case_number, filingDate: x.filing_date, status: "IN PROCESS",
          model: PWD_DAY_MODEL, predicted: d.date, bandEarly: d.earliest, bandLate: d.latest, casesAhead: d.requestsAhead,
        });
      }
    }
  }
  return out;
}

export async function recordPredictions(recordedOn: string, preds: NewPrediction[]): Promise<number> {
  return insertPredictions(recordedOn, preds);
}

export const easternDate = (ms: number): string => easternDay(ms);

/**
 * Grade every open prediction whose case DOL has since finished.
 *
 * The decision day is the first final event the sweep logged for the case,
 * as an Eastern date, which is the same reading `/estimate-scorecard` has
 * always used. A final case with no event (it should not happen for a case
 * that was pending when sampled) falls back to the day its row last changed.
 */
export async function gradeOpenPredictions(): Promise<{ graded: number; open: number }> {
  const open = await rows<{ id: string; program: string; case_number: string }>(
    `SELECT id, program, case_number FROM estimate_predictions WHERE outcome IS NULL`,
  );
  let graded = 0;
  // A bulletin's release day: graded on the day this site first held it.
  for (const r of open.filter((x) => x.program === "bulletin")) {
    const month = r.case_number.replace(/^bulletin:/, "");
    const seen = await one<{ t: number | string }>(
      "SELECT first_seen_at AS t FROM bulletin_first_seen WHERE bulletin_month = ?",
      [month],
    ).catch(() => null);
    if (!seen) continue;
    graded += await exec(
      `UPDATE estimate_predictions SET decided_on = ?, outcome = 'PUBLISHED', scored_at = ? WHERE id = ? AND outcome IS NULL`,
      [easternDate(Number(seen.t)), new Date().toISOString(), r.id],
    );
  }
  const TABLES = {
    perm: ["perm_case_status", "perm_case_events"],
    pwd: ["pwd_case_status", "pwd_case_events"],
    seasonal: ["seasonal_case_status", "seasonal_case_events"],
  } as const;
  for (const program of ["perm", "pwd", "seasonal"] as const) {
    const [statusTable, eventTable] = TABLES[program];
    const nums = [...new Set(open.filter((r) => r.program === program).map((r) => r.case_number))];
    for (let i = 0; i < nums.length; i += 200) {
      const chunk = nums.slice(i, i + 200);
      const q = chunk.map(() => "?").join(",");
      const finals = await rows<{ case_number: string; current_status: string; fetched_at: string | null }>(
        `SELECT case_number, current_status, fetched_at FROM ${statusTable}
          WHERE case_number IN (${q}) AND is_final = 1`,
        chunk,
      );
      if (finals.length === 0) continue;
      const fq = finals.map(() => "?").join(",");
      const ev = await rows<{ case_number: string; t: number | string }>(
        `SELECT case_number, MIN(changed_at) AS t FROM ${eventTable}
          WHERE to_final = 1 AND case_number IN (${fq}) GROUP BY case_number`,
        finals.map((f) => f.case_number),
      );
      const firstFinal = new Map(ev.map((e) => [e.case_number, Number(e.t)]));
      // A seasonal case finished under a pending word (the sweep's
      // settled_by_file rule) has no final event: DOL's file holds its
      // decision, its date and its status.
      const published = new Map<string, { status: string; decided: string | null }>();
      if (program === "seasonal") {
        const pub = await rows<{ case_number: string; case_status: string; decision_date: string | null }>(
          `SELECT case_number, case_status, decision_date FROM seasonal_cases WHERE case_number IN (${fq})`,
          finals.map((f) => f.case_number),
        ).catch(() => []);
        for (const r of pub) published.set(r.case_number, { status: r.case_status, decided: r.decision_date });
      }
      for (const f of finals) {
        const ms = firstFinal.get(f.case_number);
        const filed = published.get(f.case_number);
        const settled = filed !== undefined && SETTLED_BY_FILE_STATUSES.has(f.current_status.trim().toUpperCase());
        const decidedOn = Number.isFinite(ms)
          ? easternDate(ms!)
          : filed?.decided
            ? filed.decided.slice(0, 10)
            : f.fetched_at
              ? easternDate(Date.parse(f.fetched_at))
              : null;
        graded += await exec(
          `UPDATE estimate_predictions SET decided_on = ?, outcome = ?, scored_at = ?
            WHERE program = ? AND case_number = ? AND outcome IS NULL`,
          [decidedOn, settled ? filed!.status : f.current_status, new Date().toISOString(), program, f.case_number],
        );
      }
    }
  }
  return { graded, open: open.length };
}

interface StoredRow {
  source: Source;
  program: Program;
  model: string;
  recorded_on: string;
  predicted: string;
  band_early: string | null;
  band_late: string | null;
  decided_on: string | null;
  outcome: string | null;
  case_number: string;
}

const toRow = (r: StoredRow): PredictionRow => ({
  source: r.source,
  program: r.program,
  model: r.model,
  recordedOn: r.recorded_on,
  predicted: r.predicted,
  bandEarly: r.band_early,
  bandLate: r.band_late,
  decidedOn: r.decided_on,
  outcome: r.outcome,
});

export interface ScorecardDoc {
  perm: Summary;
  pwd: Summary;
  /** H-2A, H-2B and CW-1, recorded once each in its first week (Oct 8 2026 on; older docs lack it). */
  seasonal?: Summary;
  /** The visa bulletin's release day, one per bulletin (Oct 8 2026 on). */
  bulletin?: Summary;
  /**
   * The dates subscribers' own case pages showed, one per case (Oct 8 2026 on).
   * Counts and errors only: no case number from this set is ever published.
   */
  watched?: { perm: Cell | null; pwd: Cell | null };
  /** A handful of the newest graded PERM cases, for the page's worked examples. */
  recent: {
    caseNumber: string;
    recordedOn: string;
    predicted: string;
    decidedOn: string;
    model: string;
    outcome: string;
  }[];
}

/** Recompute both docs from the table. Ours only in the public one. */
export async function writeScorecardDocs(today: string): Promise<{ rows: number }> {
  const all = await rows<StoredRow>(
    `SELECT source, program, model, recorded_on, predicted, band_early, band_late,
            decided_on, outcome, case_number FROM estimate_predictions`,
  );
  const mapped = all.map(toRow);
  const ours = mapped.filter((r) => r.source === "ours");
  const watchedRows = mapped.filter((r) => r.source === "watched");
  const recent = all
    .filter((r) => r.source === "ours" && r.program === "perm" && r.decided_on && isGradedOutcome(r.outcome))
    .sort((a, b) => (a.decided_on! < b.decided_on! ? 1 : -1))
    .slice(0, 8)
    .map((r) => ({
      caseNumber: r.case_number,
      recordedOn: r.recorded_on,
      predicted: r.predicted,
      decidedOn: r.decided_on!,
      model: r.model,
      outcome: r.outcome!,
    }));
  const pub: ScorecardDoc = {
    perm: summarise(ours, today, "perm"),
    pwd: summarise(ours, today, "pwd"),
    seasonal: summarise(ours, today, "seasonal"),
    bulletin: summarise(ours, today, "bulletin"),
    watched: {
      perm: summarise(watchedRows, today, "perm").bySource.watched?.all ?? null,
      pwd: summarise(watchedRows, today, "pwd").bySource.watched?.all ?? null,
    },
    recent,
  };
  const perm = summarise(mapped, today, "perm");
  // The same cases, ours against each rival: neither side scored on an easier sample.
  const h2h = headToHead(all.map((r) => ({ ...toRow(r), caseNumber: r.case_number })), today);
  const mine = perm.bySource.ours;
  const backtest = await getEstimatorBacktest().catch(() => null);
  const bulletinDoc = await one<{ json: string }>(
    `SELECT json FROM perm_docs WHERE key = 'bulletin_backtest'`,
  ).catch(() => null);
  const ages = await rows<{ key: string; computed_at: number | string }>(
    `SELECT key, computed_at FROM perm_docs WHERE key IN ('estimator_backtest', 'seasonal_backtest', 'pwd_backtest')`,
  ).catch(() => []);
  const ageOf = (key: string) => {
    const r = ages.find((a) => a.key === key);
    return r ? Number(r.computed_at) : null;
  };
  const alarms = scorecardAlarms(mapped, today, [
    { label: "The nightly PERM backtest", computedAt: ageOf("estimator_backtest"), everyDays: 1 },
    { label: "The weekly H-2A, H-2B and CW-1 backtest", computedAt: ageOf("seasonal_backtest") },
    { label: "The nightly wage-request backtest", computedAt: ageOf("pwd_backtest"), everyDays: 1 },
  ]);
  const priv = {
    perm,
    pwd: pub.pwd,
    seasonal: pub.seasonal,
    bulletin: pub.bulletin,
    seasonalChecks: await getSeasonalCheck().catch(() => null),
    alarms,
    headToHead: h2h,
    // The sentences every surface prints (scorecard/verdict.ts), stored so the
    // morning report, which is Python, quotes them instead of re-deriving them.
    readings: {
      ours: mine
        ? [...readOurs(mine.all, mine.byHorizon, perm.since, backtest), ...readMethods(mine.byModel)]
        : [],
      rivals: Object.entries(h2h).map(([src, h]) => readRival(src, h)),
      // Priority dates: our pace against dividing by yearly visas, on the same
      // dates (the weekly bulletin backtest).
      priorityDate: readSupplyDivision(parseSupplyDivision(bulletinDoc?.json ? String(bulletinDoc.json) : null)),
    },
  };
  const now = Date.now();
  await exec(
    `INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES ('scorecard_summary', ?, ?)`,
    [JSON.stringify(pub), now],
  );
  await exec(
    `INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES ('scorecard_rivals', ?, ?)`,
    [JSON.stringify(priv), now],
  );
  return { rows: all.length };
}

/** The public summary, one point read. Null until the first run has written it. */
export async function getScorecardSummary(): Promise<(ScorecardDoc & { computedAt: number }) | null> {
  const r = await one<{ json: string; computed_at: number | string }>(
    `SELECT json, computed_at FROM perm_docs WHERE key = 'scorecard_summary'`,
  );
  if (!r) return null;
  try {
    return { ...(JSON.parse(r.json) as ScorecardDoc), computedAt: Number(r.computed_at) };
  } catch {
    return null;
  }
}


export interface BacktestCell {
  cases: number;
  decided: number;
  typicalMissDays: number | null;
  biasDays: number | null;
  within7Share: number | null;
  decidedByEndRight: number | null;
}

export interface EstimatorBacktest {
  t0: string;
  end: string;
  pace: number;
  pendingAtT0: number;
  inLineAtT0: number;
  current: BacktestCell;
  allPending: BacktestCell;
  /** Cases dated a week before the end, decided inside the pace rule's range. */
  rangeCoverage?: { judged: number; insideShare: number | null };
  /** The measured ranges by distance and their out-of-sample test (src/lib/rangeCoverage.ts reads them). */
  rangeModel?: BacktestRangeFields["rangeModel"];
  servedRange?: BacktestRangeFields["servedRange"];
  computedAt: number;
}

/** The nightly standing backtest (scripts/backtest_queue.py), one point read. */
export async function getEstimatorBacktest(): Promise<EstimatorBacktest | null> {
  const r = await one<{ json: string; computed_at: number | string }>(
    `SELECT json, computed_at FROM perm_docs WHERE key = 'estimator_backtest'`,
  );
  if (!r) return null;
  try {
    return { ...(JSON.parse(r.json) as Omit<EstimatorBacktest, "computedAt">), computedAt: Number(r.computed_at) };
  } catch {
    return null;
  }
}
