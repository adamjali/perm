import "server-only";

import { cache } from "react";

import { parseGroupTiming, type H2bGroupTiming } from "@/lib/h2bGroups";
import { one } from "./client";

/** perm_docs['h2b_group_timing'], one point read. */
export const getH2bGroupTiming = cache(async (): Promise<H2bGroupTiming | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'h2b_group_timing'").catch(() => null);
  return r ? parseGroupTiming(String(r.json)) : null;
});

/** The season and group DOL's list put this H-2B application in, or null. */
export async function h2bGroupOf(caseNumber: string): Promise<{ peak: string; letter: string } | null> {
  const r = await one<{ peak: string; grp: string }>(
    "SELECT peak, grp FROM h2b_groups WHERE case_number = ?",
    [caseNumber.trim().toUpperCase()],
  ).catch(() => null);
  return r ? { peak: String(r.peak), letter: String(r.grp) } : null;
}
