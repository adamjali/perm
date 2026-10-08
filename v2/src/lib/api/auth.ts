/**
 * Who is calling: a key's holder, or nobody in particular.
 *
 * A key arrives as `Authorization: Bearer pt_live_...` (or `X-API-Key`, for
 * clients that can only set a custom header). Never in the address: a key in
 * a URL ends up in logs and browser history.
 *
 * The cheap check runs first: a string that isn't key-shaped, or whose
 * checksum doesn't match, is refused without asking Convex. A well-formed key
 * is checked by its SHA-256 against Convex (apiKeys.verify) and the answer is
 * kept for 60 seconds, so a revoked key stops within a minute.
 */
import "server-only";

import { fetchQuery } from "convex/nextjs";

import { api } from "@convex/_generated/api";
import { hashApiKey, parseApiKey } from "@convex/lib/apiKeyFormat";
import { apiPlan, type ApiPlan } from "@convex/lib/apiPlans";

export type ApiCaller =
  | { kind: "key"; keyId: string; account: string; plan: ApiPlan }
  | { kind: "anonymous" };

export type AuthOutcome =
  | { ok: true; caller: ApiCaller }
  | { ok: false; code: "invalid_key" | "revoked_key" | "key_check_failed"; message: string };

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
      message: "That isn't a PERM Tracker API key. Keys start with pt_live_ and are 46 characters long.",
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
  return { ok: true, caller: { kind: "key", keyId: v.keyId, account: v.account, plan: apiPlan(v.plan) } };
}

/** Test seam. */
export function clearKeyCacheForTests(): void {
  cache.clear();
}
