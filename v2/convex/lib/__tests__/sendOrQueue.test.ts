/**
 * `sendOrQueue` (convex/lib/email.ts): the one path every email but a sign-in
 * code takes since Sep 29 2026. It checks the day's count, sends, records the
 * count, and keeps a send that failed for a fixable reason instead of
 * dropping it. Driven with a fake action ctx and a fake Resend client, so each
 * branch is pinned without a network.
 */
import { getFunctionName } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import type { Resend } from "resend";

import { sendOrQueue } from "../email";
import {
  LIST_CEILING,
  RESEND_DAILY_CAP,
  isQuotaError,
  isRetryableSendError,
  msToNextUtcDay,
  nextRetryAt,
  utcDay,
} from "../emailLimits";

type Call = { fn: string; args: Record<string, unknown> };

function fakeCtx(used: number, enqueueOk = true) {
  const calls: Call[] = [];
  const ctx = {
    runQuery: vi.fn(async () => used),
    runMutation: vi.fn(async (ref: unknown, args: Record<string, unknown>) => {
      const fn = getFunctionName(ref as never);
      calls.push({ fn, args });
      if (fn === "emailLedger:enqueueRetry") return enqueueOk ? { ok: true } : { ok: false, reason: "retry queue full" };
      return null;
    }),
  };
  return { ctx: ctx as never, calls };
}

function fakeResend(reply: () => unknown) {
  const send = vi.fn(async () => reply());
  return { resend: { emails: { send } } as unknown as Resend, send };
}

const params = { from: "PERM Tracker <n@permtracker.app>", to: "a@example.com", subject: "Hi", html: "<p>x</p>" };

describe("sendOrQueue", () => {
  it("sends, then records the send with Resend's own count", async () => {
    const { ctx, calls } = fakeCtx(10);
    const { resend, send } = fakeResend(() => ({ data: { id: "e1" }, error: null, headers: { "x-resend-daily-quota": "11" } }));
    const out = await sendOrQueue(ctx, "alert", resend, params);
    expect(out.error).toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([{ fn: "emailLedger:recordSend", args: { quota: 11 } }]);
  });

  it("keeps a send Resend refused for a fixable reason, and the caller sees no error", async () => {
    const { ctx, calls } = fakeCtx(10);
    const { resend } = fakeResend(() => ({ data: null, error: { name: "application_error", message: "Resend is down" } }));
    const out = await sendOrQueue(ctx, "case-confirmation", resend, params);
    expect(out).toEqual({ queued: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.fn).toBe("emailLedger:enqueueRetry");
    expect(calls[0]!.args).toMatchObject({ kind: "case-confirmation", to: "a@example.com", quota: false });
    expect(JSON.parse(calls[0]!.args.payload as string)).toEqual(params);
  });

  it("a quota refusal is kept to wait for the next day", async () => {
    const { ctx, calls } = fakeCtx(10);
    const { resend } = fakeResend(() => ({
      data: null,
      error: { name: "daily_quota_exceeded", message: "You have exceeded your daily email sending quota." },
    }));
    expect(await sendOrQueue(ctx, "digest", resend, params)).toEqual({ queued: true });
    expect(calls[0]!.args.quota).toBe(true);
  });

  it("returns a failure no retry can fix, and keeps nothing", async () => {
    const { ctx, calls } = fakeCtx(10);
    const { resend } = fakeResend(() => ({ data: null, error: { name: "validation_error", message: "Invalid `to` field" } }));
    const out = await sendOrQueue(ctx, "alert", resend, params);
    expect(out.error?.name).toBe("validation_error");
    expect(calls).toHaveLength(0);
  });

  it("at the day's list ceiling it doesn't try, it queues for the next day", async () => {
    const { ctx, calls } = fakeCtx(LIST_CEILING);
    const { resend, send } = fakeResend(() => ({ data: { id: "e1" }, error: null }));
    expect(await sendOrQueue(ctx, "digest", resend, params)).toEqual({ queued: true });
    expect(send).not.toHaveBeenCalled();
    expect(calls[0]!.args.quota).toBe(true);
  });

  it("admin mail may use the whole day, up to Resend's own cap", async () => {
    const { ctx } = fakeCtx(LIST_CEILING + 5);
    const { resend, send } = fakeResend(() => ({ data: { id: "e1" }, error: null }));
    await sendOrQueue(ctx, "daily-report", resend, params, { priority: "high" });
    expect(send).toHaveBeenCalledTimes(1);

    const full = fakeCtx(RESEND_DAILY_CAP);
    const r2 = fakeResend(() => ({ data: { id: "e2" }, error: null }));
    expect(await sendOrQueue(full.ctx, "daily-report", r2.resend, params, { priority: "high" })).toEqual({ queued: true });
    expect(r2.send).not.toHaveBeenCalled();
  });

  it("when the retry queue can't keep it, the original error comes back", async () => {
    const { ctx } = fakeCtx(10, false);
    const { resend } = fakeResend(() => ({ data: null, error: { name: "application_error", message: "down" } }));
    const out = await sendOrQueue(ctx, "alert", resend, params);
    expect(out.error?.name).toBe("application_error");
  });

  it("never sends to or queues a blocklisted recipient", async () => {
    vi.stubEnv("BLOCKED_EMAILS", "blocked@example.com");
    try {
      const { ctx, calls } = fakeCtx(10);
      const { resend, send } = fakeResend(() => ({ data: { id: "e1" }, error: null }));
      const out = await sendOrQueue(ctx, "alert", resend, { ...params, to: "blocked@example.com" });
      expect(out.error?.name).toBe("EmailBlocked");
      expect(send).not.toHaveBeenCalled();
      expect(calls).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("the limits' arithmetic", () => {
  it("names which failures are worth keeping", () => {
    for (const name of ["daily_quota_exceeded", "rate_limit_exceeded", "application_error", "internal_server_error", "TypeError", "invalid_api_key"]) {
      expect(isRetryableSendError({ name, message: "" })).toBe(true);
    }
    for (const name of ["EmailBlocked", "validation_error", "missing_required_field"]) {
      expect(isRetryableSendError({ name, message: "" })).toBe(false);
    }
    expect(isQuotaError({ name: "monthly_quota_exceeded", message: "" })).toBe(true);
    expect(isQuotaError({ name: "application_error", message: "server error" })).toBe(false);
  });

  it("backs off 5, 15, 60, 180 minutes, then every 8 hours; a quota wait ends after midnight UTC", () => {
    const now = Date.UTC(2026, 8, 29, 18, 0);
    expect([0, 1, 2, 3, 4, 9].map((a) => (nextRetryAt(a, now, false) - now) / 60_000)).toEqual([5, 15, 60, 180, 480, 480]);
    expect(nextRetryAt(0, now, true)).toBe(Date.UTC(2026, 8, 30, 0, 5));
    expect(msToNextUtcDay(now)).toBe(6 * 60 * 60 * 1000);
    expect(utcDay(Date.UTC(2026, 8, 30, 0, 1))).toBe("2026-09-30");
  });
});
