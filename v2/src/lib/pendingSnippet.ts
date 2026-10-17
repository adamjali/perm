/**
 * The search-result sentence for an employer with cases still waiting on DOL.
 *
 * A search like "adobe perm on hold" comes from someone whose case is waiting,
 * so the description leads with the live count when there is one: "Adobe Inc.
 * has 218 PERM cases waiting with DOL, 216 of them on hold." The figures come
 * from `perm_entity_pending`, refreshed after every sweep, and the nightly
 * rebuild expires the pages whose counts moved, so the sentence stays within a
 * day of DOL's record. With nothing waiting it returns null and the page keeps
 * its published-record description.
 */
import { formatInt } from "@/lib/format";
import { longDate } from "@convex/lib/months";

/** DOL's status for a case it has set aside, as the sweep stores it. */
export const ON_HOLD = "APPLICATION ON HOLD";

export interface PendingCounts {
  pending: number;
  stages: { status: string; n: number }[];
}

export function pendingSentence(name: string, counts: PendingCounts | null): string | null {
  if (!counts || counts.pending <= 0) return null;
  const p = counts.pending;
  const hold = counts.stages.find((s) => s.status === ON_HOLD)?.n ?? 0;
  const held =
    hold <= 0 ? "" : hold >= p ? (p === 1 ? ", on hold" : ", all of them on hold") : `, ${formatInt(hold)} of them on hold`;
  return `${name} has ${formatInt(p)} PERM case${p === 1 ? "" : "s"} waiting with DOL${held}.`;
}

/** "where they stand", or "where it stands" for one case. */
export function whereTheyStand(counts: PendingCounts): string {
  return counts.pending === 1 ? "where it stands" : "where they stand";
}

/**
 * Whether an employer sponsors green cards now, answered from its own record:
 * "Adobe Inc. sponsors green cards: it filed 412 PERM cases in the last 12
 * months, the newest on October 2, 2026." People search the question in those
 * words, and PERM is the step an employer files to sponsor one. Null when the
 * twelve-month count is missing or zero: no filings in a year isn't proof an
 * employer won't sponsor, so the page says nothing rather than "no".
 */
export function sponsorSentence(name: string, recent12m: number | null, newestFiled?: string | null): string | null {
  if (!recent12m || recent12m <= 0) return null;
  const newest = newestFiled ? longDate(newestFiled) : null;
  const count = `${formatInt(recent12m)} PERM case${recent12m === 1 ? "" : "s"}`;
  return `${name} sponsors green cards: it filed ${count} in the last 12 months${newest ? `, the newest on ${newest}` : ""}.`;
}
