/**
 * POST /inbound-email: the mail Worker on Cloudflare posts each message it
 * received, already forwarded to the owner, to be stored for a threaded reply.
 * Off without its secret, shut to a wrong key, and a retried delivery is
 * stored once.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";

const KEY = "test-inbound-key-0123456789";
const message = {
  to: "support@permtracker.app",
  from: "person@example.com",
  fromName: "A Person",
  subject: "Question about a case",
  messageId: "<abc@example.com>",
  text: "Hello",
  forwarded: true,
};

const post = (t: ReturnType<typeof createTestContext>, body: unknown, key?: string) =>
  t.fetch("/inbound-email", {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { "x-inbound-key": key } : {}) },
    body: JSON.stringify(body),
  });

describe("/inbound-email", () => {
  afterEach(() => vi.unstubAllEnvs());

  // The first request in a file loads the whole HTTP router (about 6 s on this Mac, alone), so this test gets
  // room for a loaded machine: under a load average near 26 it passed 15 s (Nov 4 2026).
  it("is off without its secret, and shut to a wrong key", async () => {
    const t = createTestContext();
    expect((await post(t, message, KEY)).status).toBe(503);
    vi.stubEnv("INBOUND_EMAIL_SECRET", KEY);
    expect((await post(t, message)).status).toBe(401);
    expect((await post(t, message, "wrong")).status).toBe(401);
  }, 60_000);

  it("stores a message once, however often it arrives", async () => {
    vi.stubEnv("INBOUND_EMAIL_SECRET", KEY);
    const t = createTestContext();
    const first = await post(t, message, KEY);
    expect(await first.json()).toMatchObject({ ok: true, stored: true });
    const again = await post(t, message, KEY);
    expect(await again.json()).toMatchObject({ ok: true, stored: false });
    const rows = await t.run(async (ctx) => ctx.db.query("supportEmails").take(10));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fromEmail: "person@example.com",
      toEmail: "support@permtracker.app",
      subject: "Question about a case",
      bodyText: "Hello",
      status: "forwarded",
    });
  });

  it("refuses a body that isn't JSON", async () => {
    vi.stubEnv("INBOUND_EMAIL_SECRET", KEY);
    const t = createTestContext();
    const res = await t.fetch("/inbound-email", { method: "POST", headers: { "x-inbound-key": KEY }, body: "not json" });
    expect(res.status).toBe(400);
  });
});
