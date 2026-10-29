import "server-only";

import { cache } from "react";

import { one } from "./client";
import { QUARTER_KEY_RE, type QuarterReport } from "@/lib/quarterReport";

/**
 * One quarter's report (perm_docs['quarter_report_<key>']), and the key of the newest.
 * A failed read throws, so a post keeps its last good render; a missing doc is null.
 */
export const getQuarterReport = cache(async (key: string): Promise<QuarterReport | null> => {
  if (!QUARTER_KEY_RE.test(key)) throw new Error(`not a quarter key: ${key}`);
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = ?", [`quarter_report_${key}`]);
  if (!r) return null;
  const d = JSON.parse(String(r.json)) as QuarterReport;
  return d && d.quarter ? d : null;
});

export const getNewestQuarterKey = cache(async (): Promise<string | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'quarter_report'");
  if (!r) return null;
  const d = JSON.parse(String(r.json)) as { fy?: number; q?: number };
  return d.fy && d.q ? `${d.fy}q${d.q}` : null;
});
