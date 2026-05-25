import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Webhook } from "svix";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";

/**
 * svix secret used to sign test webhook payloads. Must be base64 (svix
 * accepts a raw base64 secret). The httpAction reads RESEND_WEBHOOK_SECRET.
 */
const TEST_WEBHOOK_SECRET = Buffer.from("perm-tracker-test-secret-1234").toString("base64");

/** Sign a raw payload exactly the way Resend (svix) would. */
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

/**
 * Realistic payload shape pulled directly from Resend docs (April 2026):
 * https://resend.com/docs/webhooks/contacts/updated
 */
type ContactEventType = "contact.created" | "contact.updated" | "contact.deleted";

function makePayload(opts: {
  type?: ContactEventType;
  email?: string;
  unsubscribed?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  audienceId?: string | null;
} = {}): {
  type: ContactEventType;
  created_at: string;
  data: {
    id: string;
    audience_id?: string | null;
    segment_ids: string[];
    created_at: string;
    updated_at: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    unsubscribed: boolean;
  };
} {
  return {
    type: opts.type ?? "contact.updated",
    created_at: "2026-04-15T16:47:45.000Z",
    data: {
      id: "00000000-0000-4000-8000-000000000001",
      audience_id:
        opts.audienceId === null
          ? null
          : (opts.audienceId ?? "00000000-0000-4000-8000-0000000000a1"),
      segment_ids: ["260e591b-971e-4e2e-b52e-edba5b369dbb"],
      created_at: "2026-04-10T15:11:54.110Z",
      updated_at: "2026-04-15T16:47:45.000Z",
      email: opts.email ?? "test@example.com",
      first_name: opts.firstName === undefined ? "Test" : opts.firstName,
      last_name: opts.lastName === undefined ? "User" : opts.lastName,
      unsubscribed: opts.unsubscribed ?? true,
    },
  };
}

describe("marketingWebhook.recordContactEvent", () => {
  describe("insert", () => {
    it("inserts a new record for contact.updated event", async () => {
      const t = createTestContext();
      const payload = makePayload({ type: "contact.updated" });

      const result = await t.mutation(
        internal.marketingWebhook.recordContactEvent,
        {
          svixId: "msg_abc123",
          email: payload.data.email,
          contactId: payload.data.id,
          audienceId: payload.data.audience_id ?? undefined,
          eventType: payload.type,
          unsubscribed: payload.data.unsubscribed,
          occurredAt: new Date(payload.created_at).getTime(),
          firstName: payload.data.first_name ?? undefined,
          lastName: payload.data.last_name ?? undefined,
          rawPayload: JSON.stringify(payload),
        },
      );

      expect(result.inserted).toBe(true);
      expect(result.id).toBeDefined();
    });

    it("inserts separate rows for different event types", async () => {
      const t = createTestContext();

      for (const [i, type] of (
        ["contact.created", "contact.updated", "contact.deleted"] as const
      ).entries()) {
        const result = await t.mutation(
          internal.marketingWebhook.recordContactEvent,
          {
            svixId: `msg_${type}_${i}`,
            email: "multi@example.com",
            contactId: `contact_${i}`,
            eventType: type,
            unsubscribed: type === "contact.deleted" ? false : true,
            occurredAt: Date.now() + i,
            rawPayload: "{}",
          },
        );
        expect(result.inserted).toBe(true);
      }
    });

    it("stores the raw payload verbatim for debugging", async () => {
      const t = createTestContext();
      const payload = makePayload();
      const raw = JSON.stringify(payload);

      const { id } = await t.mutation(
        internal.marketingWebhook.recordContactEvent,
        {
          svixId: "msg_raw",
          email: payload.data.email,
          contactId: payload.data.id,
          eventType: payload.type,
          unsubscribed: payload.data.unsubscribed,
          occurredAt: new Date(payload.created_at).getTime(),
          rawPayload: raw,
        },
      );

      const stored = await t.run(async (ctx) => ctx.db.get(id));
      expect(stored?.rawPayload).toBe(raw);
    });
  });

  describe("idempotency (svixId dedup)", () => {
    it("returns the existing row on duplicate svixId without inserting again", async () => {
      const t = createTestContext();

      const first = await t.mutation(
        internal.marketingWebhook.recordContactEvent,
        {
          svixId: "msg_dupe",
          email: "dupe@example.com",
          contactId: "c1",
          eventType: "contact.updated",
          unsubscribed: true,
          occurredAt: Date.now(),
          rawPayload: "{}",
        },
      );

      const second = await t.mutation(
        internal.marketingWebhook.recordContactEvent,
        {
          svixId: "msg_dupe",
          email: "dupe@example.com",
          contactId: "c1",
          eventType: "contact.updated",
          unsubscribed: true,
          occurredAt: Date.now(),
          rawPayload: "{}",
        },
      );

      expect(first.inserted).toBe(true);
      expect(second.inserted).toBe(false);
      expect(second.id).toBe(first.id);

      // Verify only one row exists for this svixId
      const rows = await t.run(async (ctx) =>
        ctx.db
          .query("marketingEvents")
          .withIndex("by_svix_id", (q) => q.eq("svixId", "msg_dupe"))
          .collect(),
      );
      expect(rows).toHaveLength(1);
    });

    it("different svixIds insert as separate rows", async () => {
      const t = createTestContext();

      await t.mutation(internal.marketingWebhook.recordContactEvent, {
        svixId: "msg_a",
        email: "same@example.com",
        contactId: "c1",
        eventType: "contact.updated",
        unsubscribed: true,
        occurredAt: Date.now(),
        rawPayload: "{}",
      });

      await t.mutation(internal.marketingWebhook.recordContactEvent, {
        svixId: "msg_b",
        email: "same@example.com",
        contactId: "c1",
        eventType: "contact.updated",
        unsubscribed: false,
        occurredAt: Date.now(),
        rawPayload: "{}",
      });

      const rows = await t.run(async (ctx) =>
        ctx.db
          .query("marketingEvents")
          .withIndex("by_email_and_time", (q) =>
            q.eq("email", "same@example.com"),
          )
          .collect(),
      );
      expect(rows).toHaveLength(2);
    });
  });

  describe("optional fields", () => {
    it("handles missing first_name and last_name", async () => {
      const t = createTestContext();

      const { id } = await t.mutation(
        internal.marketingWebhook.recordContactEvent,
        {
          svixId: "msg_noname",
          email: "anon@example.com",
          contactId: "c1",
          eventType: "contact.created",
          unsubscribed: false,
          occurredAt: Date.now(),
          rawPayload: "{}",
          // firstName, lastName, audienceId all omitted
        },
      );

      const row = await t.run(async (ctx) => ctx.db.get(id));
      expect(row?.firstName).toBeUndefined();
      expect(row?.lastName).toBeUndefined();
      expect(row?.audienceId).toBeUndefined();
    });

    it("preserves audienceId when provided", async () => {
      const t = createTestContext();

      const { id } = await t.mutation(
        internal.marketingWebhook.recordContactEvent,
        {
          svixId: "msg_aud",
          email: "aud@example.com",
          contactId: "c1",
          audienceId: "aud_xyz",
          eventType: "contact.updated",
          unsubscribed: true,
          occurredAt: Date.now(),
          rawPayload: "{}",
        },
      );

      const row = await t.run(async (ctx) => ctx.db.get(id));
      expect(row?.audienceId).toBe("aud_xyz");
    });
  });

  describe("realistic payload extraction", () => {
    it("correctly stores all fields from a Resend contact.updated payload", async () => {
      const t = createTestContext();
      const payload = makePayload({
        type: "contact.updated",
        email: "subscriber@gmail.com",
        unsubscribed: true,
        firstName: "Umar",
      });

      const { id } = await t.mutation(
        internal.marketingWebhook.recordContactEvent,
        {
          svixId: "msg_realistic",
          email: payload.data.email,
          contactId: payload.data.id,
          audienceId: payload.data.audience_id ?? undefined,
          eventType: payload.type,
          unsubscribed: payload.data.unsubscribed,
          occurredAt: new Date(payload.created_at).getTime(),
          firstName: payload.data.first_name ?? undefined,
          lastName: payload.data.last_name ?? undefined,
          rawPayload: JSON.stringify(payload),
        },
      );

      const row = await t.run(async (ctx) => ctx.db.get(id));
      expect(row).toMatchObject({
        svixId: "msg_realistic",
        email: "subscriber@gmail.com",
        contactId: "00000000-0000-4000-8000-000000000001",
        audienceId: "00000000-0000-4000-8000-0000000000a1",
        eventType: "contact.updated",
        unsubscribed: true,
        firstName: "Umar",
        lastName: "User",
      });
      expect(row?.occurredAt).toBe(
        new Date("2026-04-15T16:47:45.000Z").getTime(),
      );
    });
  });

  describe("indexes", () => {
    it("by_email_and_time returns chronological history for a contact", async () => {
      const t = createTestContext();
      const baseTime = Date.now();

      for (let i = 0; i < 3; i++) {
        await t.mutation(internal.marketingWebhook.recordContactEvent, {
          svixId: `msg_hist_${i}`,
          email: "history@example.com",
          contactId: "c1",
          eventType: i === 0 ? "contact.created" : "contact.updated",
          unsubscribed: i === 2,
          occurredAt: baseTime + i * 1000,
          rawPayload: "{}",
        });
      }

      const ordered = await t.run(async (ctx) =>
        ctx.db
          .query("marketingEvents")
          .withIndex("by_email_and_time", (q) =>
            q.eq("email", "history@example.com"),
          )
          .collect(),
      );

      expect(ordered).toHaveLength(3);
      expect(ordered[0].occurredAt).toBe(baseTime);
      expect(ordered[2].unsubscribed).toBe(true);
    });
  });
});

// ============================================================================
// C4 — /resend-inbound HTTP webhook (signature, NaN guard, status codes)
// ============================================================================

describe("/resend-inbound contact webhook (http.ts)", () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  });
  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  it("returns 200 and persists a row for a valid signed contact event", async () => {
    const t = createTestContext();
    const rawBody = JSON.stringify(
      makePayload({ type: "contact.updated", email: "valid@example.com", unsubscribed: true }),
    );

    const res = await t.fetch("/resend-inbound", {
      method: "POST",
      headers: { ...signWebhook(rawBody), "Content-Type": "application/json" },
      body: rawBody,
    });

    expect(res.status).toBe(200);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("marketingEvents")
        .withIndex("by_email_and_time", (q) => q.eq("email", "valid@example.com"))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].unsubscribed).toBe(true);
  });

  it("handles an unparseable created_at without throwing (occurredAt falls back to a finite number)", async () => {
    const t = createTestContext();
    // created_at is garbage → new Date(...).getTime() would be NaN, which
    // v.number() rejects. The Number.isFinite guard must coerce it to now.
    const payload = makePayload({ email: "naninput@example.com" });
    payload.created_at = "not-a-real-date";
    payload.data.created_at = "not-a-real-date";
    const rawBody = JSON.stringify(payload);

    const res = await t.fetch("/resend-inbound", {
      method: "POST",
      headers: { ...signWebhook(rawBody), "Content-Type": "application/json" },
      body: rawBody,
    });

    expect(res.status).toBe(200);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("marketingEvents")
        .withIndex("by_email_and_time", (q) => q.eq("email", "naninput@example.com"))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(Number.isFinite(rows[0].occurredAt)).toBe(true);
    expect(Number.isNaN(rows[0].occurredAt)).toBe(false);
  });

  it("rejects a malformed JSON payload with a non-2xx (never a silent 200) and persists nothing", async () => {
    const t = createTestContext();
    // svix.verify() parses the body internally and throws on malformed JSON,
    // so http.ts rejects it at the signature step (401) before it can reach the
    // inline JSON.parse 400 branch. Either way the contract holds: a malformed
    // payload returns a non-2xx so Resend sees the failure — never a swallowed
    // 200 — and nothing is written.
    const rawBody = "{ this is not valid json";

    const res = await t.fetch("/resend-inbound", {
      method: "POST",
      headers: { ...signWebhook(rawBody), "Content-Type": "application/json" },
      body: rawBody,
    });

    expect(res.status).not.toBe(200);
    expect(res.status).toBeGreaterThanOrEqual(400);

    const rows = await t.run(async (ctx) =>
      ctx.db.query("marketingEvents").collect(),
    );
    expect(rows).toHaveLength(0);
  });

  it("returns 401 for an invalid/forged signature and persists nothing", async () => {
    const t = createTestContext();
    const rawBody = JSON.stringify(makePayload({ email: "forged@example.com" }));

    const res = await t.fetch("/resend-inbound", {
      method: "POST",
      headers: {
        "svix-id": "msg_forged",
        "svix-timestamp": Math.floor(Date.now() / 1000).toString(),
        "svix-signature": "v1,deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef=",
        "Content-Type": "application/json",
      },
      body: rawBody,
    });

    expect(res.status).toBe(401);

    const rows = await t.run(async (ctx) =>
      ctx.db.query("marketingEvents").collect(),
    );
    expect(rows).toHaveLength(0);
  });

  it("returns 401 when signature headers are missing", async () => {
    const t = createTestContext();
    const rawBody = JSON.stringify(makePayload());

    const res = await t.fetch("/resend-inbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawBody,
    });

    expect(res.status).toBe(401);
  });
});
