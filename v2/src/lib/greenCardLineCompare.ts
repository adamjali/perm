/**
 * EB-2 against EB-3 for one country and one priority date. Pure: two runs of
 * `estimateLine` and one rule about when a difference is real.
 *
 * The rule: a line is named as having fewer people ahead only when its whole
 * plausible range sits below the other's. Where the EB-2 check disagrees with
 * USCIS's own count, the plausible range runs from the scaled estimate to the
 * raw one, so a line is never called longer on an overcount alone. Anything
 * else is "overlap", and the page says the two can't be told apart.
 *
 * It compares PEOPLE, not waits: the two lines get different numbers of visas
 * a year, which the page prints beside each count and doesn't divide by.
 */

import { estimateLine, type LineResult, type Range } from "@/lib/greenCardLine";
import type { CountryKey } from "@/lib/perm";

type Estimate = Extract<LineResult, { kind: "estimate" }>;

export type Fewer = "EB2" | "EB3" | "overlap" | "both-current";

export interface LineComparison {
  EB2: LineResult;
  EB3: LineResult;
  /** Null when either line can't be worked out. */
  fewer: Fewer | null;
}

/** The range the answer could really be in, widened by a disagreeing check. */
export function plausibleRange(r: Estimate): Range {
  const scaled = r.check?.scaled;
  if (!scaled) return { low: r.peopleAhead.low, high: r.peopleAhead.high };
  return {
    low: Math.min(r.peopleAhead.low, scaled.low),
    high: Math.max(r.peopleAhead.high, scaled.high),
  };
}

export function compareLines(country: CountryKey, priorityDate: string, snap: Parameters<typeof estimateLine>[1]): LineComparison {
  const EB2 = estimateLine({ category: "EB2", country, priorityDate }, snap);
  const EB3 = estimateLine({ category: "EB3", country, priorityDate }, snap);
  if (EB2.kind === "no-data" || EB3.kind === "no-data") return { EB2, EB3, fewer: null };
  if (EB2.kind === "current" && EB3.kind === "current") return { EB2, EB3, fewer: "both-current" };
  if (EB2.kind === "current") return { EB2, EB3, fewer: "EB2" };
  if (EB3.kind === "current") return { EB2, EB3, fewer: "EB3" };
  const a = plausibleRange(EB2);
  const b = plausibleRange(EB3);
  const fewer: Fewer = a.high < b.low ? "EB2" : b.high < a.low ? "EB3" : "overlap";
  return { EB2, EB3, fewer };
}
