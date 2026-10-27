/**
 * The policy page's shaping, pure so the browser and the tests can share it.
 *
 * One table, several sources (`lib/db/policyNotices`). Here they're sorted
 * into what the page shows: the Register's published documents (presidential
 * ones included), what's coming next (filed for public inspection, or signed
 * at the White House and not yet published), and the agencies' own
 * announcements (USCIS, its Policy Manual, DOL and OFLC). Everything is
 * arithmetic over those rows and a `today`: which correction belongs to which
 * document, whether a comment window is still open, and where each document
 * sits on a twelve-month strip. Nothing reads the clock; the page passes the date.
 */

import type { PolicyNotice } from "@/lib/db/policyNotices";
import { MS_PER_DAY } from "@/lib/time";
import { MONTH_ABBR } from "@convex/lib/months";

export const OFLC_TYPE = "OFLC announcement";
export const WH_TYPE = "Presidential action";
export const USCIS_TYPE = "USCIS announcement";
export const PM_TYPE = "Policy Manual update";
export const DOL_TYPE = "DOL news release";
export const STATE_TYPE = "State Department visa news";
export const PRESIDENTIAL_TYPE = "Presidential Document";
/** A bill or joint resolution in Congress (`scripts/ingest_congress_bills.py`). */
export const BILL_TYPE = "Bill";
export const COURT_TYPE = "Court opinion";
export const BALCA_TYPE = "BALCA decision";
/** Decisions on these programs, a court's or BALCA's: not Register documents. */
export const DECISION_TYPES: readonly string[] = [COURT_TYPE, BALCA_TYPE];

/** Posts an agency made on its own site, which aren't Register documents. */
export const ANNOUNCEMENT_TYPES: readonly string[] = [OFLC_TYPE, USCIS_TYPE, PM_TYPE, DOL_TYPE, STATE_TYPE];

export interface FeedDoc extends PolicyNotice {
  /** Corrections the Register published to this document, newest first. */
  corrections: PolicyNotice[];
}

export interface PolicyFeed {
  /** Register documents, published or withdrawn, newest first, corrections folded in. */
  register: FeedDoc[];
  /** On the Register's public inspection list now, newest filing first. */
  filed: PolicyNotice[];
  /** Presidential actions the White House posted that the Register hasn't published yet. */
  signed: PolicyNotice[];
  /**
   * Announcements from USCIS, its Policy Manual, DOL and OFLC, newest first,
   * and White House actions the Register hasn't printed within SIGNED_WAIT_DAYS.
   */
  announcements: PolicyNotice[];
  /**
   * Bills in Congress, newest latest action first. A bill's `dates` holds its
   * latest action's day and `action` its text; `publicationDate` is the day
   * it was introduced.
   */
  bills: PolicyNotice[];
  /** Federal court opinions and BALCA decisions, newest decision first. */
  decisions: PolicyNotice[];
}

function isCorrection(n: PolicyNotice): boolean {
  return n.correctionOf !== null || /^C\d+-/.test(n.documentNumber);
}

function parentOf(n: PolicyNotice): string {
  return n.correctionOf ?? n.documentNumber.replace(/^C\d+-/, "");
}

const byDateDesc = (a: PolicyNotice, b: PolicyNotice) =>
  b.publicationDate.localeCompare(a.publicationDate) || b.documentNumber.localeCompare(a.documentNumber);

/**
 * Fold each correction into the document it corrects. A correction whose
 * parent is not in the list stays as an entry of its own: it is a real
 * document, and hiding it would hide the only record of the change.
 */
export function foldCorrections(rows: readonly PolicyNotice[]): FeedDoc[] {
  const docs = new Map<string, FeedDoc>();
  const orphans: PolicyNotice[] = [];
  for (const n of rows) if (!isCorrection(n)) docs.set(n.documentNumber, { ...n, corrections: [] });
  for (const n of rows) {
    if (!isCorrection(n)) continue;
    const parent = docs.get(parentOf(n));
    if (parent) parent.corrections.push(n);
    else orphans.push(n);
  }
  const out: FeedDoc[] = [...docs.values(), ...orphans.map((n) => ({ ...n, corrections: [] }))];
  for (const d of out) d.corrections.sort(byDateDesc);
  return out.sort(byDateDesc);
}

/**
 * How long a White House action waits for its Register document before it's
 * no longer "coming next". The Register prints a proclamation or an executive
 * order a few business days after signing (the H-1B proclamation: signed Sep
 * 19 2026, published Sep 23); many memoranda are never printed at all. Past
 * this, an unmatched action is listed among the announcements instead.
 */
export const SIGNED_WAIT_DAYS = 14;

/** A White House action still waiting for the Register, as of `today`. */
export function awaitsRegister(n: PolicyNotice, today: string | undefined): boolean {
  if (n.type !== WH_TYPE || n.supersededBy) return false;
  return today === undefined || daysBetween(n.signingDate ?? n.publicationDate, today) <= SIGNED_WAIT_DAYS;
}

/** A bill's latest action day, else the day it was introduced. */
export function billActionDay(n: PolicyNotice): string {
  return n.dates && /^\d{4}-\d{2}-\d{2}$/.test(n.dates) ? n.dates : n.publicationDate;
}

export function buildFeed(all: readonly PolicyNotice[], today?: string): PolicyFeed {
  const bills = all
    .filter((n) => n.type === BILL_TYPE)
    .sort((a, b) => billActionDay(b).localeCompare(billActionDay(a)) || byDateDesc(a, b));
  const decisions = all.filter((n) => DECISION_TYPES.includes(n.type)).sort(byDateDesc);
  const rows = all.filter((n) => n.type !== BILL_TYPE && !DECISION_TYPES.includes(n.type));
  const isAnnouncement = (n: PolicyNotice) =>
    ANNOUNCEMENT_TYPES.includes(n.type) || (n.type === WH_TYPE && !n.supersededBy && !awaitsRegister(n, today));
  const filed = rows
    .filter((n) => n.status === "public-inspection" && !isAnnouncement(n) && n.type !== WH_TYPE)
    .sort((a, b) => (b.piFiled ?? "").localeCompare(a.piFiled ?? "") || byDateDesc(a, b));
  const signed = rows.filter((n) => awaitsRegister(n, today)).sort(byDateDesc);
  const register = foldCorrections(
    rows.filter((n) => !isAnnouncement(n) && n.type !== WH_TYPE && n.status !== "public-inspection"),
  );
  const announcements = rows.filter(isAnnouncement).sort(byDateDesc);
  return { register, filed, signed, announcements, bills, decisions };
}

/** Whole days from `from` to `to`, ISO dates, UTC arithmetic so no zone can shift a boundary. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) -
    Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / MS_PER_DAY);
}

export interface CommentWindow {
  closesOn: string;
  /** Open through the close date itself: the Register accepts comments until midnight Eastern that day. */
  state: "open" | "closed";
  daysLeft: number;
}

export function commentWindow(n: PolicyNotice, today: string): CommentWindow | null {
  if (!n.commentsCloseOn) return null;
  const daysLeft = daysBetween(today, n.commentsCloseOn);
  return { closesOn: n.commentsCloseOn, state: daysLeft >= 0 ? "open" : "closed", daysLeft };
}

export interface EffectiveState {
  on: string;
  /** Two states, not one boolean: a rule with a future date is UPCOMING, not "not in effect". */
  state: "upcoming" | "in-effect";
}

export function effectiveState(n: PolicyNotice, today: string): EffectiveState | null {
  if (!n.effectiveOn) return null;
  return { on: n.effectiveOn, state: n.effectiveOn > today ? "upcoming" : "in-effect" };
}

/** What the ledger states, computed rather than typed. */
export interface FeedLedger {
  rules: number;
  proposed: number;
  proposedOpen: number;
  notices: number;
  presidential: number;
  /** Filed for public inspection or signed, not yet in the Register. */
  coming: number;
  announcements: number;
  announcementsSince: string | null;
  bills: number;
  decisions: number;
  earliest: string | null;
  newest: string | null;
}

export function feedLedger(feed: PolicyFeed, today: string): FeedLedger {
  const reg = feed.register.filter((d) => d.status !== "withdrawn");
  const proposed = reg.filter((d) => d.type === "Proposed Rule");
  const dates = [...reg, ...feed.announcements].map((d) => d.publicationDate).sort();
  const a = feed.announcements;
  return {
    rules: reg.filter((d) => d.type === "Rule").length,
    proposed: proposed.length,
    proposedOpen: proposed.filter((d) => commentWindow(d, today)?.state === "open").length,
    notices: reg.filter((d) => d.type === "Notice").length,
    presidential: reg.filter((d) => d.type === PRESIDENTIAL_TYPE).length,
    coming: feed.filed.length + feed.signed.length,
    announcements: a.length,
    announcementsSince: a.length ? a[a.length - 1]!.publicationDate : null,
    bills: feed.bills.length,
    decisions: feed.decisions.length,
    earliest: reg.length ? reg[reg.length - 1]!.publicationDate : null,
    newest: dates.length ? dates[dates.length - 1]! : null,
  };
}

/* ---------------------------------------------------------------- timeline */

/** The drawing is 1000 units wide; positions are in those units. */
export const STRIP_W = 1000;
export const STRIP_PAD = 28;

export interface StripMark {
  x: number;
  documentNumber: string;
  title: string;
  type: string;
  publicationDate: string;
  /** For a proposed rule with a comment window inside the strip: its bar. */
  bar: { x0: number; x1: number; open: boolean } | null;
}

export interface StripMonth {
  x: number;
  /** "Oct", or "Jan 2026" at a year boundary and on the first label. */
  label: string;
}

export interface Strip {
  start: string;
  end: string;
  months: StripMonth[];
  register: StripMark[];
  /** The agencies' own announcements, the short ticks. */
  announcements: StripMark[];
  todayX: number;
  /** Documents older than the strip, stated in words under it. */
  earlierRegister: number;
  earlierAnnouncements: number;
}

function iso(y: number, m0: number, d: number): string {
  return new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);
}

/**
 * Twelve months ending with today's month, every document placed by
 * publication date. Ends at the last day of the current month so today's
 * marker never sits on the right edge, and every label is inside the box:
 * the first month is anchored at its start and the last at its end, the
 * lesson from the axis whose end label overflowed by its own width.
 */
export function buildStrip(feed: PolicyFeed, today: string, monthsBack = 12): Strip {
  const ty = +today.slice(0, 4);
  const tm = +today.slice(5, 7) - 1;
  const startDate = new Date(Date.UTC(ty, tm - (monthsBack - 1), 1));
  const start = startDate.toISOString().slice(0, 10);
  const end = iso(ty, tm + 1, 0); // day 0 of next month = last day of this one
  const span = Math.max(1, daysBetween(start, end));
  const inner = STRIP_W - 2 * STRIP_PAD;
  const xOf = (date: string) => STRIP_PAD + (Math.min(Math.max(daysBetween(start, date), 0), span) / span) * inner;

  const months: StripMonth[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + i, 1));
    const m = d.getUTCMonth();
    const y = d.getUTCFullYear();
    months.push({ x: xOf(d.toISOString().slice(0, 10)), label: i === 0 || m === 0 ? `${MONTH_ABBR[m]} ${y}` : MONTH_ABBR[m]! });
  }

  const inStrip = (n: PolicyNotice) => n.publicationDate >= start && n.publicationDate <= end;
  const mark = (n: PolicyNotice): StripMark => {
    const w = commentWindow(n, today);
    const bar = w && n.type === "Proposed Rule"
      ? { x0: xOf(n.publicationDate), x1: xOf(w.closesOn > end ? end : w.closesOn), open: w.state === "open" }
      : null;
    return { x: xOf(n.publicationDate), documentNumber: n.documentNumber, title: n.title, type: n.type, publicationDate: n.publicationDate, bar };
  };

  return {
    start,
    end,
    months,
    register: feed.register.filter((n) => n.status !== "withdrawn" && inStrip(n)).map(mark),
    announcements: feed.announcements.filter(inStrip).map(mark),
    todayX: xOf(today),
    earlierRegister: feed.register.filter((n) => n.publicationDate < start).length,
    earlierAnnouncements: feed.announcements.filter((n) => n.publicationDate < start).length,
  };
}

/**
 * Marks that share a day would draw on top of each other (two rules published
 * the same day). Each mark takes the lowest lane no earlier mark within
 * `minGap` units is already on, so a same-day pair stacks and a spread-out
 * series stays flat. Input order is preserved.
 */
export function assignLanes<T extends { x: number }>(marks: readonly T[], minGap = 14): (T & { lane: number })[] {
  const placed: { x: number; lane: number }[] = [];
  return marks.map((m) => {
    let lane = 0;
    while (placed.some((p) => p.lane === lane && Math.abs(p.x - m.x) < minGap)) lane += 1;
    placed.push({ x: m.x, lane });
    return { ...m, lane };
  });
}

/**
 * Comment windows are intervals, and two open at once would draw over each
 * other on one rail (March's proposal ran to May while April's ran to June).
 * Each bar takes the lowest lane whose last bar ended before this one starts.
 * Input order is preserved; a mark without a bar keeps lane 0.
 */
export function assignBarLanes<T extends { bar: { x0: number; x1: number } | null }>(
  marks: readonly T[],
): (T & { barLane: number })[] {
  const order = marks
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.bar)
    .sort((a, b) => a.m.bar!.x0 - b.m.bar!.x0);
  const laneEnds: number[] = [];
  const laneOf = new Map<number, number>();
  for (const { m, i } of order) {
    let lane = laneEnds.findIndex((end) => end < m.bar!.x0);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = m.bar!.x1;
    laneOf.set(i, lane);
  }
  return marks.map((m, i) => ({ ...m, barLane: laneOf.get(i) ?? 0 }));
}
