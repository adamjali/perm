import { Webhook } from "svix";
import { describe, expect, it } from "vitest";

import {
  RETRY_DELAYS_MS,
  RETRY_WINDOW_MS,
  buildWebhookSecret,
  checkWebhookUrl,
  isPrivateAddress,
  nextAttemptAt,
  normaliseEvents,
  signWebhook,
  webhookHeaders,
} from "./webhookSign";

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

describe("signing", () => {
  it("makes whsec_ secrets of 32 random bytes", () => {
    const s = buildWebhookSecret(random);
    expect(s).toMatch(/^whsec_[A-Za-z0-9+/]{43}=$/);
    expect(buildWebhookSecret(random)).not.toBe(s);
  });

  it("signs the Standard Webhooks way, so an independent library accepts it", async () => {
    const secret = buildWebhookSecret(random);
    const body = JSON.stringify({ type: "case.status_changed", data: { caseNumber: "G-100-26045-123456" } });
    const ts = Math.floor(Date.now() / 1000);
    const headers = await webhookHeaders(secret, "msg_abc", ts, body);
    // svix implements Standard Webhooks; it throws on any mismatch.
    expect(() => new Webhook(secret).verify(body, headers)).not.toThrow();
  });

  it("produces a signature another key, body or id can't match", async () => {
    const secret = buildWebhookSecret(random);
    const ts = Math.floor(Date.now() / 1000);
    const headers = await webhookHeaders(secret, "msg_abc", ts, "{}");
    expect(() => new Webhook(buildWebhookSecret(random)).verify("{}", headers)).toThrow();
    expect(() => new Webhook(secret).verify('{"x":1}', headers)).toThrow();
    expect(() => new Webhook(secret).verify("{}", { ...headers, "webhook-id": "msg_other" })).toThrow();
  });

  it("matches a known vector", async () => {
    // Key bytes 0..31; HMAC-SHA256 of "msg_1.1700000000.{}", computed independently.
    const secret = `whsec_${btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i)))}`;
    const sig = await signWebhook(secret, "msg_1", 1_700_000_000, "{}");
    expect(sig.startsWith("v1,")).toBe(true);
    expect(new Webhook(secret).sign("msg_1", new Date(1_700_000_000 * 1000), "{}")).toBe(sig);
  });

  it("refuses a secret without its prefix", async () => {
    await expect(signWebhook("abc", "msg_1", 1, "{}")).rejects.toThrow();
  });
});

describe("where we'll deliver", () => {
  it("takes a public https address and drops its fragment", () => {
    expect(checkWebhookUrl(" https://hooks.example.com/perm?x=1#frag ")).toEqual({ ok: true, url: "https://hooks.example.com/perm?x=1" });
  });

  it.each([
    ["http://hooks.example.com/x", /https only/],
    ["https://user:pass@hooks.example.com/x", /user name and password/],
    ["https://hooks.example.com:8443/x", /standard https port/],
    ["https://127.0.0.1/x", /IP address/],
    ["https://10.0.0.5/x", /IP address/],
    ["https://[::1]/x", /IP address/],
    ["https://localhost/x", /public host/],
    ["https://printer.local/x", /public host/],
    ["https://api.internal/x", /public host/],
    ["https://intranet/x", /public host/],
    ["https://permtracker.app/api/x", /PERM Tracker itself/],
    ["https://giant-dragon-464.convex.site/x", /PERM Tracker itself/],
    ["https://localhost./x", /public host/],
    ["https://metadata.google.internal./x", /public host/],
    ["https://permtracker.app./x", /PERM Tracker itself/],
    ["https://giant-dragon-464.convex.site./x", /PERM Tracker itself/],
    ["https://hooks.example.com../x", /public host/],
    ["not a url", /isn't a web address/],
    [`https://example.com/${"a".repeat(2100)}`, /2048 characters/],
  ])("refuses %s", (url, why) => {
    const r = checkWebhookUrl(url);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.message).toMatch(why);
  });
});

describe("addresses a host name may resolve to", () => {
  it.each([
    "0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255",
    "192.0.0.1", "192.168.1.1", "198.18.0.1", "224.0.0.1", "255.255.255.255",
    "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:10.0.0.1", "::ffff:169.254.169.254",
    "not an address",
  ])("refuses %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700::1111", "::ffff:93.184.216.34"])("allows %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("events", () => {
  it("keeps known events only, once each, in order", () => {
    expect(normaliseEvents(["queue.moved", "nope", "case.status_changed", "queue.moved"])).toEqual(["case.status_changed", "queue.moved"]);
  });
});

describe("retries", () => {
  const t0 = Date.UTC(2026, 9, 9, 12, 0);

  it("backs off 1 minute, 5 minutes, half an hour, then hours", () => {
    expect(nextAttemptAt(t0, 1, t0)).toBe(t0 + RETRY_DELAYS_MS[0]);
    expect(nextAttemptAt(t0, 2, t0 + 60_000)).toBe(t0 + 60_000 + 5 * 60_000);
    expect(nextAttemptAt(t0, 3, t0)).toBe(t0 + 30 * 60_000);
  });

  it("makes the last attempt at the 24-hour mark, never after it", () => {
    const late = t0 + RETRY_WINDOW_MS - 60_000;
    expect(nextAttemptAt(t0, 7, late)).toBe(t0 + RETRY_WINDOW_MS);
  });

  it("gives up once 24 hours have passed since the first attempt", () => {
    expect(nextAttemptAt(t0, 8, t0 + RETRY_WINDOW_MS)).toBeNull();
  });

  it("spends the whole window before giving up", () => {
    let at = t0;
    let attempts = 1;
    let next = nextAttemptAt(t0, attempts, at);
    while (next !== null) {
      at = next;
      attempts++;
      next = nextAttemptAt(t0, attempts, at);
    }
    expect(at).toBe(t0 + RETRY_WINDOW_MS);
    expect(attempts).toBeGreaterThanOrEqual(7);
  });
});
