/**
 * Who is calling: a key's holder, or nobody in particular.
 *
 * A key arrives as `Authorization: Bearer pt_live_...` (or `X-API-Key`, for
 * clients that can only set a custom header). Never in the address: a key in
 * a URL ends up in logs and browser history. A `pt_test_` key is a sandbox
 * key: the routes answer it from fixed sample data.
 *
 * The cheap check runs first: a string that isn't key-shaped, or whose
 * checksum doesn't match, is refused without asking Convex. A well-formed key
 * is checked by its SHA-256 against Convex (apiKeys.verify) and the answer is
 * kept for 60 seconds, so a revoked key stops within a minute; a revoke or a
 * rotation also clears the cached answer at once (`forgetKeys`, through
 * /api/revalidate-api-key). The times a key stops on its own (its expiry, the
 * end of a rotation's 24 hours) are compared here, on every call, with this
 * server's clock.
 */
import "server-only";

import { fetchQuery } from "convex/nextjs";

import { api } from "@convex/_generated/api";
import { hashApiKey, parseApiKey } from "@convex/lib/apiKeyFormat";
import { apiPlan, isApiScope, type ApiPlan, type ApiPlanId, type ApiScope } from "@convex/lib/apiPlans";
import { checkedLabel } from "@/lib/time";

export type ApiCaller =
  | {
      kind: "key";
      keyId: string;
      account: string;
      /** The limits that apply now: Plus for everyone while the paywall is off. */
      plan: ApiPlan;
      /** The plan the account itself is on. */
      accountPlan: ApiPlanId;
      /** Whether the account's own plan decides (the switch is Convex's PAYWALL_ENFORCED). */
      paywall: boolean;
      scopes: ApiScope[];
      /** A pt_test_ key: fixed sample data, nothing counted. */
      sandbox: boolean;
      /** When the key stops on its own, if it does. */
      expiresAt: number | null;
    }
  | { kind: "anonymous" };

export type AuthOutcome =
  | { ok: true; caller: ApiCaller }
  | { ok: false; code: "invalid_key" | "revoked_key" | "expired_key" | "key_check_failed"; message: string };

type Verified = Awaited<ReturnType<typeof verifyRemote>>;

const TTL_MS = 60_000;
const MAX_CACHED = 10_000;
const cache = new Map<string, { at: number; value: Verified }>();

async function verifyRemote(keyHash: string) {
  return await fetchQuery(api.apiKeys.verify, { keyHash });
}

/** The key the request carries, or null when it carries none. */
export function presentedKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  // "Bearer" with nothing after it is no key: the Claude Code plugin sends
  // exactly that when its optional key is left empty.
  if (auth && /^Bearer\s*$/i.test(auth.trim())) return null;
  if (auth) {
    const m = /^Bearer\s+(\S+)\s*$/i.exec(auth);
    return m ? m[1]! : auth.trim();
  }
  const header = request.headers.get("x-api-key");
  return header ? header.trim() : null;
}

export async function authenticate(request: Request, now = Date.now()): Promise<AuthOutcome> {
  const raw = presentedKey(request);
  if (!raw) return { ok: true, caller: { kind: "anonymous" } };

  const parsed = raw.length <= 100 ? parseApiKey(raw) : null;
  if (!parsed) {
    return {
      ok: false,
      code: "invalid_key",
      message: "That isn't a PERM Tracker API key. Keys start with pt_live_ (or pt_test_ for sandbox keys) and are 46 characters long.",
    };
  }

  const keyHash = await hashApiKey(parsed.key);
  let hit = cache.get(keyHash);
  if (!hit || now - hit.at > TTL_MS) {
    let value: Verified;
    try {
      value = await verifyRemote(keyHash);
    } catch (err) {
      // A key we couldn't check is neither accepted nor called invalid.
      console.error("[apiAuth] verify failed", err instanceof Error ? err.message : err);
      return {
        ok: false,
        code: "key_check_failed",
        message: "We couldn't check your key just now. Try again in a minute.",
      };
    }
    if (cache.size > MAX_CACHED) cache.clear();
    hit = { at: now, value };
    cache.set(keyHash, hit);
  }

  const v = hit.value;
  if (!v) {
    return { ok: false, code: "invalid_key", message: "This key isn't recognised. Make a new one in Settings, under API keys." };
  }
  if (v.revoked) {
    return { ok: false, code: "revoked_key", message: "This key was revoked. Make a new one in Settings, under API keys." };
  }
  const expiresAt = typeof v.expiresAt === "number" ? v.expiresAt : null;
  if (expiresAt !== null && now >= expiresAt) {
    return {
      ok: false,
      code: "expired_key",
      message: `This key expired at ${checkedLabel(expiresAt)}. Make a new one in Settings, under API keys.`,
    };
  }
  const graceUntil = typeof v.graceUntil === "number" ? v.graceUntil : null;
  if (graceUntil !== null && now >= graceUntil) {
    return {
      ok: false,
      code: "revoked_key",
      message: `This key was rotated and stopped working at ${checkedLabel(graceUntil)}. Use the key that replaced it.`,
    };
  }
  return {
    ok: true,
    caller: {
      kind: "key",
      keyId: v.keyId,
      account: v.account,
      plan: apiPlan(v.plan),
      accountPlan: apiPlan(v.accountPlan).id,
      paywall: v.paywall === true,
      // A Convex deployment older than scopes answers without them: the default set.
      scopes: Array.isArray(v.scopes) ? v.scopes.filter(isApiScope) : ["read", "export", "live_lookup", "webhooks"],
      sandbox: v.sandbox === true || parsed.sandbox,
      expiresAt,
    },
  };
}

/**
 * Drop the cached answers for these keys, so the next call asks Convex. Called
 * when a key is revoked or rotated (POST /api/revalidate-api-key), on both
 * copies of the site.
 */
export function forgetKeys(keyIds: readonly string[]): number {
  const drop = new Set(keyIds);
  let n = 0;
  for (const [hash, hit] of cache) {
    if (hit.value && drop.has(hit.value.keyId)) {
      cache.delete(hash);
      n++;
    }
  }
  return n;
}

/** Test seam. */
export function clearKeyCacheForTests(): void {
  cache.clear();
}
