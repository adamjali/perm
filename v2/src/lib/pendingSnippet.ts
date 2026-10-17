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
