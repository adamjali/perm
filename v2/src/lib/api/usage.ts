/**
 * Counting API calls against a plan's day and month allowances.
 *
 * WHERE THE COUNTS LIVE. In the public-data database, table `api_usage`, one
 * row per account, key and UTC day. The account is a random id made with the
 * account's first key (convex/apiKeys.ts) and the key is its public 8-character
 * id, so the table names nobody: who an account belongs to lives only in
 * Convex. Assistant calls without a key are counted under account "anonymous".
 *
 * WHY NOT A WRITE PER CALL. Calls are added up in memory and written every few
 * seconds in one statement, and each account's totals are re-read at most
 * every 30 seconds. The site runs as two copies, so between re-reads each copy
 * sees its own calls at once and the other copy's a little later; an account
 * can go a few calls past its allowance in that window, never far.
 *
 * Counting never blocks an answer: if the database can't be written, the
 * counts are kept and retried, and the call is still served.
 */
import "server-only";

import { exec, rows } from "@/lib/turso/client";
import type { ApiPlan } from "@convex/lib/apiPlans";

export const ANONYMOUS_ACCOUNT = "anonymous";
const FLUSH_MS = 5_000;
const REFRESH_MS = 30_000;
const MAX_TRACKED = 20_000;

const CREATE = `CREATE TABLE IF NOT EXISTS api_usage (
  account TEXT NOT NULL,
  key_id TEXT NOT NULL,
  day TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account, key_id, day)
)`;

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Seconds until the next UTC midnight, and until the first of next month. */
export function resetsIn(now: Date): { day: number; month: number } {
  const t = now.getTime();
  const nextDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const nextMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return { day: Math.ceil((nextDay - t) / 1000), month: Math.ceil((nextMonth - t) / 1000) };
}

interface Totals {
  at: number;
  day: string;
  today: number;
  month: number;
}

const pending = new Map<string, number>();
const totals = new Map<string, Totals>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = exec(CREATE).then(
      () => undefined,
      (err) => {
        tableReady = null;
        throw err;
      },
    );
  }
  return tableReady;
}

async function flush(): Promise<void> {
  flushTimer = null;
  if (pending.size === 0) return;
  const batch = [...pending.entries()];
  pending.clear();
  const values: unknown[] = [];
  for (const [k, n] of batch) values.push(...k.split("\t"), n);
  try {
    await ensureTable();
    await exec(
      `INSERT INTO api_usage (account, key_id, day, calls) VALUES ${batch.map(() => "(?,?,?,?)").join(",")}
       ON CONFLICT (account, key_id, day) DO UPDATE SET calls = calls + excluded.calls`,
      values,
    );
    // The written calls are now in the database; carry them into the cached
    // totals so they aren't missed until the next re-read.
    for (const [k, n] of batch) {
      const [account, , day] = k.split("\t");
      const t = totals.get(account!);
      if (t) {
        t.month += n;
        if (t.day === day) t.today += n;
      }
    }
  } catch (err) {
    // Put them back and try again later. A call is never refused because the
    // counter couldn't be written.
    for (const [k, n] of batch) pending.set(k, (pending.get(k) ?? 0) + n);
    console.error("[apiUsage] flush failed", err instanceof Error ? err.message : err);
    schedule(FLUSH_MS * 6);
  }
}

function schedule(ms = FLUSH_MS): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => void flush(), ms);
  flushTimer.unref?.();
}

/** Calls for the account not yet written, today and this month. */
function unwritten(account: string, day: string): { today: number; month: number } {
  let today = 0;
  let month = 0;
  const monthPrefix = day.slice(0, 7);
  for (const [k, n] of pending) {
    const [a, , d] = k.split("\t");
    if (a !== account) continue;
    if (d!.startsWith(monthPrefix)) month += n;
    if (d === day) today += n;
  }
  return { today, month };
}

async function readTotals(account: string, day: string): Promise<Totals> {
  const monthStart = `${day.slice(0, 7)}-01`;
  let today = 0;
  let month = 0;
  try {
    const r = await rows<{ day: string; calls: number }>(
      "SELECT day, sum(calls) AS calls FROM api_usage WHERE account = ? AND day >= ? GROUP BY day",
      [account, monthStart],
    );
    for (const x of r) {
      month += Number(x.calls);
      if (x.day === day) today = Number(x.calls);
    }
  } catch (err) {
    // No table yet (no call has ever been written) reads as zero. Anything
    // else is logged and also reads as zero, so a database hiccup fails open.
    if (!/no such table/i.test(String(err))) {
      console.error("[apiUsage] read failed", err instanceof Error ? err.message : err);
    }
  }
  return { at: Date.now(), day, today, month };
}

/** The account's calls today and this month, as of a few seconds ago. */
export async function usageFor(account: string, now = new Date()): Promise<{ today: number; month: number }> {
  const day = utcDay(now);
  let t = totals.get(account);
  if (!t || t.day !== day || Date.now() - t.at > REFRESH_MS) {
    if (totals.size > MAX_TRACKED) totals.clear();
    t = await readTotals(account, day);
    totals.set(account, t);
  }
  const u = unwritten(account, day);
  return { today: t.today + u.today, month: t.month + u.month };
}

/** Count one call. Returns at once; the write happens within a few seconds. */
export function countCall(account: string, keyId: string, now = new Date()): void {
  const k = `${account}\t${keyId}\t${utcDay(now)}`;
  pending.set(k, (pending.get(k) ?? 0) + 1);
  schedule();
}

export type AllowanceVerdict =
  | { ok: true; today: number; month: number }
  | { ok: false; which: "day" | "month"; today: number; month: number; retryAfter: number };

/** Whether one more call fits the plan's day and month. */
export async function checkAllowance(account: string, plan: ApiPlan, now = new Date()): Promise<AllowanceVerdict> {
  const u = await usageFor(account, now);
  const reset = resetsIn(now);
  if (u.month >= plan.perMonth) return { ok: false, which: "month", ...u, retryAfter: reset.month };
  if (u.today >= plan.perDay) return { ok: false, which: "day", ...u, retryAfter: reset.day };
  return { ok: true, ...u };
}

/** Per key and calendar minute, in this copy of the site. */
const minuteCounts = new Map<string, number>();
let minuteNow = "";

export function takeMinute(bucket: string, limit: number, now = new Date()): { ok: boolean; remaining: number; reset: number } {
  const minute = now.toISOString().slice(0, 16);
  if (minute !== minuteNow) {
    minuteCounts.clear();
    minuteNow = minute;
  }
  const used = minuteCounts.get(bucket) ?? 0;
  const reset = 60 - now.getUTCSeconds();
  if (used >= limit) return { ok: false, remaining: 0, reset };
  minuteCounts.set(bucket, used + 1);
  return { ok: true, remaining: limit - used - 1, reset };
}

/** Per-key calls today and this month, for Settings. */
export async function usageByKey(
  account: string,
  now = new Date(),
): Promise<{ keyId: string; today: number; month: number; lastDay: string | null }[]> {
  const day = utcDay(now);
  const monthStart = `${day.slice(0, 7)}-01`;
  try {
    const r = await rows<{ key_id: string; today: number; month: number; last_day: string | null }>(
      `SELECT key_id,
              sum(CASE WHEN day = ? THEN calls ELSE 0 END) AS today,
              sum(CASE WHEN day >= ? THEN calls ELSE 0 END) AS month,
              max(day) AS last_day
         FROM api_usage WHERE account = ? GROUP BY key_id`,
      [day, monthStart, account],
    );
    const u = new Map(r.map((x) => [x.key_id, { today: Number(x.today), month: Number(x.month), lastDay: x.last_day }]));
    for (const [k, n] of pending) {
      const [a, keyId, d] = k.split("\t");
      if (a !== account) continue;
      const cur = u.get(keyId!) ?? { today: 0, month: 0, lastDay: null };
      if (d === day) cur.today += n;
      if (d! >= monthStart) cur.month += n;
      if (!cur.lastDay || d! > cur.lastDay) cur.lastDay = d!;
      u.set(keyId!, cur);
    }
    return [...u.entries()].map(([keyId, v]) => ({ keyId, ...v }));
  } catch (err) {
    if (/no such table/i.test(String(err))) return [];
    throw err;
  }
}

/** Test seam: forget every in-memory count. */
export function resetUsageMemoryForTests(): void {
  pending.clear();
  totals.clear();
  minuteCounts.clear();
  minuteNow = "";
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  tableReady = null;
}

/** Test seam: write what's pending now. */
export function flushUsageForTests(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  return flush();
}
