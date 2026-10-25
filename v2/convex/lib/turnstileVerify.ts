/**
 * One Turnstile check, without the Node runtime, for an HTTP route (the contact
 * form). The sign-up's check (convex/turnstile.ts) also issues a one-time pass;
 * this one only answers whether the token is good.
 *
 * Four answers, so a caller can tell a bot from an outage: "pass", "fail" (the
 * token is bad, used, expired, or for another form), "missing" (no token sent)
 * and "unreachable" (Cloudflare didn't answer, or no key is set). A token can be
 * checked once and is good for 300 seconds (Cloudflare's siteverify docs).
 */

const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's always-pass test secret, for local dev with no key set. */
const TEST_SECRET_ALWAYS_PASS = "1x0000000000000000000000000000000AA";

export type TurnstileResult = "pass" | "fail" | "missing" | "unreachable";

export async function checkTurnstile(
  token: unknown,
  opts: { action?: string; remoteIp?: string; fetchImpl?: typeof fetch } = {},
): Promise<TurnstileResult> {
  if (typeof token !== "string" || token.trim().length === 0) return "missing";
  if (token.length > 2048) return "fail";
  const secret = process.env.TURNSTILE_SECRET_KEY || (process.env.NODE_ENV === "production" ? "" : TEST_SECRET_ALWAYS_PASS);
  if (!secret) return "unreachable";
  const body = new URLSearchParams({ secret, response: token });
  if (opts.remoteIp && opts.remoteIp !== "unknown") body.set("remoteip", opts.remoteIp);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await (opts.fetchImpl ?? fetch)(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!res.ok) return "unreachable";
    const data = (await res.json()) as { success?: boolean; action?: string; "error-codes"?: string[] };
    if (!data.success) {
      // Cloudflare's own fault is an outage, not a bot.
      return (data["error-codes"] ?? []).includes("internal-error") ? "unreachable" : "fail";
    }
    if (opts.action && data.action && data.action !== opts.action) return "fail";
    return "pass";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}
