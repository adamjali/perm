import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// C4 — force recordContactEvent to throw so we can assert the webhook returns
// 5xx (so svix/Resend redelivers) instead of swallowing the failure as 200.
// vi.mock is hoisted file-wide; the C1 tests below don't touch this mutation,
// so the throwing stub is harmless to them.
// ---------------------------------------------------------------------------
vi.mock("../marketingWebhook", async (importOriginal) => {
  // Partial mock: keep every real export (http.ts + schema.ts import
  // isLiveContactEventType / contactEventTypeValidator / LIVE_CONTACT_EVENT_TYPES
  // from here) and override ONLY recordContactEvent so the C4 webhook path can
  // exercise the internal-write-failure branch.
  const actual = await importOriginal<typeof import("../marketingWebhook")>();
  const { internalMutation } = await import("../_generated/server");
  const { v } = await import("convex/values");
  return {
    ...actual,
    recordContactEvent: internalMutation({
      args: {
        svixId: v.string(),
        email: v.string(),
        contactId: v.string(),
        audienceId: v.optional(v.string()),
        eventType: v.union(
          v.literal("contact.created"),
          v.literal("contact.updated"),
          v.literal("contact.deleted"),
          v.literal("contact.backfill"),
        ),
        unsubscribed: v.boolean(),
        occurredAt: v.number(),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        rawPayload: v.string(),
      },
      handler: async () => {
        throw new Error("simulated DB write failure");
      },
    }),
  };
});

import { Webhook } from "svix";
import { createTestContext } from "../../test-utils/convex";
import { api } from "../_generated/api";

const TEST_WEBHOOK_SECRET = Buffer.from("perm-tracker-test-secret-1234").toString("base64");

function signWebhook(rawBody: string): {
  "svix-id": string;
  "svix-timestamp": string;
  "svix-signature": string;
} {
  const wh = new Webhook(TEST_WEBHOOK_SECRET);
  const svixId = `msg_${Math.random().toString(36).slice(2)}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = wh.sign(svixId, new Date(Number(timestamp) * 1000), rawBody);
  return {
    "svix-id": svixId,
    "svix-timestamp": timestamp,
    "svix-signature": signature,
  };
}

const originalFetch = global.fetch;

// ============================================================================
// C1 — IDOR: subscription actions must operate on the CALLER's own email,
// never the client-supplied `email` arg.
// ============================================================================

describe("marketingEmail subscription actions — IDOR protection (C1)", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.AUTH_RESEND_KEY = "re_test_key";
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.AUTH_RESEND_KEY;
    vi.clearAllMocks();
  });

  /** Seed a user with a known email and return an identity-scoped context. */
  async function seedCaller(t: ReturnType<typeof createTestContext>, email: string) {
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { name: "Caller", email }),
    );
    return { userId, ctx: t.withIdentity({ subject: userId as string }) };
  }

  it("getMarketingSubscriptionStatus queries the CALLER's email, ignoring the victim email arg", async () => {
    const t = createTestContext();
    const { ctx } = await seedCaller(t, "caller@example.com");

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ unsubscribed: false }),
      text: async () => "{}",
    });

    // Caller passes a VICTIM's email, attempting to read someone else's status.
    const result = await ctx.action(api.marketingEmail.getMarketingSubscriptionStatus, {
      email: "victim@firm.com",
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl] = mockFetch.mock.calls[0] as [string];
    // Resend was hit with the CALLER's own email, not the victim's.
    expect(calledUrl).toContain(encodeURIComponent("caller@example.com"));
    expect(calledUrl).not.toContain("victim%40firm.com");
    expect(calledUrl).not.toContain("victim@firm.com");
  });

  it("updateMarketingSubscription patches the CALLER's email, ignoring the victim email arg", async () => {
    const t = createTestContext();
    const { ctx } = await seedCaller(t, "owner@example.com");

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "{}",
    });

    // Caller tries to unsubscribe a victim by passing their email.
    const result = await ctx.action(api.marketingEmail.updateMarketingSubscription, {
      email: "victim@firm.com",
      subscribed: false,
    });

    expect(result).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain(encodeURIComponent("owner@example.com"));
    expect(calledUrl).not.toContain("victim");
    expect(calledInit.method).toBe("PATCH");
    expect(JSON.parse(calledInit.body as string)).toEqual({ unsubscribed: true });
  });

  it("getMarketingSubscriptionStatus returns null for an unauthenticated caller (no Resend call)", async () => {
    const t = createTestContext();

    const result = await t.action(api.marketingEmail.getMarketingSubscriptionStatus, {
      email: "anyone@firm.com",
    });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("updateMarketingSubscription throws for an unauthenticated caller (no Resend call)", async () => {
    const t = createTestContext();

    await expect(
      t.action(api.marketingEmail.updateMarketingSubscription, {
        email: "anyone@firm.com",
        subscribed: true,
      }),
    ).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when the authenticated user has no email on record (no Resend call)", async () => {
    const t = createTestContext();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { name: "No Email" }),
    );
    const ctx = t.withIdentity({ subject: userId as string });

    const result = await ctx.action(api.marketingEmail.getMarketingSubscriptionStatus, {
      email: "spoofed@firm.com",
    });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ============================================================================
// C4 — webhook returns 5xx (not 200) when the internal write fails, so
// svix/Resend redelivers and the by_svix_id dedup recovers the audit event.
// ============================================================================

describe("/resend-inbound returns 5xx on internal write failure (C4)", () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  });
  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  it("returns 500 when recordContactEvent throws (lets Resend retry)", async () => {
    const t = createTestContext();
    const rawBody = JSON.stringify({
      type: "contact.deleted",
      created_at: "2026-04-15T16:47:45.000Z",
      data: {
        id: "c_fail",
        email: "retry@example.com",
        unsubscribed: true,
        created_at: "2026-04-15T16:47:45.000Z",
      },
    });

    const res = await t.fetch("/resend-inbound", {
      method: "POST",
      headers: { ...signWebhook(rawBody), "Content-Type": "application/json" },
      body: rawBody,
    });

    // 5xx → svix/Resend redelivers with the same svix-id (dedup-safe).
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.status).toBe(500);
  });
});
