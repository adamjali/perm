import "server-only";

import { cache } from "react";

import { parsePwdDayData, type PwdDayData } from "@/lib/pwdDay";
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
