import type { QueueDating, Span } from "@/lib/perm";
import { ISO_DATE_REGEX } from "@convex/lib/dateValidation";

/**
 * The green card planner's question to /api/plan, and its answer: one plain module so the route
 * and the planner can't disagree about what's asked or what comes back.
 */

export const PLAN_CATEGORIES = ["EB2", "EB3"] as const;
export type PlanCategory = (typeof PLAN_CATEGORIES)[number];
export const PLAN_COUNTRIES = ["worldwide", "india", "china", "mexico", "philippines"] as const;
export type PlanCountry = (typeof PLAN_COUNTRIES)[number];

/**
 * The earliest filing day the queues are asked about. DOL's live record of pending PERM cases
 * reaches back to filings of 2023; anything earlier is long decided or out of line. A priority
 * date for the line has no floor: EB-2 India's line holds dates from 2013.
 */
export const PLAN_QUEUE_FROM = "2023-01-01";

export interface PlanAnswer {
  /** A filed wage request still in process, dated by the requests ahead of it. */
  pwd: QueueDating | null;
  /** A filed PERM in line, dated by the cases ahead of it. */
  perm: QueueDating | null;
  /** Why the PERM has no date, when the case page's model says (the queue passed its month, say). */
  permNote: string | null;
  /** People ahead of the priority date in its line, and green cards issued in the line a year. */
  line: { peopleAhead: Span; perYear: number; fy: number } | null;
}

export interface PlanQuery {
  /** A wage request filed that day and still in process. */
  pwd?: string;
  /** A PERM filed that day and in line. */
  perm?: string;
  /** A priority date in its line. */
  line?: { pd: string; category: PlanCategory; country: PlanCountry };
}

type Asked = string | undefined | { error: string };

const asked = (day: string | null, today: string, from: string | null): Asked => {
  if (!day) return undefined;
  if (!ISO_DATE_REGEX.test(day)) return { error: "dates must be YYYY-MM-DD" };
  if (day > today) return { error: "dates can't be after today" };
  if (from && day < from) return { error: `the queues answer for days from ${from} to today` };
  return day;
};

/** The query, checked: dates in range, a known category and country beside a priority date. */
export function parsePlanQuery(params: URLSearchParams, today: string): PlanQuery | { error: string } {
  const pwd = asked(params.get("pwd"), today, PLAN_QUEUE_FROM);
  const perm = asked(params.get("perm"), today, PLAN_QUEUE_FROM);
  const pd = asked(params.get("pd"), today, null);
  for (const d of [pwd, perm, pd]) if (d && typeof d === "object") return d;
  const cat = params.get("cat");
  const country = params.get("country");
  if ((cat || country) && !pd) return { error: "a line (cat, country) needs its priority date (pd)" };
  let line: PlanQuery["line"];
  if (pd) {
    if (!PLAN_CATEGORIES.includes(cat as PlanCategory) || !PLAN_COUNTRIES.includes(country as PlanCountry)) {
      return { error: `cat must be one of ${PLAN_CATEGORIES.join(", ")} and country one of ${PLAN_COUNTRIES.join(", ")}` };
    }
    line = { pd: pd as string, category: cat as PlanCategory, country: country as PlanCountry };
  }
  if (!pwd && !perm && !line) return { error: "ask about a filed wage request (pwd), a filed PERM (perm) or a priority date's line (pd, cat, country)" };
  const out: PlanQuery = {};
  if (pwd) out.pwd = pwd as string;
  if (perm) out.perm = perm as string;
  if (line) out.line = line;
  return out;
}

/** The address the planner asks, or null when it has nothing to ask. */
export function planQueryHref(q: PlanQuery): string | null {
  if (!q.pwd && !q.perm && !q.line) return null;
  const p = new URLSearchParams();
  if (q.pwd) p.set("pwd", q.pwd);
  if (q.perm) p.set("perm", q.perm);
  if (q.line) {
    p.set("pd", q.line.pd);
    p.set("cat", q.line.category);
    p.set("country", q.line.country);
  }
  return `/api/plan?${p.toString()}`;
}
