/**
 * What DOL's quarterly PERM file says, as the posts read it: perm_docs['quarter_report_<fy>q<n>'],
 * written by scripts/build_quarter_report.py, and the pointer perm_docs['quarter_report'] to the
 * newest. Plain module: the article parts and their tests read it.
 */
import { MONTH_NAMES } from "@convex/lib/months";

export interface QuarterRef {
  fy: number;
  q: number;
  from: string;
  to: string;
}

export interface QuarterFigures {
  certified: number;
  denied: number;
  withdrawn: number;
  total: number;
  certifiedShare: number | null;
  medianDays: number | null;
  p90Days: number | null;
  medianWage: number | null;
}

export interface RankedEntry {
  key: string;
  name: string;
  linked: boolean;
  n: number;
  prior: number;
  yearAgo: number;
}

export interface QuarterReport {
  quarter: QuarterRef & { key: string };
  prior: QuarterRef;
  yearAgo: QuarterRef;
  figures: { this: QuarterFigures; prior: QuarterFigures; yearAgo: QuarterFigures };
  programs: Record<"this" | "prior" | "yearAgo", { pw: { n: number }; lca: { n: number } }>;
  employers: RankedEntry[];
  firms: RankedEntry[];
  jobs: RankedEntry[];
  states: RankedEntry[];
  newEmployers: { count: number; cases: number; top: { key: string; name: string; linked: boolean; n: number }[] };
}

/** "2026q3": the doc key's tail, and the only form a post may pass. */
export const QUARTER_KEY_RE = /^\d{4}q[1-4]$/;

/** "April to June 2026". */
export function quarterMonths(q: Pick<QuarterRef, "from" | "to">): string {
  const m = (iso: string) => MONTH_NAMES[Number(iso.slice(5, 7)) - 1] ?? iso;
  return `${m(q.from)} to ${m(q.to)} ${q.to.slice(0, 4)}`;
}

/** "fiscal 2026, Q3". */
export function quarterName(q: Pick<QuarterRef, "fy" | "q">): string {
  return `fiscal ${q.fy}, Q${q.q}`;
}

/** The change from one count to another, in words: "up 12%", "down 3%", "about the same", "new". */
export function changeWords(now: number, before: number): string {
  if (before <= 0) return now > 0 ? "none before" : "about the same";
  const r = (now - before) / before;
  if (Math.abs(r) < 0.005) return "about the same";
  const pct = Math.abs(r) >= 0.1 ? Math.round(Math.abs(r) * 100) : Math.round(Math.abs(r) * 1000) / 10;
  return `${r > 0 ? "up" : "down"} ${pct}%`;
}
