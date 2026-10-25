/**
 * The contact form's Turnstile check tells a bad token from an outage: a bad
 * one is refused, an outage only adds weight to the spam check.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkTurnstile } from "./turnstileVerify";

const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

afterEach(() => vi.unstubAllEnvs());

describe("checkTurnstile", () => {
  it("passes a good token for this form", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(await checkTurnstile("tok", { action: "contact", fetchImpl: answer({ success: true, action: "contact" }) })).toBe("pass");
  });

  it("fails a bad token, and one made for another form", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(await checkTurnstile("tok", { fetchImpl: answer({ success: false, "error-codes": ["timeout-or-duplicate"] }) })).toBe("fail");
    expect(await checkTurnstile("tok", { action: "contact", fetchImpl: answer({ success: true, action: "signup" }) })).toBe("fail");
    expect(await checkTurnstile("x".repeat(3000))).toBe("fail");
  });

  it("says missing when no token came", async () => {
    expect(await checkTurnstile(undefined)).toBe("missing");
    expect(await checkTurnstile("  ")).toBe("missing");
  });

  it("calls Cloudflare's own faults an outage, not a bot", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(await checkTurnstile("tok", { fetchImpl: answer({}, 503) })).toBe("unreachable");
    expect(await checkTurnstile("tok", { fetchImpl: answer({ success: false, "error-codes": ["internal-error"] }) })).toBe("unreachable");
    const down = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    expect(await checkTurnstile("tok", { fetchImpl: down })).toBe("unreachable");
  });

  it("has no secret to check with in production without the key", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(await checkTurnstile("tok", { fetchImpl: answer({ success: true }) })).toBe("unreachable");
  });
});
