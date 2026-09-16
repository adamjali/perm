/**
 * The policy page's shaping, pure so the browser and the tests can share it.
 *
 * The table holds two feeds under one shape: Federal Register documents
 * (rules, proposed rules, notices) and OFLC's own announcements. Everything
 * here is arithmetic over those rows and a `today`: which announcements are
 * on this site's programs, which correction belongs to which document,
 * whether a comment window is still open, and where each document sits on a
 * twelve-month strip. Nothing reads the clock; the page passes the date.
 */

import type { PolicyNotice } from "@/lib/turso/policyNotices";

export const OFLC_TYPE = "OFLC announcement";

/**
 * OFLC tags its announcements by program (`ingest_oflc_news.py`). These are
 * the programs this site is about; an announcement carrying none of them is
 * H-2A, H-2B or CW-1 housekeeping and is counted rather than listed.
 */
export const OFLC_SITE_TOPICS = ["perm", "prevailing-wage", "h-1b", "disclosure-data", "flag"] as const;

export interface FeedDoc extends PolicyNotice {
  /** Corrections the Register published to this document, newest first. */
  corrections: PolicyNotice[];
}

export interface PolicyFeed {
  /** Federal Register documents, newest first, corrections folded in. */
  register: FeedDoc[];
  /** OFLC announcements on this site's programs, newest first. */
  oflc: PolicyNotice[];
  /** OFLC announcements held but not listed (other programs). */
  oflcOther: number;
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

export function isOnSitePrograms(n: PolicyNotice): boolean {
  return n.topics.some((t) => (OFLC_SITE_TOPICS as readonly string[]).includes(t));
}

export function buildFeed(rows: readonly PolicyNotice[]): PolicyFeed {
  const register = foldCorrections(rows.filter((n) => n.type !== OFLC_TYPE));
  const oflcAll = rows.filter((n) => n.type === OFLC_TYPE);
  const oflc = oflcAll.filter(isOnSitePrograms).sort(byDateDesc);
  return { register, oflc, oflcOther: oflcAll.length - oflc.length };
}

/** Whole days from `from` to `to`, ISO dates, UTC arithmetic so no zone can shift a boundary. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) -
    Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000);
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
  oflc: number;
  oflcSince: string | null;
  earliest: string | null;
  newest: string | null;
}

export function feedLedger(feed: PolicyFeed, today: string): FeedLedger {
  const reg = feed.register;
  const proposed = reg.filter((d) => d.type === "Proposed Rule");
  const dates = [...reg, ...feed.oflc].map((d) => d.publicationDate).sort();
  return {
    rules: reg.filter((d) => d.type === "Rule").length,
    proposed: proposed.length,
    proposedOpen: proposed.filter((d) => commentWindow(d, today)?.state === "open").length,
    notices: reg.filter((d) => d.type === "Notice").length,
    oflc: feed.oflc.length,
    oflcSince: feed.oflc.length ? feed.oflc[feed.oflc.length - 1]!.publicationDate : null,
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
  oflc: StripMark[];
  todayX: number;
  /** Documents older than the strip, stated in words under it. */
  earlierRegister: number;
  earlierOflc: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

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
    months.push({ x: xOf(d.toISOString().slice(0, 10)), label: i === 0 || m === 0 ? `${MONTHS[m]} ${y}` : MONTHS[m]! });
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
    register: feed.register.filter(inStrip).map(mark),
    oflc: feed.oflc.filter(inStrip).map(mark),
    todayX: xOf(today),
    earlierRegister: feed.register.filter((n) => n.publicationDate < start).length,
    earlierOflc: feed.oflc.filter((n) => n.publicationDate < start).length,
  };
}

/**
 * Marks that share a day would draw on top of each other (two DHS rules on
 * 2026-08-10). Each mark takes the lowest lane no earlier mark within
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
