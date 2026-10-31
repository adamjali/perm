import "server-only";

import { cache } from "react";

import { parsePwdDayData, type PwdDayData } from "@/lib/pwdDay";
import { sweepPwdLine, type PwdLine } from "@/lib/pwdLine";
import { parsePwdQueueDoc, parseWaitTrend, type PwdQueueDoc, type WaitTrend } from "@/lib/pwdNow";
import { rows } from "./client";

/** The wage-request day estimate's inputs, one query for both docs (src/lib/pwdDay.ts). */
export const getPwdDayData = cache(async (): Promise<PwdDayData | null> => {
  const got = await rows<{ key: string; json: string }>(
    "SELECT key, json FROM perm_docs WHERE key = 'pwd_day_queue' OR key = 'pwd_backtest'",
  ).catch(() => null);
  if (!got) return null;
  const by = new Map(got.map((r) => [r.key, r.json]));
  return parsePwdDayData(by.get("pwd_day_queue") ?? null, by.get("pwd_backtest") ?? null);
});

/** Where DOL is in the wage-request line by our own check (src/lib/pwdLine.ts). */
export const getPwdLine = cache(async (): Promise<PwdLine | null> => {
  const got = await rows<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'pwd_day_queue'").catch(() => null);
  return sweepPwdLine(got?.[0]?.json ?? null);
});

/**
 * The wage-request page's cards (src/lib/pwdNow.ts): our check's document and
 * the monthly wait from DOL's files (build_wait_trends.py). A failed read
 * leaves a card out; it never stands in for "nothing happened".
 */
export const getPwdNowDocs = cache(async (): Promise<{ queue: PwdQueueDoc | null; trend: WaitTrend | null }> => {
  const [queue, trend] = await Promise.all([
    rows<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'pwd_day_queue'").catch(() => null),
    rows<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'pwd_wait_trend'").catch(() => null),
  ]);
  return { queue: parsePwdQueueDoc(queue?.[0]?.json ?? null), trend: parseWaitTrend(trend?.[0]?.json ?? null) };
});

/** How long each month's PERM decisions waited: DOL's files, then our sweep (build_wait_trends.py). */
export const getPermWaitTrend = cache(async (): Promise<WaitTrend | null> => {
  const got = await rows<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'perm_wait_trend'").catch(() => null);
  return parseWaitTrend(got?.[0]?.json ?? null);
});
