import "server-only";

import { exec, one } from "@/lib/turso/client";

/**
 * The USCIS Torch API client: OAuth client-credentials, one endpoint that is
 * documented and one that is not, and the budget that stands in front of
 * both.
 *
 * ## Sources, so nobody has to trust this file
 *
 * Everything documented here is from the Case Status API's OpenAPI spec on
 * developer.uscis.gov (`/api/case-status`, spec version 1.0.1, captured from
 * the portal on 2026-09-21; the portal is JavaScript-rendered and refuses
 * scripted fetches, so the capture in the session transcript is the copy):
 *
 * - Sandbox base `https://api-int.uscis.gov/case-status`, token URL
 *   `https://api-int.uscis.gov/oauth/accesstoken`, grant type client
 *   credentials, scope `read`. Sandbox limits: 5 TPS, 1,000 a day, staging
 *   receipt numbers only, open weekdays 7 AM to 8 PM ET (503 outside).
 * - Production: 10 TPS, 400,000 a day, "resets everyday at -04:00 UTC
 *   (Midnight EST)". The production host is `api.uscis.gov`; the same paths
 *   under it answer 401 to an unauthenticated probe (live-verified
 *   2026-09-21), which is how we know they exist.
 * - `GET /{receiptNumber}` answers 200 with `case_status` (below), 401 bad or
 *   expired token, 404 unknown receipt OR a receipt protected under
 *   8 U.S.C. 1367 (USCIS returns the same 404 for both on purpose), 422 wrong
 *   shape or unknown prefix, 429 "Spike Arrest Violation" on TPS or quota,
 *   503 sandbox closed.
 * - Two success shapes: the ordinary one carries `submittedDate` and
 *   `modifiedDate` as `MM-DD-YYYY HH:mm:ss`; the IOE (online-filed) one omits
 *   both. Everything else is shared: `receiptNumber`, `formType`,
 *   `current_case_status_text_en`, `current_case_status_desc_en`, the Spanish
 *   pair, and `hist_case_status[]` of `{ date: YYYY-MM-DD, completed_text_en,
 *   completed_text_es }`.
 *
 * `/processing-times/` is NOT in the portal's catalogue. It is live (the same
 * 401 probe), and the session that found it recorded it as undocumented. It
 * is exposed here as an untyped read so the day the keys arrive it can be
 * asked what it returns; nothing on the site consumes it until that shape is
 * known.
 *
 * ## The budget is charged before the call, and it is global
 *
 * The public-endpoint checklist, applied: USCIS's 400,000 a day is a shared
 * finite resource that a per-IP limit cannot protect (rotate the address, keep
 * spending). So every lookup first increments a per-day counter in
 * `perm_docs` and is refused when the counter is past the cap. Refused
 * attempts still count, the same shape as `underDailyBudget` in
 * caseDiscovery.ts: the counter protects USCIS, not itself. The day boundary
 * is USCIS's, midnight Eastern, so our counter and their quota reset together.
 *
 * TPS is enforced in-process with a small token bucket. Several serverless
 * instances can each hold a bucket and together exceed 10 a second; that is
 * accepted, because USCIS answers 429 and this client turns that into a
 * refusal rather than a retry storm.
 */

export type UscisEnv = "sandbox" | "production";

interface EnvConfig {
  tokenUrl: string;
  caseStatusBase: string;
  processingTimesBase: string;
  tps: number;
  dailyCap: number;
}

const ENVS: Record<UscisEnv, EnvConfig> = {
  sandbox: {
    tokenUrl: "https://api-int.uscis.gov/oauth/accesstoken",
    caseStatusBase: "https://api-int.uscis.gov/case-status",
    processingTimesBase: "https://api-int.uscis.gov/processing-times",
    tps: 5,
    // Under the sandbox's own 1,000 so a last-minute test cannot lock the day.
    dailyCap: 900,
  },
  production: {
    tokenUrl: "https://api.uscis.gov/oauth/accesstoken",
    caseStatusBase: "https://api.uscis.gov/case-status",
    processingTimesBase: "https://api.uscis.gov/processing-times",
    tps: 10,
    // Headroom under 400,000 for the sweep that will one day re-check
    // watched receipts on its own budget line.
    dailyCap: 350_000,
  },
};

/** The env var names. Values never pass through a transcript; set them by clipboard. */
export const USCIS_ENV_VARS = ["USCIS_ENV", "USCIS_CLIENT_ID", "USCIS_CLIENT_SECRET"] as const;

export function uscisEnv(): UscisEnv | null {
  const e = process.env.USCIS_ENV;
  if (e !== "sandbox" && e !== "production") return null;
  if (!process.env.USCIS_CLIENT_ID || !process.env.USCIS_CLIENT_SECRET) return null;
  return e;
}

/** True when all three variables are set. The page and route read this, never the values. */
export function uscisEnabled(): boolean {
  return uscisEnv() !== null;
}

/** The day, in USCIS's own zone, that a call is charged to. */
export function uscisBudgetDay(now: Date): string {
  // en-CA formats as YYYY-MM-DD; the zone is the whole point.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Charge one call to the day and say whether it may go ahead.
 * Increment THEN check, so a refused attempt is counted: a flood exhausts the
 * counter without ever reaching USCIS.
 */
export async function underUscisDailyBudget(now: Date, cap: number): Promise<boolean> {
  const key = `uscis_budget_${uscisBudgetDay(now)}`;
  await exec(
    `INSERT INTO perm_docs (key, json, computed_at) VALUES (?, '1', ?)
     ON CONFLICT(key) DO UPDATE SET
       json = CAST(CAST(json AS INTEGER) + 1 AS TEXT),
       computed_at = excluded.computed_at`,
    [key, now.getTime()],
  );
  const row = await one<{ n: number }>(
    `SELECT CAST(json AS INTEGER) AS n FROM perm_docs WHERE key = ?`,
    [key],
  );
  return (row?.n ?? Number.MAX_SAFE_INTEGER) <= cap;
}

/* ---------------------------------------------------------------- token */

interface CachedToken {
  token: string;
  /** Epoch ms after which the token is not offered again. */
  expiresAt: number;
  env: UscisEnv;
}

let cached: CachedToken | null = null;

/** Test hook: forget the cached token. */
export function resetTokenCache(): void {
  cached = null;
}

/**
 * Fetch or reuse an access token. Apigee's client-credentials flow takes the
 * id and secret as form fields (the portal's own curl example) and answers
 * `{ access_token, expires_in }`; `expires_in` is seconds. A token is reused
 * until sixty seconds before it expires. `f` is injectable so tests never
 * touch the network.
 */
async function accessToken(env: UscisEnv, now: Date, f: typeof fetch): Promise<string> {
  if (cached && cached.env === env && cached.expiresAt > now.getTime()) return cached.token;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.USCIS_CLIENT_ID ?? "",
    client_secret: process.env.USCIS_CLIENT_SECRET ?? "",
  });
  const res = await f(ENVS[env].tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  if (!res.ok) throw new UscisAuthError(res.status);
  const json = (await res.json()) as { access_token?: string; expires_in?: number | string };
  if (!json.access_token) throw new UscisAuthError(res.status);
  const ttl = Number(json.expires_in ?? 0);
  cached = {
    token: json.access_token,
    env,
    expiresAt: now.getTime() + Math.max(0, (Number.isFinite(ttl) ? ttl : 0) - 60) * 1000,
  };
  return cached.token;
}

export class UscisAuthError extends Error {
  constructor(public readonly status: number) {
    super(`USCIS token endpoint answered ${status}`);
  }
}

/* ------------------------------------------------------------ TPS bucket */

let bucket = { tokens: 0, at: 0 };

/**
 * A per-process token bucket at the environment's TPS. Returns true when a
 * call may go now. No waiting: a caller that is refused reports "try again",
 * because a queue in a serverless function is a queue nobody drains.
 */
export function takeTpsToken(env: UscisEnv, now: Date): boolean {
  const rate = ENVS[env].tps;
  const t = now.getTime();
  if (bucket.at === 0) bucket = { tokens: rate, at: t };
  const refill = ((t - bucket.at) / 1000) * rate;
  bucket = { tokens: Math.min(rate, bucket.tokens + refill), at: t };
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

/** Test hook. */
export function resetTpsBucket(): void {
  bucket = { tokens: 0, at: 0 };
}

/* --------------------------------------------------------------- shapes */

/** The API's own shape, both variants folded into one optional-field object. */
export interface RawCaseStatus {
  receiptNumber?: string;
  formType?: string;
  submittedDate?: string;
  modifiedDate?: string;
  current_case_status_text_en?: string;
  current_case_status_desc_en?: string;
  current_case_status_text_es?: string;
  current_case_status_desc_es?: string;
  hist_case_status?: Array<{ date?: string; completed_text_en?: string; completed_text_es?: string }>;
}

export interface UscisCaseStatus {
  receipt: string;
  formType: string | null;
  statusText: string;
  statusDesc: string;
  /** ISO `YYYY-MM-DDTHH:mm:ss`, from USCIS's `MM-DD-YYYY HH:mm:ss`; null for IOE. */
  submittedAt: string | null;
  modifiedAt: string | null;
  history: Array<{ date: string; text: string }>;
}

/**
 * Turn `MM-DD-YYYY HH:mm:ss` into ISO, or null. The example in the spec,
 * "09-05-2023 14:28:46", describes "September 5, 2023" in the same record, so
 * the field is month-first. Anything not matching is dropped rather than
 * guessed: a wrong date is worse than none.
 */
export function uscisDateToIso(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = /^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const [, mm, dd, yyyy, hh = "00", mi = "00", ss = "00"] = m;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

export function normaliseCaseStatus(raw: RawCaseStatus, receiptFallback: string): UscisCaseStatus | null {
  const statusText = raw.current_case_status_text_en?.trim();
  if (!statusText) return null;
  return {
    receipt: (raw.receiptNumber ?? receiptFallback).toUpperCase(),
    formType: raw.formType?.trim() || null,
    statusText,
    statusDesc: raw.current_case_status_desc_en?.trim() ?? "",
    submittedAt: uscisDateToIso(raw.submittedDate),
    modifiedAt: uscisDateToIso(raw.modifiedDate),
    history: (raw.hist_case_status ?? [])
      .filter((h) => typeof h.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.date))
      .map((h) => ({ date: h.date as string, text: h.completed_text_en?.trim() ?? "" })),
  };
}

/* ---------------------------------------------------------------- calls */

export type CaseStatusResult =
  | { kind: "ok"; status: UscisCaseStatus; raw: unknown }
  | { kind: "not_found" }
  | { kind: "invalid" }
  | { kind: "unauthorized" }
  | { kind: "rate_limited"; where: "uscis" | "local" }
  | { kind: "budget" }
  | { kind: "unavailable"; httpStatus: number | null }
  | { kind: "disabled" };

export interface ClientDeps {
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

/**
 * One receipt, one answer. Order of guards, cheapest first: configured at
 * all; the local TPS bucket; the shared daily budget (a write); then the
 * token; then USCIS.
 */
export async function fetchCaseStatus(receipt: string, deps: ClientDeps = {}): Promise<CaseStatusResult> {
  const env = uscisEnv();
  if (!env) return { kind: "disabled" };
  const now = deps.now ? deps.now() : new Date();
  const f = deps.fetchImpl ?? fetch;

  if (!takeTpsToken(env, now)) return { kind: "rate_limited", where: "local" };
  if (!(await underUscisDailyBudget(now, ENVS[env].dailyCap))) return { kind: "budget" };

  let token: string;
  try {
    token = await accessToken(env, now, f);
  } catch {
    return { kind: "unauthorized" };
  }

  let res: Response;
  try {
    res = await f(`${ENVS[env].caseStatusBase}/${encodeURIComponent(receipt)}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
  } catch {
    return { kind: "unavailable", httpStatus: null };
  }

  if (res.status === 200) {
    const json = (await res.json().catch(() => null)) as { case_status?: RawCaseStatus } | null;
    const status = json?.case_status ? normaliseCaseStatus(json.case_status, receipt) : null;
    if (!status) return { kind: "unavailable", httpStatus: 200 };
    return { kind: "ok", status, raw: json };
  }
  if (res.status === 404) return { kind: "not_found" };
  if (res.status === 422) return { kind: "invalid" };
  if (res.status === 401 || res.status === 403) {
    // A stale token is the common cause; drop it so the next call refreshes.
    cached = null;
    return { kind: "unauthorized" };
  }
  if (res.status === 429) return { kind: "rate_limited", where: "uscis" };
  return { kind: "unavailable", httpStatus: res.status };
}

/**
 * The undocumented endpoint. Returns whatever JSON it serves, or a refusal
 * kind, so its shape can be learned the day the keys arrive. Charged to the
 * same budget: USCIS counts every call.
 */
export async function fetchProcessingTimesRaw(
  path = "/",
  deps: ClientDeps = {},
): Promise<{ kind: "ok"; raw: unknown } | Exclude<CaseStatusResult, { kind: "ok" }>> {
  const env = uscisEnv();
  if (!env) return { kind: "disabled" };
  const now = deps.now ? deps.now() : new Date();
  const f = deps.fetchImpl ?? fetch;
  if (!takeTpsToken(env, now)) return { kind: "rate_limited", where: "local" };
  if (!(await underUscisDailyBudget(now, ENVS[env].dailyCap))) return { kind: "budget" };
  let token: string;
  try {
    token = await accessToken(env, now, f);
  } catch {
    return { kind: "unauthorized" };
  }
  let res: Response;
  try {
    res = await f(`${ENVS[env].processingTimesBase}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
  } catch {
    return { kind: "unavailable", httpStatus: null };
  }
  if (res.status === 200) return { kind: "ok", raw: await res.json().catch(() => null) };
  if (res.status === 404) return { kind: "not_found" };
  if (res.status === 401 || res.status === 403) {
    cached = null;
    return { kind: "unauthorized" };
  }
  if (res.status === 429) return { kind: "rate_limited", where: "uscis" };
  return { kind: "unavailable", httpStatus: res.status };
}

/** Exposed for the page and the handoff: the caps this client enforces. */
export function uscisLimits(env: UscisEnv): { tps: number; dailyCap: number } {
  return { tps: ENVS[env].tps, dailyCap: ENVS[env].dailyCap };
}
