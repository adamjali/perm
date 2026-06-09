import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { isEmailPostHogExcluded } from "../lib/posthog";

const originalFetch = global.fetch;

// captureServerEvent forwards server-authoritative events to PostHog. It is
// best-effort: it must no-op without a key, honor the exclusion list (domain-aware),
// never leak PII into the event body, and never throw on a failed request.
describe("captureServerEvent (server-side PostHog)", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch as unknown as typeof fetch;
    // Key is read inside the handler (so beforeEach works); host is captured at
    // module load, so it stays at the default us.i.posthog.com here.
    process.env.POSTHOG_PROJECT_KEY = "phc_test_key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.POSTHOG_PROJECT_KEY;
    delete process.env.POSTHOG_EXCLUDED_EMAILS;
    vi.restoreAllMocks();
  });

  it("POSTs the event to PostHog with the key + matching distinct_id, and NO PII", async () => {
    const t = createTestContext();
    await t.action(internal.analytics.captureServerEvent, {
      event: "signup_verified",
      distinctId: "profile_123",
      email: "new@example.com",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://us.i.posthog.com/capture/");
    const rawBody = (init as RequestInit).body as string;
    const body = JSON.parse(rawBody);
    expect(body.api_key).toBe("phc_test_key");
    expect(body.event).toBe("signup_verified");
    expect(body.distinct_id).toBe("profile_123");
    // The email is used only for the exclusion check — it must NEVER reach PostHog.
    expect(rawBody).not.toContain("new@example.com");
    expect(body.properties?.email).toBeUndefined();
  });

  it("no-ops (no network call) when POSTHOG_PROJECT_KEY is absent", async () => {
    delete process.env.POSTHOG_PROJECT_KEY;
    const t = createTestContext();
    await t.action(internal.analytics.captureServerEvent, {
      event: "signup_verified",
      distinctId: "profile_123",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips an exact-match excluded email (POSTHOG_EXCLUDED_EMAILS), case-insensitively", async () => {
    process.env.POSTHOG_EXCLUDED_EMAILS = "admin@example.com, internal@example.com";
    const t = createTestContext();
    await t.action(internal.analytics.captureServerEvent, {
      event: "signup_verified",
      distinctId: "profile_admin",
      email: "Admin@example.com",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips a @domain-excluded email (parity with the client opt-out)", async () => {
    process.env.POSTHOG_EXCLUDED_EMAILS = "@permtracker.app";
    const t = createTestContext();
    await t.action(internal.analytics.captureServerEvent, {
      event: "signup_verified",
      distinctId: "profile_staff",
      email: "staff@permtracker.app",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("swallows a failed request (best-effort) without throwing", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    const t = createTestContext();
    await t.action(internal.analytics.captureServerEvent, {
      event: "signup_verified",
      distinctId: "profile_123",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not throw on a non-OK HTTP response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });
    const t = createTestContext();
    await t.action(internal.analytics.captureServerEvent, {
      event: "signup_verified",
      distinctId: "profile_123",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// Pure-function unit test for the shared exclusion rule — the single source of truth
// for both the client opt-out (users.isPostHogExcluded) and the server capture.
describe("isEmailPostHogExcluded", () => {
  it.each([
    ["exact match", "admin@example.com", "admin@example.com", true],
    ["exact match, case-insensitive", "Admin@Example.com", "admin@example.com", true],
    ["domain match (@suffix)", "staff@permtracker.app", "@permtracker.app", true],
    ["domain rule does not match other domains", "user@gmail.com", "@permtracker.app", false],
    ["exact rule does not match a different address", "other@example.com", "admin@example.com", false],
    ["one of several entries matches", "x@permtracker.app", "a@b.com, @permtracker.app", true],
  ])("%s", (_label, email, csv, expected) => {
    expect(isEmailPostHogExcluded(email, csv)).toBe(expected);
  });

  it("returns false when email or list is missing", () => {
    expect(isEmailPostHogExcluded(undefined, "@permtracker.app")).toBe(false);
    expect(isEmailPostHogExcluded("a@b.com", undefined)).toBe(false);
    expect(isEmailPostHogExcluded("a@b.com", "")).toBe(false);
  });
});
