import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("convex/nextjs", () => ({ fetchQuery: vi.fn() }));

const { presentedKey } = await import("../auth");

const req = (headers: Record<string, string>) => new Request("https://permtracker.app/v1/queue", { headers });

describe("presentedKey", () => {
  it("reads a Bearer key, and an X-API-Key header", () => {
    expect(presentedKey(req({ authorization: "Bearer pt_live_abc" }))).toBe("pt_live_abc");
    expect(presentedKey(req({ "x-api-key": " pt_live_abc " }))).toBe("pt_live_abc");
  });

  it("treats an empty Bearer as no key: the Claude Code plugin sends it when its key is left blank", () => {
    expect(presentedKey(req({ authorization: "Bearer " }))).toBeNull();
    expect(presentedKey(req({ authorization: "bearer" }))).toBeNull();
    expect(presentedKey(req({}))).toBeNull();
  });
});

describe("authenticate", async () => {
  const { fetchQuery } = await import("convex/nextjs");
  const { authenticate, clearKeyCacheForTests, forgetKeys } = await import("../auth");
  const { buildApiKey } = await import("@convex/lib/apiKeyFormat");
  const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
  const verify = vi.mocked(fetchQuery);
  const live = (over: Record<string, unknown> = {}) => ({
    keyId: "KEY00001",
    revoked: false,
    account: "acct_a",
    plan: "plus",
    accountPlan: "free",
    paywall: false,
    scopes: ["read", "export"],
    sandbox: false,
    expiresAt: null,
    graceUntil: null,
    ...over,
  });
  const call = (key: string, now = Date.now()) => authenticate(req({ authorization: `Bearer ${key}` }), now);

  it("carries the plan that applies, the account's own plan, the scopes and the kind", async () => {
    clearKeyCacheForTests();
    verify.mockResolvedValueOnce(live());
    const r = await call(buildApiKey(random));
    expect(r).toMatchObject({
      ok: true,
      caller: { kind: "key", plan: { id: "plus" }, accountPlan: "free", paywall: false, scopes: ["read", "export"], sandbox: false },
    });
  });

  it("refuses a key past its expiry, saying when it ended", async () => {
    clearKeyCacheForTests();
    const now = Date.UTC(2026, 9, 9, 16, 0);
    verify.mockResolvedValueOnce(live({ expiresAt: now - 1 }));
    const r = await call(buildApiKey(random), now);
    expect(r).toMatchObject({ ok: false, code: "expired_key" });
    expect(r.ok ? "" : r.message).toMatch(/expired at 11:59 AM ET, Oct 9/);
  });

  it("keeps a rotated key working until its 24 hours end, then refuses it", async () => {
    clearKeyCacheForTests();
    const key = buildApiKey(random);
    const end = Date.UTC(2026, 9, 10, 16, 0);
    verify.mockResolvedValue(live({ graceUntil: end }));
    expect((await call(key, end - 1000)).ok).toBe(true);
    expect(await call(key, end)).toMatchObject({ ok: false, code: "revoked_key" });
    verify.mockReset();
  });

  it("marks a pt_test_ key as sandbox", async () => {
    clearKeyCacheForTests();
    verify.mockResolvedValueOnce(live({ sandbox: true }));
    const r = await call(buildApiKey(random, true));
    expect(r).toMatchObject({ ok: true, caller: { sandbox: true } });
  });

  it("asks Convex again once a key is forgotten, as a revoke does", async () => {
    clearKeyCacheForTests();
    verify.mockReset();
    const key = buildApiKey(random);
    verify.mockResolvedValueOnce(live());
    expect((await call(key)).ok).toBe(true);
    expect((await call(key)).ok).toBe(true); // cached: Convex asked once
    expect(verify).toHaveBeenCalledTimes(1);
    expect(forgetKeys(["KEY00001"])).toBe(1);
    verify.mockResolvedValueOnce({ keyId: "KEY00001", revoked: true });
    expect(await call(key)).toMatchObject({ ok: false, code: "revoked_key" });
    verify.mockReset();
  });
});
