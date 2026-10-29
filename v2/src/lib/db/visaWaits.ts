import "server-only";

import { cache } from "react";

import { rows } from "./client";
import type { WaitCell, WaitKind } from "@/lib/visaWaits";

/**
 * State's Global Visa Wait Times as `scripts/ingest_visa_wait_times.py` stored
 * them: one row per consulate, visa class and measure in each monthly reading.
 * A failed read throws, so the page keeps its last good render instead of
 * drawing a table State publishes as one with no record.
 */

export interface VisaWaits {
  /** Every reading held, oldest first, as State dated it. */
  readings: string[];
  /** The newest reading's every cell. */
  newest: WaitCell[];
  /** The work-visa column for every consulate, every reading. */
  history: Array<WaitCell & { reading: string }>;
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

function cellOf(r: Record<string, unknown>): WaitCell {
  return {
    post: String(r.post),
    visaClass: String(r.visa_class),
    measure: String(r.measure) === "average" ? "average" : "next",
    waitText: String(r.wait_text ?? ""),
    kind: String(r.kind) as WaitKind,
    amount: num(r.amount),
    unit: r.unit === "day" ? "day" : r.unit === "month" ? "month" : null,
    bound: r.bound === "under" ? "under" : null,
    days: num(r.days),
  };
}

export const getVisaWaits = cache(async (): Promise<VisaWaits | null> => {
  const dated = await rows<{ reading: string }>("SELECT DISTINCT reading FROM visa_wait_times ORDER BY reading");
  if (dated.length === 0) return null;
  const readings = dated.map((r) => String(r.reading));
  const newestDay = readings[readings.length - 1]!;
  const [newest, history] = await Promise.all([
    rows<Record<string, unknown>>(
      `SELECT post, visa_class, measure, wait_text, kind, amount, unit, bound, days
         FROM visa_wait_times WHERE reading = ? ORDER BY post`,
      [newestDay],
    ),
    rows<Record<string, unknown>>(
      `SELECT reading, post, visa_class, measure, wait_text, kind, amount, unit, bound, days
         FROM visa_wait_times WHERE visa_class = 'H,L,O,P,Q' AND measure = 'next' ORDER BY reading, post`,
    ),
  ]);
  return {
    readings,
    newest: newest.map(cellOf),
    history: history.map((r) => ({ ...cellOf(r), reading: String(r.reading) })),
  };
});
