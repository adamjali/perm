import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConvexError } from "convex/values";

// ---------------------------------------------------------------------------
// C3 — when the OTP / password-reset email FAILS to send, the provider must:
//   1. record the failure to the error pipeline (recordError), and
//   2. throw a ConvexError so the auth UI surfaces a real error instead of
//      silently advancing the user to a code-entry screen for a code that
//      never arrived.
//
// These are @convex-dev/auth Email() providers; sendVerificationRequest is a
// plain async fn we call directly with a stub ctx. We mock the `resend` SDK to
// control success/failure.
//
// We deliberately do NOT mock ../lib/errorRecording: the convex project runs
// with isolate:false (shared module registry), so a module-level mock there
// would bleed into other files' recordError calls and corrupt call counts.
// Instead, recordError is real and its only side effect on our stub ctx is
// ctx.scheduler.runAfter(...) — so we assert on OUR OWN fakeCtx scheduler spy,
// which no other test can touch.
// ---------------------------------------------------------------------------

// vi.mock factories are hoisted above module-scope consts, so the shared mock
// handle must be created via vi.hoisted to be available inside the factory.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

// React-email render is irrelevant to this contract — stub it to avoid pulling
// the full renderer into edge-runtime and to keep the test focused on the
// failure-handling branch.
vi.mock("@react-email/render", () => ({
  render: vi.fn(async () => "<html>code</html>"),
}));

// The convex project runs with isolate:false (shared module registry) and
// auth.ts imports both providers eagerly — so they may already be evaluated
// against the REAL resend SDK before this file's vi.mock takes effect. Import
// the providers DYNAMICALLY inside each test (after mocks are hoisted) so they
// always bind to the mocked SDK regardless of load order.
async function loadProvider(name: "otp" | "reset") {
  if (name === "otp") {
    return {
      provider: (await import("../ResendOTP")).ResendOTP,
      op: "ResendOTP.send",
    };
  }
  return {
    provider: (await import("../ResendPasswordReset")).ResendPasswordReset,
    op: "ResendPasswordReset.send",
  };
}

const providers = [
  { name: "ResendOTP", key: "otp" as const },
  { name: "ResendPasswordReset", key: "reset" as const },
] as const;

/** Fresh stub ctx per call so scheduler.runAfter call counts are isolated. */
function makeCtx() {
  return {
    scheduler: { runAfter: vi.fn(async () => null) },
  } as never;
}

/**
 * Invoke a provider's sendVerificationRequest with (params, ctx).
 *
 * The @auth/core EmailConfig type declares sendVerificationRequest as a
 * single-param fn, but @convex-dev/auth passes the action ctx as a 2nd runtime
 * arg (it does so under its own @ts-expect-error in signIn.js), and our providers
 * accept that optional ctx to drive recordError. We mirror the real 2-arg runtime
 * signature here so the test exercises the recordError-via-ctx path type-safely.
 */
type SendVerificationRequestWithCtx = (
  params: { identifier: string; token: string },
  ctx: ReturnType<typeof makeCtx>,
) => Promise<void>;

function sendWithCtx(
  provider: { sendVerificationRequest?: unknown },
  params: { identifier: string; token: string },
  ctx: ReturnType<typeof makeCtx>,
): Promise<void> {
  return (provider.sendVerificationRequest as SendVerificationRequestWithCtx)(params, ctx);
}

describe("Resend email providers — send-failure handling (C3)", () => {
  // Synthetic fixture. Real blocklist entries are real people's addresses and
  // live only in the BLOCKED_EMAILS env var, never in this public repo.
  // See convex/lib/emailBlocklist.ts.
  const BLOCKED_RECIPIENT = "blocked@example.com";

  beforeEach(() => {
    process.env.AUTH_RESEND_KEY = "re_test_key";
    process.env.BLOCKED_EMAILS = BLOCKED_RECIPIENT;
    vi.resetModules();
    sendMock.mockReset();
  });

  afterEach(() => {
    delete process.env.AUTH_RESEND_KEY;
    delete process.env.BLOCKED_EMAILS;
  });

  function schedulerOf(ctx: unknown) {
    return (ctx as { scheduler: { runAfter: ReturnType<typeof vi.fn> } }).scheduler;
  }

  describe.each(providers)("$name", ({ key }) => {
    it("records the error AND throws ConvexError when the send fails", async () => {
      sendMock.mockResolvedValue({ error: { message: "Resend 422 invalid" } });
      const { provider, op } = await loadProvider(key);
      const ctx = makeCtx();

      await expect(
        sendWithCtx(provider, { identifier: "user@example.com", token: "ABCDEF123456" }, ctx),
      ).rejects.toBeInstanceOf(ConvexError);

      // recordError ran against OUR ctx: it schedules systemErrors.record +
      // a Sentry report → two runAfter calls. Assert the failure was recorded
      // (the exact op label travels in the scheduled args).
      expect(schedulerOf(ctx).runAfter).toHaveBeenCalled();
      const opsScheduled = schedulerOf(ctx).runAfter.mock.calls.map(
        (c) => (c[2] as { operation?: string })?.operation,
      );
      expect(opsScheduled).toContain(op);
    });

    it("does NOT silently advance the user (the thrown error is user-facing)", async () => {
      sendMock.mockResolvedValue({ error: { message: "boom" } });
      const { provider } = await loadProvider(key);

      await expect(
        sendWithCtx(provider, { identifier: "user@example.com", token: "ABCDEF123456" }, makeCtx()),
      ).rejects.toThrow(/couldn't send/i);
    });

    it("resolves silently and records nothing on a successful send", async () => {
      sendMock.mockResolvedValue({ error: null });
      const { provider } = await loadProvider(key);
      const ctx = makeCtx();

      await expect(
        sendWithCtx(provider, { identifier: "user@example.com", token: "ABCDEF123456" }, ctx),
      ).resolves.toBeUndefined();

      expect(sendMock).toHaveBeenCalledTimes(1);
      // No error path → recordError never ran → no work scheduled on our ctx.
      expect(schedulerOf(ctx).runAfter).not.toHaveBeenCalled();
    });

    it("skips blocklisted recipients entirely (no send, no error)", async () => {
      const { provider } = await loadProvider(key);
      const ctx = makeCtx();

      await expect(
        sendWithCtx(provider, { identifier: BLOCKED_RECIPIENT, token: "ABCDEF123456" }, ctx),
      ).resolves.toBeUndefined();

      expect(sendMock).not.toHaveBeenCalled();
      expect(schedulerOf(ctx).runAfter).not.toHaveBeenCalled();
    });
  });
});
