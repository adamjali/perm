import "server-only";

import type { StatusEvent } from "@/lib/statusHistory";
import { DIRECT_EVENT_SOURCE } from "./rfi";
import { rows } from "./client";

/** At most this many changes per case; DOL rarely moves one case more than a handful of times. */
const MAX_EVENTS = 60;

/**
 * Every status change our checks saw for one PERM case, read on the event log's primary key. Only DOL's own
 * record (the direct sweep's rows), never the retired mirror's. A failed read throws, so the page drops the
 * section rather than showing a case with no history.
 */
export async function getStatusHistory(caseNumber: string): Promise<StatusEvent[]> {
  const r = await rows<{ at: number | string; f: string; t: string }>(
    `SELECT changed_at AS at, from_status AS f, to_status AS t FROM perm_case_events
      WHERE case_number = ? AND source = ? ORDER BY changed_at LIMIT ${MAX_EVENTS}`,
    [caseNumber.trim().toUpperCase(), DIRECT_EVENT_SOURCE],
  );
  return r.map((x) => ({ at: Number(x.at), from: String(x.f ?? ""), to: String(x.t ?? "") }));
}
