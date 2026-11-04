/**
 * How often DOL approves PERM, in one plain, dated sentence, and how the newest month compares.
 *
 * Answer engines quote a single figure with its count and its date (owner, Nov 4 2026, after Bing's answer
 * quoted a rival's "91.8% (from 374,310 filings)" and gave us a stale "13 months"). The figure is DOL's own:
 * every PERM case in its quarterly disclosure files, certified against every decision, withdrawals included,
 * so it's the share a reader's own case is most like. Beside it, the same share among the decisions our daily
 * check of DOL's case-status service saw in the last 30 days, which DOL's files won't print for months.
 *
 * Plain module: the pages read cases_meta and the observed days (lib/db/approvalRate.ts) and pass them here.
 */

import { formatApprovalRate, formatInt, formatShareOf } from "@/lib/format";
import { longDate } from "@convex/lib/months";

/** perm_docs['cases_meta'] as the disclosure load writes it (scripts/ingest_perm_disclosure.py). */
export interface CasesMeta {
  totalCases?: unknown;
  firstDecisionDate?: unknown;
  lastDecisionDate?: unknown;
  byStatus?: unknown;
}

/** One day of decisions our sweep saw (lib/db/pulse.ts, `sweep-observed`). */
export interface DecidedDay {
  date: string;
  total: number;
  certified: number;
  denied: number;
  withdrawn: number;
}

export interface ApprovalRate {
  /** The files' certified share, to one place ("91.9%"). */
  rate: string;
  /** "91.9% of the 373,939 PERM cases DOL decided from October 1, 2023 to June 30, 2026 were certified ..." */
  files: string;
  /** "In the 30 days to November 3, 2026, our daily check saw ... certified." Null with too few decisions. */
  recent: string | null;
}

/** Fewer decisions than this in 30 days and the recent share isn't quoted: a holiday fortnight reads as a trend. */
export const RECENT_MIN_DECISIONS = 1000;

const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const day = (x: unknown): string | null => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);

function statusCount(byStatus: unknown, status: string): number | null {
  if (!Array.isArray(byStatus)) return null;
  const row = byStatus.find((r) => r && typeof r === "object" && (r as { status?: unknown }).status === status);
  return row ? num((row as { count?: unknown }).count) : null;
}

/** The two sentences, or null when DOL's files can't be read (a renamed field reads as no figure, never NaN). */
export function approvalRate(meta: CasesMeta | null, days: readonly DecidedDay[]): ApprovalRate | null {
  if (!meta) return null;
  const total = num(meta.totalCases);
  const from = day(meta.firstDecisionDate);
  const to = day(meta.lastDecisionDate);
  const certified = statusCount(meta.byStatus, "certified");
  const denied = statusCount(meta.byStatus, "denied");
  const withdrawn = statusCount(meta.byStatus, "withdrawn");
  if (!total || !from || !to || certified === null || certified > total) return null;
  const rate = formatApprovalRate(certified / total);
  const parts = [
    denied !== null ? `${formatShareOf(denied, total)} were denied` : null,
    withdrawn !== null ? `${formatShareOf(withdrawn, total)} withdrawn` : null,
  ].filter(Boolean);
  const files =
    `${rate} of the ${formatInt(total)} PERM cases DOL decided from ${longDate(from)} to ${longDate(to)} were ` +
    `certified, by DOL's own disclosure files, withdrawals included` + (parts.length ? `: ${parts.join(" and ")}.` : ".");

  const newest = days.reduce<string | null>((m, d) => (m && m > d.date ? m : d.date), null);
  let recent: string | null = null;
  if (newest) {
    const start = new Date(`${newest}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 29);
    const since = start.toISOString().slice(0, 10);
    const window = days.filter((d) => d.date >= since && d.date <= newest);
    const n = window.reduce((s, d) => s + d.total, 0);
    const c = window.reduce((s, d) => s + d.certified, 0);
    if (n >= RECENT_MIN_DECISIONS) {
      recent = `In the 30 days to ${longDate(newest)}, our daily check of DOL's case status saw ${formatInt(n)} PERM decisions, and ${formatApprovalRate(c / n)} of them were certified.`;
    }
  }
  return { rate, files, recent };
}
