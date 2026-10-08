import "server-only";

import { cache } from "react";

import type { RfiClock } from "@/lib/perm";
import { parseRfiClock } from "@/lib/rfiClockDoc";
import { DIRECT_EVENT_SOURCE } from "./rfi";
import { one } from "./client";

/** The RFI clock the nightly backtest measures (perm_docs['estimator_backtest'].rfiClock). */
export const getRfiClock = cache(async (): Promise<RfiClock | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'estimator_backtest'").catch(() => null);
  return r ? parseRfiClock(String(r.json)) : null;
});

/**
 * The day our sweep saw this case enter RFI ISSUED, Eastern, or null. The newest
 * entry: a case can be asked twice, and the clock runs from the request it is
 * answering now.
 */
export async function rfiEnteredOn(caseNumber: string): Promise<string | null> {
  const r = await one<{ at: number | string | null }>(
    `SELECT MAX(changed_at) AS at FROM perm_case_events
      WHERE case_number = ? AND to_status = 'RFI ISSUED' AND from_status <> 'RFI ISSUED' AND source = ?`,
    [caseNumber.trim().toUpperCase(), DIRECT_EVENT_SOURCE],
  ).catch(() => null);
  if (!r || r.at === null || r.at === undefined) return null;
  const ms = Number(r.at);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
