import "server-only";

import { cache } from "react";

import { parseMonthDetail, type MonthDetail } from "@/lib/monthDetail";
import { MS_PER_DAY } from "@/lib/time";

import { one } from "./client";

/** Older than this and the page shows nothing rather than an old week as this week. */
const MAX_AGE_MS = 3 * MS_PER_DAY;

/** One filing month's recent decisions from perm_docs['month_detail'], or null. */
export const getMonthDetail = cache(async (month: string): Promise<MonthDetail | null> => {
  const r = await one<{ json: string; computed_at: number | string }>(
    "SELECT json, computed_at FROM perm_docs WHERE key = 'month_detail'",
  ).catch(() => null);
  if (!r) return null;
  const computedAt = Number(r.computed_at);
  if (!Number.isFinite(computedAt) || Date.now() - computedAt > MAX_AGE_MS) return null;
  return parseMonthDetail(String(r.json), month);
});
