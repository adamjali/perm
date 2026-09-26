import "server-only";

import { buildCaseEstimate } from "@/lib/caseEstimate";
import { caseEstimateInputs } from "@/lib/caseEstimateInputs";
import { estimatePwdQueue } from "@/lib/perm";
import {
  isGradedOutcome,
  summarise,
  type PredictionRow,
  type Source,
  type Summary,
} from "@/lib/scorecard/score";
import { exec, one, rows } from "@/lib/turso/client";
import { getDecisionPace } from "@/lib/turso/decisionPace";
import { getEstimatorData, getPwdEstimatorData } from "@/lib/turso/estimate";
import { getLiveBacklog } from "@/lib/turso/publicData";
import {
  ageByStatusFrom,
  exitMixFor,
  getStageStats,
  stageDurationFor,
} from "@/lib/turso/stageStats";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";

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
];

export async function ensurePredictionsTable(): Promise<void> {
  for (const sql of DDL) await exec(sql);
}

/** Cases per filing month, and how many recent months, in the daily PERM sample. */
export const PERM_PER_MONTH = 3;
export const PERM_MONTHS = 14;
export const PWD_PER_MONTH = 3;
export const PWD_MONTHS = 6;
/** Of the day's PERM sample, how many are also put to each rival. */
export const RIVAL_SAMPLE = 5;

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

async function samplePwd(months: string[]): Promise<SampledCase[]> {
  const out: SampledCase[] = [];
  for (const m of months) {
    const r = await rows<{ case_number: string; filing_date: string; employer_name: string | null }>(
      `SELECT case_number, filing_date, employer_name FROM pwd_case_status
        WHERE current_status = 'IN PROCESS' AND is_final = 0
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
  program: "perm" | "pwd";
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

/** Our own PERM and PWD predictions for today's sample, as the pages would show them. */
export async function predictOurs(today: string): Promise<{
  perm: NewPrediction[];
  pwd: NewPrediction[];
  sample: SampledCase[];
  /** Pending cases filed before a month, from the same census, for rival C's method. */
  pendingBefore: (month: string) => number;
}> {
  const [backlog, estimator, decisionPace, sweep, stageStats, pwdEst] = await Promise.all([
    getLiveBacklog(),
    getEstimatorData().catch(() => null),
    getDecisionPace().catch(() => null),
    getSweepCoverage().catch(() => null),
    getStageStats().catch(() => null),
    getPwdEstimatorData().catch(() => null),
  ]);

  const permMonths = backlog
    .filter((m) => (m.analystReview ?? 0) > 0)
    .map((m) => m.month)
    .sort()
    .slice(-PERM_MONTHS);
  const sample = await samplePerm(permMonths);

  const perm: NewPrediction[] = [];
  for (const c of sample) {
    const { casesAhead, sweepAgeDays } = caseEstimateInputs({
      backlog,
      filingDate: c.filingDate,
      sweepFinishedOn: sweep?.finishedOn ?? null,
      today,
    });
    const est = buildCaseEstimate({
      filingDate: c.filingDate,
      status: c.status,
      isFinal: false,
      estimator,
      casesAhead,
      decisionPace: decisionPace?.pace ?? null,
      sweepAgeDays,
      measuredStageAges: ageByStatusFrom(stageStats),
      stageExit: exitMixFor(stageStats, c.status),
      stageDuration: stageDurationFor(stageStats, c.status),
      today,
    });
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

  const pwd: NewPrediction[] = [];
  if (pwdEst && pwdEst.asOf && pwdEst.backlog.length > 0) {
    const pending = await rows<{ m: string }>(
      `SELECT DISTINCT substr(filing_date, 1, 7) AS m FROM pwd_case_status
        WHERE current_status = 'IN PROCESS' AND is_final = 0 AND filing_date IS NOT NULL
        ORDER BY m DESC LIMIT ?`,
      [PWD_MONTHS],
    );
    for (const c of await samplePwd(pending.map((r) => r.m))) {
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
        model: "pwd-queue",
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

export async function recordPredictions(recordedOn: string, preds: NewPrediction[]): Promise<number> {
  return insertPredictions(recordedOn, preds);
}

const ET = "America/New_York";
export const easternDate = (ms: number): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(ms),
  );

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
  for (const program of ["perm", "pwd"] as const) {
    const statusTable = program === "perm" ? "perm_case_status" : "pwd_case_status";
    const eventTable = program === "perm" ? "perm_case_events" : "pwd_case_events";
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
      for (const f of finals) {
        const ms = firstFinal.get(f.case_number);
        const decidedOn = Number.isFinite(ms)
          ? easternDate(ms!)
          : f.fetched_at
            ? easternDate(Date.parse(f.fetched_at))
            : null;
        graded += await exec(
          `UPDATE estimate_predictions SET decided_on = ?, outcome = ?, scored_at = ?
            WHERE program = ? AND case_number = ? AND outcome IS NULL`,
          [decidedOn, f.current_status, new Date().toISOString(), program, f.case_number],
        );
      }
    }
  }
  return { graded, open: open.length };
}

interface StoredRow {
  source: Source;
  program: "perm" | "pwd";
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
  const pub: ScorecardDoc = { perm: summarise(ours, today, "perm"), pwd: summarise(ours, today, "pwd"), recent };
  const priv = { perm: summarise(mapped, today, "perm") };
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
  /** Cases dated a week before the end, decided inside the printed range. */
  rangeCoverage?: { judged: number; insideShare: number | null };
  computedAt: number;
}

/** The weekly standing backtest (scripts/backtest_queue.py), one point read. */
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
