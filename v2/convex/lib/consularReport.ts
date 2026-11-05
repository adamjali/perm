/**
 * Consulate reports: what happened at a US consulate's visa interview (or drop box appointment), as the
 * person waiting reports it. The rules live here, pure, so the Convex functions, the HTTP layer, the form on
 * each consulate's page and the figures above it read one definition (the same arrangement as
 * `communityTimeline.ts`).
 *
 * WHY. State publishes two things about a post: its monthly scheduling table (the month of documentarily
 * complete cases NVC is scheduling) and its immigrant visa issuances, months late. Neither says what
 * happened at an interview last week, so these figures come from the people who went. They're
 * self-reported, and every surface says so: they're never State's data and never blended into State's.
 *
 * WHAT A REPORT HOLDS (owner, Nov 5 2026): the fields a nonimmigrant stamping tracker collects (the visa, an
 * interview or a drop box, approved at the window, a 221(g) and its slip colour, asked to email documents,
 * the passport back), so this site's own reports can stand in for that tracker's, plus the green card
 * fields (NVC's complete month, the interview letter, the visa issued).
 *
 * NO FREE TEXT, NO NAME, NO CASE NUMBER, on purpose. Every field is a date, a month or a choice from a fixed
 * list, so nothing a stranger types can reach a public page, and a report can't be traced to a case. A
 * tracker's notes box is the one field deliberately left out.
 *
 * THE FLOOR. A figure prints only over at least MIN_REPORTS reports (the timelines' floor of three). Below
 * it, a cell is one or two people's outcomes, readable by anyone who knows they reported.
 */

import { MIN_CASE_REPORTERS } from "./communityTimeline";
import { MS_PER_DAY } from "./time";

/**
 * The kind of visa. Every kind, because everyone goes through the same posts and one person's report tells
 * every applicant there whether the post is moving (owner, Nov 5 2026); employment and the work visas come
 * first, which is the order every list and breakdown uses.
 *
 * `group` decides which questions apply: NVC's month to an immigrant visa (and the K-1, which NVC also
 * handles), the drop box, the 221(g) slip and the emailed documents to a nonimmigrant visa. "Another visa"
 * can be either, so both kinds of question are open to it. `section` is the form's grouping.
 */
export const REPORT_CATEGORIES = [
  { id: "employment", label: "Employment green card", group: "immigrant", section: "work" },
  { id: "h1b", label: "H-1B", group: "nonimmigrant", section: "work" },
  { id: "h4", label: "H-4", group: "nonimmigrant", section: "work" },
  { id: "l1", label: "L-1", group: "nonimmigrant", section: "work" },
  { id: "l2", label: "L-2", group: "nonimmigrant", section: "work" },
  { id: "family", label: "Family preference", group: "immigrant", section: "family" },
  { id: "immediate", label: "Immediate relative", group: "immigrant", section: "family" },
  { id: "k1", label: "K-1 fiancé(e)", group: "immigrant", section: "family" },
  { id: "f1", label: "F-1 student", group: "nonimmigrant", section: "study" },
  { id: "b1b2", label: "B-1/B-2 visitor", group: "nonimmigrant", section: "study" },
  { id: "other", label: "Another visa", group: "either", section: "other" },
] as const;

/** The form's groups of visas, in order. */
export const REPORT_SECTIONS = [
  { id: "work", label: "Work visas and employment green cards" },
  { id: "family", label: "Family and fiancé(e)" },
  { id: "study", label: "Study and visit" },
  { id: "other", label: "Anything else" },
] as const;
export type ReportCategoryId = (typeof REPORT_CATEGORIES)[number]["id"];

/** NVC's month applies: an immigrant visa, a K-1, or another visa. */
export function takesNvc(category: string | null | undefined): boolean {
  const c = REPORT_CATEGORIES.find((x) => x.id === category);
  return c !== undefined && c.group !== "nonimmigrant";
}
/** The drop box, the 221(g) slip and the emailed documents apply: a nonimmigrant visa, or another visa. */
export function takesNonimmigrant(category: string | null | undefined): boolean {
  const c = REPORT_CATEGORIES.find((x) => x.id === category);
  return c !== undefined && c.group !== "immigrant";
}

/**
 * What happened. A 221(g) stays a 221(g) once cleared: the day it cleared is `resolvedOn`, so the share
 * that ended in 221(g) still counts it.
 */
export const REPORT_OUTCOMES = [
  { id: "waiting", label: "No result yet" },
  { id: "approved", label: "Approved, visa not printed yet" },
  { id: "issued", label: "Visa issued" },
  { id: "passport-returned", label: "Passport back with the visa" },
  { id: "221g", label: "221(g), more processing" },
  { id: "refused", label: "Refused" },
  { id: "cancelled", label: "Interview cancelled" },
  { id: "rescheduled", label: "Interview rescheduled" },
] as const;
export type ReportOutcomeId = (typeof REPORT_OUTCOMES)[number]["id"];

export const REFUSAL_GROUNDS = [
  { id: "214b", label: "214(b)" },
  { id: "public-charge", label: "Public charge" },
  { id: "other", label: "Another ground" },
] as const;
export type RefusalGroundId = (typeof REFUSAL_GROUNDS)[number]["id"];

export const REPORT_MODES = [
  { id: "interview", label: "Interview" },
  { id: "dropbox", label: "Drop box, no interview" },
] as const;
export type ReportModeId = (typeof REPORT_MODES)[number]["id"];

/** The colour of the 221(g) slip the officer handed back. */
export const SLIP_COLORS = [
  { id: "white", label: "White" },
  { id: "yellow", label: "Yellow" },
  { id: "pink", label: "Pink" },
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "unsure", label: "Not sure" },
] as const;
export type SlipColorId = (typeof SLIP_COLORS)[number]["id"];

export const YES_NO_UNSURE = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "unsure", label: "Not sure" },
] as const;
export type YesNoUnsureId = (typeof YES_NO_UNSURE)[number]["id"];

/** A consulate page's address segment (src/lib/consular/scheduling.ts `postSlug`). */
export const POST_SLUG = /^[a-z0-9-]{2,60}$/;

/** Every figure prints only over at least this many reports: the timelines' floor. */
export const MIN_REPORTS = MIN_CASE_REPORTERS;

/** The label every figure built from these reports carries. */
export const SELF_REPORTED = "Visitors' own reports, unchecked";

/** The two windows the figures count. */
export const REPORT_WINDOWS = [30, 90] as const;
/** Weeks of interviews the chart draws, the newest holding today. */
export const REPORT_WEEKS = 12;
/** The NVC-to-interview median, and the interview-to-visa median, read interviews in this many days. */
export const WAIT_WINDOW_DAYS = 180;
/** The share that ended in 221(g) reads results in this many days. */
export const RESULT_WINDOW_DAYS = 90;

/** The earliest date or month a report may carry. */
const FLOOR = "2020-01-01";
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

/** What the form sends; every field optional, the server says what's missing. */
export interface ReportInput {
  post?: string | null;
  category?: string | null;
  mode?: string | null;
  nvcCompleteMonth?: string | null;
  scheduledOn?: string | null;
  interviewOn?: string | null;
  outcome?: string | null;
  refusalGround?: string | null;
  approvedOn?: string | null;
  resolvedOn?: string | null;
  slipColor?: string | null;
  askedToEmailDocs?: string | null;
}

/** A checked report: the post, the category and the outcome always, the rest when given. */
export interface ReportFields {
  post: string;
  category: ReportCategoryId;
  outcome: ReportOutcomeId;
  mode?: ReportModeId;
  nvcCompleteMonth?: string;
  scheduledOn?: string;
  interviewOn?: string;
  refusalGround?: RefusalGroundId;
  approvedOn?: string;
  resolvedOn?: string;
  slipColor?: SlipColorId;
  askedToEmailDocs?: YesNoUnsureId;
}

/** The fields a save writes beyond the post, each one written so an edit can clear it. */
export const REPORT_FIELD_KEYS = [
  "category",
  "outcome",
  "mode",
  "nvcCompleteMonth",
  "scheduledOn",
  "interviewOn",
  "refusalGround",
  "approvedOn",
  "resolvedOn",
  "slipColor",
  "askedToEmailDocs",
] as const;

export type ReportProblem =
  | "post"
  | "category"
  | "outcome"
  | "choice"
  | "date"
  | "no-dates"
  | "refusal-ground"
  | "approved"
  | "resolved"
  | "nvc"
  | "nonimmigrant"
  | "221g-detail"
  | "order";

export type ReportCheck = { ok: true; value: ReportFields } | { ok: false; code: ReportProblem; message: string };

/** "YYYY-MM-DD", UTC. */
export function isoToday(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** An ISO day moved by whole days. */
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * The latest day a report may carry: tomorrow in UTC. Most people reporting are abroad, and in Manila or
 * Auckland it's already tomorrow for hours of every UTC day, so "not in the future" has to allow one day.
 */
export function latestAllowedDay(today: string = isoToday()): string {
  return addDays(today, 1);
}

const blank = (raw: unknown) => raw === undefined || raw === null || raw === "";

function pick<T extends { id: string }>(list: readonly T[], raw: unknown): T["id"] | undefined | null {
  if (blank(raw)) return undefined;
  if (typeof raw !== "string" || raw.length > 24) return null;
  const hit = list.find((x) => x.id === raw);
  return hit ? hit.id : null;
}

function day(raw: unknown, latest: string): string | undefined | null {
  if (blank(raw)) return undefined;
  if (typeof raw !== "string" || !ISO_DAY.test(raw)) return null;
  // Date.parse rolls "2026-02-30" into March, so the day must print back as itself.
  const ms = Date.parse(`${raw}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== raw) return null;
  return raw < FLOOR || raw > latest ? null : raw;
}

function month(raw: unknown, latest: string): string | undefined | null {
  if (blank(raw)) return undefined;
  if (typeof raw !== "string" || !ISO_MONTH.test(raw)) return null;
  const m = Number(raw.slice(5, 7));
  if (m < 1 || m > 12) return null;
  return raw < FLOOR.slice(0, 7) || raw > latest.slice(0, 7) ? null : raw;
}

const DATE_MESSAGE = "Enter each date from 2020 on, and only dates that have happened.";

/** Outcomes that carry an approval day. */
export const APPROVED_OUTCOMES: ReadonlySet<string> = new Set(["approved", "issued", "passport-returned"]);
/** Outcomes that carry the day the visa was issued, the passport came back, or the 221(g) cleared. */
export const RESOLVED_OUTCOMES: ReadonlySet<string> = new Set(["issued", "passport-returned", "221g"]);

/**
 * Check a report field by field. The post, the category and the outcome are required, and at least one
 * date: a report with no date says nothing about when. A question that doesn't apply is refused rather than
 * quietly dropped (NVC's month on an H-1B, a slip colour without a 221(g)), because the figures would print
 * it as fact. Order is checked where it can't be otherwise: the letter before the interview, NVC's month
 * before both, then the approval, then the visa or the cleared 221(g).
 */
export function validateReport(input: ReportInput, today: string = isoToday()): ReportCheck {
  const latest = latestAllowedDay(today);
  const post = typeof input.post === "string" ? input.post : "";
  if (!POST_SLUG.test(post)) return { ok: false, code: "post", message: "That isn't a consulate this site lists." };

  const category = pick(REPORT_CATEGORIES, input.category);
  if (category === undefined) return { ok: false, code: "category", message: "Choose the kind of visa." };
  if (category === null) return { ok: false, code: "choice", message: "That kind of visa isn't one this form records." };
  const outcome = pick(REPORT_OUTCOMES, input.outcome);
  if (outcome === undefined) return { ok: false, code: "outcome", message: "Choose what happened, or No result yet." };
  if (outcome === null) return { ok: false, code: "choice", message: "That outcome isn't one this form records." };
  const choices = {
    mode: pick(REPORT_MODES, input.mode),
    refusalGround: pick(REFUSAL_GROUNDS, input.refusalGround),
    slipColor: pick(SLIP_COLORS, input.slipColor),
    askedToEmailDocs: pick(YES_NO_UNSURE, input.askedToEmailDocs),
  };
  if (Object.values(choices).some((x) => x === null)) {
    return { ok: false, code: "choice", message: "One of the answers isn't one this form records." };
  }
  const { mode, refusalGround, slipColor, askedToEmailDocs } = choices;

  const nvcCompleteMonth = month(input.nvcCompleteMonth, latest);
  const scheduledOn = day(input.scheduledOn, latest);
  const interviewOn = day(input.interviewOn, latest);
  const approvedOn = day(input.approvedOn, latest);
  const resolvedOn = day(input.resolvedOn, latest);
  if ([nvcCompleteMonth, scheduledOn, interviewOn, approvedOn, resolvedOn].some((x) => x === null)) {
    return { ok: false, code: "date", message: DATE_MESSAGE };
  }
  if (!nvcCompleteMonth && !scheduledOn && !interviewOn) {
    return {
      ok: false,
      code: "no-dates",
      message: "Add at least one date: when NVC said the case was complete, the appointment letter, or the interview.",
    };
  }

  if (nvcCompleteMonth && !takesNvc(category)) {
    return { ok: false, code: "nvc", message: "NVC's month goes with an immigrant visa or a K-1." };
  }
  if ((mode || slipColor || askedToEmailDocs) && !takesNonimmigrant(category)) {
    return { ok: false, code: "nonimmigrant", message: "The drop box and the 221(g) slip go with a nonimmigrant visa." };
  }
  if ((slipColor || askedToEmailDocs) && outcome !== "221g") {
    return { ok: false, code: "221g-detail", message: "The slip colour and the emailed documents go with a 221(g)." };
  }
  if (refusalGround && outcome !== "refused") {
    return { ok: false, code: "refusal-ground", message: "A refusal ground goes with a refusal only." };
  }
  if (approvedOn && !APPROVED_OUTCOMES.has(outcome)) {
    return { ok: false, code: "approved", message: "The approval day goes with an approved or issued visa." };
  }
  if (resolvedOn && !RESOLVED_OUTCOMES.has(outcome)) {
    return {
      ok: false,
      code: "resolved",
      message: "The day a visa was issued goes with an issued visa, a passport back, or a cleared 221(g).",
    };
  }

  // Each step no earlier than the one before it.
  const steps: [string | undefined, string][] = [
    [scheduledOn ?? undefined, "the letter"],
    [interviewOn ?? undefined, "the interview"],
    [approvedOn ?? undefined, "the approval"],
    [resolvedOn ?? undefined, "the visa or the cleared 221(g)"],
  ];
  let last: [string, string] | null = null;
  for (const [d, what] of steps) {
    if (d === undefined) continue;
    if (last && d < last[0]) {
      return { ok: false, code: "order", message: `${capital(what)} is dated before ${last[1]}.` };
    }
    last = [d, what];
  }
  const firstDay = scheduledOn ?? interviewOn;
  if (nvcCompleteMonth && firstDay && firstDay.slice(0, 7) < nvcCompleteMonth) {
    return { ok: false, code: "order", message: "The letter or the interview is dated before NVC said the case was complete." };
  }

  const value: ReportFields = { post, category, outcome };
  if (mode) value.mode = mode;
  if (nvcCompleteMonth) value.nvcCompleteMonth = nvcCompleteMonth;
  if (scheduledOn) value.scheduledOn = scheduledOn;
  if (interviewOn) value.interviewOn = interviewOn;
  if (refusalGround) value.refusalGround = refusalGround;
  if (approvedOn) value.approvedOn = approvedOn;
  if (resolvedOn) value.resolvedOn = resolvedOn;
  if (slipColor) value.slipColor = slipColor;
  if (askedToEmailDocs) value.askedToEmailDocs = askedToEmailDocs;
  return { ok: true, value };
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A stored report, as the figures read it. */
export interface ReportRecord extends ReportFields {
  createdAt: number;
  updatedAt: number;
  hidden?: boolean;
}

/** The appointment took place (or is waiting on its result): not cancelled, not moved. */
function appeared(r: ReportRecord): boolean {
  return r.interviewOn !== undefined && r.outcome !== "cancelled" && r.outcome !== "rescheduled";
}

/** An interview was held: the appointment took place, and it wasn't a drop box. */
export function heldInterview(r: ReportRecord): boolean {
  return appeared(r) && r.mode !== "dropbox";
}

/** A result came out of the interview. */
const DECIDED: ReadonlySet<ReportOutcomeId> = new Set(["approved", "issued", "passport-returned", "221g", "refused"]);

/**
 * The day a report speaks for: its newest date (the visa, the approval, the interview, the letter), or the
 * day it was last saved when it holds only NVC's month. An interview from 2022 reported today is old news,
 * not this month's, so the windows count it by its own date.
 */
export function activityDay(r: ReportRecord): string {
  const dates = [r.resolvedOn, r.approvedOn, r.interviewOn, r.scheduledOn].filter((d): d is string => typeof d === "string");
  return dates.length ? dates.sort()[dates.length - 1]! : isoToday(r.updatedAt);
}

/** Whole days from `a` to `b`, both ISO days. */
function daysFrom(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_PER_DAY);
}

/**
 * Days from NVC's complete month to the interview, counted from the middle of that month (the month alone
 * can't say which day; the middle is wrong by at most half a month either way). Null when either is
 * missing, the interview didn't happen, or the wait comes out negative.
 */
export function waitDays(r: ReportRecord): number | null {
  if (!r.nvcCompleteMonth || !heldInterview(r)) return null;
  const d = daysFrom(`${r.nvcCompleteMonth}-15`, r.interviewOn!);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

/**
 * Where a report stands after its interview or drop box: finished (approved, issued, the passport back, or a
 * 221(g) cleared), still waiting (no result yet, or a 221(g) not cleared), or neither (refused, cancelled,
 * moved, or no appointment day given).
 */
export function afterAppointment(r: ReportRecord): { finishedInDays: number } | "waiting" | null {
  if (!appeared(r)) return null;
  const end =
    r.outcome === "221g" ? r.resolvedOn : APPROVED_OUTCOMES.has(r.outcome) ? (r.approvedOn ?? r.resolvedOn) : undefined;
  if (end) {
    const d = daysFrom(r.interviewOn!, end);
    return Number.isFinite(d) && d >= 0 ? { finishedInDays: d } : null;
  }
  if (r.outcome === "waiting" || r.outcome === "221g") return "waiting";
  return null;
}

/** The Mondays that start the last `n` weeks, oldest first, the newest holding `today`. */
export function weekStarts(today: string, n: number = REPORT_WEEKS): string[] {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 is Sunday
  const monday = addDays(today, -((dow + 6) % 7));
  return Array.from({ length: n }, (_, i) => addDays(monday, -7 * (n - 1 - i)));
}

/** Nearest-rank median over a list; the timelines' rule. */
function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.5 * sorted.length) - 1))]!;
}

export interface ReportCount {
  id: string;
  label: string;
  count: number;
}
export interface ReportWindow {
  days: number;
  /** Every report the window holds: a number of reports says nothing about anyone. */
  total: number;
  /** The breakdown prints only from MIN_REPORTS. */
  open: boolean;
  byOutcome: ReportCount[];
}
/**
 * After the interview or drop box: how many finished and how many still wait, over appointments in the last
 * WAIT_WINDOW_DAYS. The pair shows from MIN_REPORTS appointments, and the median only from MIN_REPORTS
 * finished, so a median of the finished never prints without the count still waiting beside it.
 */
export interface AfterView {
  finished: number | null;
  waiting: number | null;
  median: number | null;
}
export interface ReportCategoryCell {
  id: ReportCategoryId;
  label: string;
  /** Reports in the last 90 days; null under the floor. */
  count: number | null;
  open: boolean;
  byOutcome: ReportCount[];
  /** The NVC-to-interview median for this category; null under the floor. */
  waitMedian: number | null;
  after: AfterView;
}
export interface ReportWeek {
  /** The Monday the week starts. */
  start: string;
  /** Interviews held that week; null under the floor. */
  count: number | null;
  /** The week holds today, so it's still filling. */
  partial: boolean;
}
export interface ReportView {
  total: number;
  windows: ReportWindow[];
  categories: ReportCategoryCell[];
  weeks: ReportWeek[];
  /** Interviews with a result in the last RESULT_WINDOW_DAYS, and how many were a 221(g); null under the floor. */
  results: { days: number; n: number | null; g221: number | null; share: number | null };
  /** NVC's month to the interview, over interviews held in the last WAIT_WINDOW_DAYS; null under the floor. */
  wait: { days: number; n: number | null; median: number | null };
}

const floor = (n: number) => n >= MIN_REPORTS;

function outcomeCounts(rows: readonly ReportRecord[]): ReportCount[] {
  return REPORT_OUTCOMES.map((o) => ({ id: o.id as string, label: o.label as string, count: rows.filter((r) => r.outcome === o.id).length })).filter(
    (c) => c.count > 0,
  );
}

function afterOf(rows: readonly ReportRecord[]): AfterView {
  const finished: number[] = [];
  let waiting = 0;
  for (const r of rows) {
    const a = afterAppointment(r);
    if (a === "waiting") waiting += 1;
    else if (a) finished.push(a.finishedInDays);
  }
  if (!floor(finished.length + waiting)) return { finished: null, waiting: null, median: null };
  return { finished: finished.length, waiting, median: floor(finished.length) ? median(finished) : null };
}

/**
 * The figures for one set of reports (one post's, or every post's). Returns only what a page may print:
 * every breakdown, cell, week and median under the floor comes back empty or null, so no caller can print
 * one by mistake. Hidden reports never count.
 */
export function summarizeReports(records: readonly ReportRecord[], today: string = isoToday()): ReportView {
  const live = records.filter((r) => r.hidden !== true);
  const since = (days: number) => addDays(today, -(days - 1));

  const windows = REPORT_WINDOWS.map((days) => {
    const from = since(days);
    const rows = live.filter((r) => activityDay(r) >= from);
    const open = floor(rows.length);
    return { days, total: rows.length, open, byOutcome: open ? outcomeCounts(rows) : [] };
  });

  const recent = live.filter((r) => activityDay(r) >= since(90));
  const apptFrom = since(WAIT_WINDOW_DAYS);
  const recentAppt = (rows: readonly ReportRecord[]) => rows.filter((r) => r.interviewOn !== undefined && r.interviewOn >= apptFrom);
  const waitsOf = (rows: readonly ReportRecord[]) => recentAppt(rows).map(waitDays).filter((d): d is number => d !== null);

  const categories = REPORT_CATEGORIES.map((c) => {
    const rows = recent.filter((r) => r.category === c.id);
    const open = floor(rows.length);
    const mineAll = live.filter((r) => r.category === c.id);
    const waits = waitsOf(mineAll);
    return {
      id: c.id,
      label: c.label as string,
      count: open ? rows.length : null,
      open,
      byOutcome: open ? outcomeCounts(rows) : [],
      waitMedian: floor(waits.length) ? median(waits) : null,
      after: afterOf(recentAppt(mineAll)),
    };
  });

  const weeks = weekStarts(today).map((start) => {
    const end = addDays(start, 7);
    const n = live.filter((r) => heldInterview(r) && r.interviewOn! >= start && r.interviewOn! < end).length;
    return { start, count: floor(n) ? n : null, partial: end > today };
  });

  const resultFrom = since(RESULT_WINDOW_DAYS);
  const decided = live.filter((r) => DECIDED.has(r.outcome) && activityDay(r) >= resultFrom);
  const g221 = decided.filter((r) => r.outcome === "221g").length;
  const resultsOpen = floor(decided.length);

  const waits = waitsOf(live);
  const waitOpen = floor(waits.length);

  return {
    total: live.length,
    windows,
    categories,
    weeks,
    results: {
      days: RESULT_WINDOW_DAYS,
      n: resultsOpen ? decided.length : null,
      g221: resultsOpen ? g221 : null,
      share: resultsOpen ? g221 / decided.length : null,
    },
    wait: { days: WAIT_WINDOW_DAYS, n: waitOpen ? waits.length : null, median: waitOpen ? median(waits) : null },
  };
}

/** Labels for a stored id, for the admin list. */
export const CATEGORY_LABEL: Record<ReportCategoryId, string> = Object.fromEntries(
  REPORT_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<ReportCategoryId, string>;
export const OUTCOME_LABEL: Record<ReportOutcomeId, string> = Object.fromEntries(
  REPORT_OUTCOMES.map((o) => [o.id, o.label]),
) as Record<ReportOutcomeId, string>;
