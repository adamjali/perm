import "server-only";

import { cache } from "react";

import type { DecidedSpan } from "@/lib/board";
import {
  I140_PREP_DAYS_ASSUMED,
  monthsToDays,
  paceByLine,
  RECRUITMENT_MIN_DAYS,
  type PlanFigures,
  type PlanStage,
  type SideStage,
  type Span,
} from "@/lib/perm";
import { getI140ProcessingTime, PROCESSING_TIMES_AS_OF } from "@/lib/processing-times/i140ProcessingTimes";
import { quarterLabel } from "@/lib/uscisQuarterlyShape";
import { shortDate } from "@convex/lib/months";
import { MS_PER_DAY } from "@convex/lib/time";

import { getPermBoard, getPwdBoard } from "./board";
import { getBulletinBoard } from "./bulletin";
import { getRecruitmentSummary } from "./recruitment";
import { getUscisFormHistory, type UscisFormHistoryPoint } from "./uscisQuarterly";

/** The categories the planner plans for, and the I-140 class each files under after a PERM. */
const PLAN_I140_CLASS = { EB2: "E21", EB3: "E31" } as const;
/** The four newest quarters set each USCIS step's quick and slow ends. */
const QUARTERS_FOR_RANGE = 4;

/** The USCIS rows each step reads, by form and the words in the row's title. */
const USCIS_ROWS = {
  i140: { form: "I-140", title: "Immigrant Petition for Alien Workers" },
  i485: { form: "I-485", title: "(Employment)" },
  ead: { form: "I-765", title: "Adjustment Of Status" },
  ap: { form: "I-131", title: "Advance Parole Document for Aliens Inside the United States" },
} as const;

export type PlanSpans = PlanFigures["spans"];

/** The figures the plan starts from, before any of the reader's own. */
export type PlanBase = Omit<PlanFigures, "permByQueue" | "pwdByQueue" | "missMonthsAt" | "supply" | "bulletinMethod" | "paceDaysPerMonth">;

export interface PlanReading {
  figures: PlanBase;
  /** Where each step stands today, one short line each. */
  standing: Partial<Record<PlanStage | SideStage, string>>;
  /** What each step's three lengths rest on, one short line each. */
  sources: Partial<Record<PlanStage | SideStage, string>>;
}

/**
 * How long a step at DOL takes now, from the filing days it decided on its last working day:
 * the latest-filed tenth waited least, the middle typically, the earliest-filed tenth most.
 */
export function waitSpanOf(span: DecidedSpan | null, decidedOn: string): Span | null {
  if (!span) return null;
  const days = (filed: string) => Math.round((Date.parse(`${decidedOn}T12:00:00Z`) - Date.parse(`${filed}T12:00:00Z`)) / MS_PER_DAY);
  const s = { low: days(span.to), mid: days(span.middle), high: days(span.from) };
  return [s.low, s.mid, s.high].every((n) => Number.isFinite(n) && n >= 0) ? s : null;
}

/**
 * A USCIS step from its row's newest medians: the newest typical, the quickest and slowest of the
 * last four quarters at the ends, widened to the class's 80% figure when one is given.
 */
export function uscisSpanOf(points: readonly UscisFormHistoryPoint[], title: string, eightyMonths?: number): Span | null {
  const rows = points.filter((p) => p.title.includes(title) && p.medianMonths !== null && p.medianMonths > 0);
  const recent = rows.slice(-QUARTERS_FOR_RANGE).map((p) => p.medianMonths as number);
  const newest = recent[recent.length - 1];
  if (newest === undefined) return null;
  const ends = eightyMonths ? [...recent, eightyMonths] : recent;
  return { low: monthsToDays(Math.min(...ends)), mid: monthsToDays(newest), high: monthsToDays(Math.max(...ends)) };
}

const quarterOf = (points: readonly UscisFormHistoryPoint[], title: string): string | null => {
  const rows = points.filter((p) => p.title.includes(title) && p.medianMonths !== null);
  const last = rows[rows.length - 1];
  return last ? quarterLabel(last.fy, last.quarter) : null;
};

/**
 * The planner's figures, read once per render from the readers the board and the case pages use,
 * so the planner can't print a length the rest of the site doesn't. A source that fails leaves its
 * step undated rather than failing the page.
 */
export const getPlanReading = cache(async (): Promise<PlanReading> => {
  const [perm, pwd, board, recruitment, i140, i485, i765, i131] = await Promise.all([
    getPermBoard().catch(() => null),
    getPwdBoard().catch(() => null),
    getBulletinBoard().catch(() => null),
    getRecruitmentSummary().catch(() => null),
    getUscisFormHistory(USCIS_ROWS.i140.form),
    getUscisFormHistory(USCIS_ROWS.i485.form),
    getUscisFormHistory(USCIS_ROWS.ead.form),
    getUscisFormHistory(USCIS_ROWS.ap.form),
  ]);

  const lead = recruitment?.lead.firstStep ?? null;
  const eighty = (cat: keyof typeof PLAN_I140_CLASS) =>
    getI140ProcessingTime(cat === "EB2" ? "EB-2" : "EB-3")?.subtypes.find((s) => s.code === PLAN_I140_CLASS[cat])?.months80;

  const figures: PlanBase = {
    spans: {
      pwd: pwd?.span ? waitSpanOf(pwd.span, pwd.day) : null,
      // DOL's own record: first recruitment step to filing, never under the rules' minimum.
      recruitment: lead
        ? { low: Math.max(lead.p10, RECRUITMENT_MIN_DAYS), mid: Math.max(lead.p50, RECRUITMENT_MIN_DAYS), high: Math.max(lead.p90, RECRUITMENT_MIN_DAYS) }
        : { low: RECRUITMENT_MIN_DAYS, mid: RECRUITMENT_MIN_DAYS, high: RECRUITMENT_MIN_DAYS },
      perm: perm?.span ? waitSpanOf(perm.span, perm.day) : null,
      i140Prep: { low: I140_PREP_DAYS_ASSUMED, mid: I140_PREP_DAYS_ASSUMED, high: I140_PREP_DAYS_ASSUMED },
      i140: {
        EB2: uscisSpanOf(i140, USCIS_ROWS.i140.title, eighty("EB2")),
        EB3: uscisSpanOf(i140, USCIS_ROWS.i140.title, eighty("EB3")),
      },
      i485: uscisSpanOf(i485, USCIS_ROWS.i485.title),
      ead: uscisSpanOf(i765, USCIS_ROWS.ead.title),
      ap: uscisSpanOf(i131, USCIS_ROWS.ap.title),
    },
    pace: paceByLine(board?.finalAction ?? [], (c) => (c.category in PLAN_I140_CLASS ? `${c.category}|${c.country}` : null)),
    bulletinMonth: board?.lastMonth ?? null,
  };

  const standing: PlanReading["standing"] = {};
  if (pwd?.span) standing.pwd = `Now: DOL is deciding wage requests filed around ${shortDate(pwd.span.middle)}`;
  if (perm?.span) standing.perm = `Now: DOL is deciding PERM cases filed around ${shortDate(perm.span.middle)}`;
  const median = (points: readonly UscisFormHistoryPoint[], title: string) => {
    const rows = points.filter((p) => p.title.includes(title) && p.medianMonths !== null);
    return rows[rows.length - 1]?.medianMonths ?? null;
  };
  for (const [key, rows] of [["i140", i140], ["i485", i485], ["ead", i765], ["ap", i131]] as const) {
    const m = median(rows, USCIS_ROWS[key].title);
    const q = quarterOf(rows, USCIS_ROWS[key].title);
    if (m !== null && q) standing[key] = `Now: USCIS's median is ${m} months, ${q}`;
  }

  const sources: PlanReading["sources"] = {
    pwd: "The filing days DOL decided on its last working day: the latest-filed tenth, the middle, the earliest-filed tenth",
    perm: "The filing days DOL decided on its last working day: the latest-filed tenth, the middle, the earliest-filed tenth",
    recruitment: lead
      ? `DOL's record of ${lead.n.toLocaleString("en-US")} cases: first recruitment step to filing, the 10th, 50th and 90th percentile`
      : "The shortest the rules allow: a 30-day job order, then 30 days before filing",
    i140Prep: "An assumption, not measured: set it to your attorney's plan, inside the 180 days",
    i140: `USCIS's newest quarterly median, between the quickest and slowest of the last four quarters and its 80% figure (read ${PROCESSING_TIMES_AS_OF})`,
    i485: "USCIS's employment-based median, the newest quarter between the quickest and slowest of the last four",
    ead: "USCIS's work-permit median for a pending I-485, the last four quarters",
    ap: "USCIS's advance-parole median inside the US, the last four quarters",
  };
  return { figures, standing, sources };
});
