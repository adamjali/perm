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
 * "budget" and "not-asked" were one value until Sep 29 2026, so a counter
 * failure told the reader the daily limit was used up when it wasn't.
 * A plain module (no server-only import) so the result panels can use it.
 */

export type DiscoveryMiss = "none" | "unavailable" | "budget" | "not-asked";
export type UnsettledMiss = Exclude<DiscoveryMiss, "none">;

/**
 * Everything a result panel may have to explain: the DOL misses above, plus
 * "records", when this site's own case records couldn't be read at all. That
 * used to render as "Not in our records" on the PERM page (Sep 29 2026 audit).
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
export function budgetResetEastern(now: Date = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(next).replace(":00", "");
}

/** The short heading for an unsettled lookup. */
export function unsettledVerdict(m: LookupGap): string {
  if (m === "records") return "Our records couldn't be read";
  if (m === "unavailable") return "DOL didn't answer";
  if (m === "budget") return "Live checks used up for today";
  return "Not checked with DOL";
}

/** The clause after "We hold no record for <number> yet, ". */
export function unsettledClause(m: LookupGap, now: Date = new Date()): string {
  if (m === "records") {
    return "this site's own case records couldn't be read, so this doesn't mean the case isn't there.";
  }
  if (m === "unavailable") {
    return "and DOL's case system didn't answer when we asked just now (it gets 8 seconds), so we can't say whether DOL has it. That's usually brief.";
  }
  if (m === "budget") {
    return `and we couldn't ask DOL live, because the site's daily allowance of live checks is used up. It resets at ${budgetResetEastern(now)} Eastern.`;
  }
  return "and the live check with DOL couldn't be made just now, so we can't say whether DOL has it.";
}
