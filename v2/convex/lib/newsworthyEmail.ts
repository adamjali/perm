/**
 * The evening email to the owner: what moved since the morning report.
 *
 * `scripts/newsworthy.py` decides what moved (lib_newsworthy.py, tested there)
 * and hands over one line per move, each saying what moved, when, and its
 * source. This reads that hand-over defensively, since it arrives as `v.any()`
 * from a GitHub step, and words the subject and body. An empty list is no
 * email: the check runs every evening and writes only when there's news.
 */
import { dayLabel } from "./dailyReportCompose";

export const NEWS_LINES_MAX = 30;
const LINE_MAX = 600;

export interface NewsHandOver {
  day: string;
  lines: string[];
}

export function readNews(raw: unknown): NewsHandOver | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return null;
  const items = Array.isArray(r.items) ? r.items : [];
  const lines = items
    .filter((l): l is string => typeof l === "string" && l.trim() !== "")
    .slice(0, NEWS_LINES_MAX)
    .map((l) => (l.length > LINE_MAX ? `${l.slice(0, LINE_MAX - 3).trimEnd()}...` : l));
  return { day: r.day, lines };
}

export function newsSubject(n: NewsHandOver): string {
  return `Newsworthy, ${dayLabel(n.day)}: ${n.lines.length} ${n.lines.length === 1 ? "thing moved" : "things moved"}`;
}

export function newsBody(n: NewsHandOver): string {
  return [
    "What moved since this morning's report, each from its own record:",
    "",
    ...n.lines.flatMap((l) => [`- ${l}`, ""]),
    "Every rule on its way, step by step: https://permtracker.app/policy-changes#pipeline",
  ].join("\n");
}
