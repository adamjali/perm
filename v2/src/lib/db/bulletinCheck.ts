import "server-only";

import { cache } from "react";

import { parseBulletinCheck, type BulletinCheck } from "@/lib/bulletinCheck";
import { one } from "./client";

/**
 * perm_docs['bulletin_backtest'], written by scripts/backtest_bulletin.py:
 * how the past-pace arithmetic held on past bulletins. Null when missing, and
 * the tools then print their figure without the tested line.
 */
export const getBulletinCheck = cache(async (): Promise<BulletinCheck | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'bulletin_backtest'").catch(() => null);
  return r ? parseBulletinCheck(String(r.json)) : null;
});
