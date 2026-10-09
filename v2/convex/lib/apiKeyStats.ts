/**
 * Counts of the API keys that work right now, for the admin's Developers tab
 * and the morning report. Pure: the caller passes the rows and the time.
 *
 * A key works when it isn't revoked, isn't past its lifetime, and isn't a
 * rotated key past its 24 hours. A key made before scopes existed carries the
 * default set, exactly as `hasScope` reads it.
 */
import { DEFAULT_SCOPES, type ApiScope } from "./apiPlans";

export interface KeyLike {
  scopes?: readonly string[];
  sandbox?: boolean;
  revokedAt?: number;
  expiresAt?: number;
  graceUntil?: number;
}

/** cases_write is reserved and never granted, so it's never counted. */
type GrantableScope = Exclude<ApiScope, "cases_write">;

export interface KeyCounts {
  /** Working live (pt_live_) keys. */
  live: number;
  /** Working sandbox (pt_test_) keys. */
  sandbox: number;
  /** Working keys, live and sandbox, carrying each scope. */
  byScope: Record<GrantableScope, number>;
}

export function keyWorks(k: KeyLike, now: number): boolean {
  if (k.revokedAt !== undefined) return false;
  if (k.expiresAt !== undefined && k.expiresAt <= now) return false;
  if (k.graceUntil !== undefined && k.graceUntil <= now) return false;
  return true;
}

export function keyCounts(keys: readonly KeyLike[], now: number): KeyCounts {
  const byScope: Record<GrantableScope, number> = { read: 0, export: 0, live_lookup: 0, webhooks: 0, cases_read: 0 };
  let live = 0;
  let sandbox = 0;
  for (const k of keys) {
    if (!keyWorks(k, now)) continue;
    if (k.sandbox) sandbox++;
    else live++;
    const scopes: readonly string[] = k.scopes ?? DEFAULT_SCOPES;
    for (const s of Object.keys(byScope) as GrantableScope[]) if (scopes.includes(s)) byScope[s]++;
  }
  return { live, sandbox, byScope };
}
