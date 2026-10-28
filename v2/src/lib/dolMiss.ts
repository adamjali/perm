/**
 * Why a live DOL lookup came back without a record, and how to say so.
 *
 * Only "none" means DOL answered and holds no such number. The other three
 * mean nothing is known, and each has its own cause, which the reader is told:
 *
 *   unavailable  DOL didn't answer within the lookup's 8 seconds, or errored
 *   budget       the site's daily allowance of live checks is used up
 *   not-asked    the check couldn't be made (the counter itself failed)
 *
 * "budget" and "not-asked" are kept apart so a counter failure never tells
 * the reader the daily limit is used up when it isn't.
 * A plain module (no server-only import) so the result panels can use it.
 */

import { DOL_MISS } from "@/lib/dolMiss.messages";
import { EASTERN_TIMEZONE } from "@/lib/time";

export type DiscoveryMiss = "none" | "unavailable" | "budget" | "not-asked";
export type UnsettledMiss = Exclude<DiscoveryMiss, "none">;

/**
 * Everything a result panel may have to explain: the DOL misses above, plus
 * "records", when this site's own case records couldn't be read at all, which
 * must never render as "Not in our records".
 */
export type LookupGap = UnsettledMiss | "records";

export function isLookupGap(m: string | null | undefined): m is LookupGap {
  return m === "records" || isUnsettledMiss(m as DiscoveryMiss);
}

/** True when a miss leaves the question open, so it must never read as "no record". */
export function isUnsettledMiss(m: DiscoveryMiss | null | undefined): m is UnsettledMiss {
  return m === "unavailable" || m === "budget" || m === "not-asked";
}

/** When the live-check allowance resets: midnight UTC, said in Eastern time. */
export function budgetResetEastern(now: Date = new Date(), locale = "en-US"): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return new Intl.DateTimeFormat(locale, {
    timeZone: EASTERN_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(next).replace(":00", "");
}

/** The short heading for an unsettled lookup. */
export function unsettledVerdict(m: LookupGap): string {
  return DOL_MISS.en.verdict[m];
}

/** The clause after "We hold no record for <number> yet, ". */
export function unsettledClause(m: LookupGap, now: Date = new Date()): string {
  return DOL_MISS.en.clause(m, budgetResetEastern(now));
}
