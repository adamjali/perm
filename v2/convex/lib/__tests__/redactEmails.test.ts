import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../../test-utils/convex";
import { internal } from "../../_generated/api";
import { emailLabel, redactEmails } from "../redactEmails";

/**
 * No email address leaves for Sentry (Nov 4 2026). recordError forwards `extra`, and eight call sites pass
 * `extra: \`to: ${email}\``; error messages from Resend and Convex Auth carry addresses too ("Account x@y
 * already exists"). Sentry is a third party, so the one place an event leaves (convex/lib/sentry.ts reportError)
 * swaps every address for a short label: the same address always gets the same label, so repeats still group,
 * and the address itself can't be read back. The user's opaque id is kept.
 */

describe("redactEmails", () => {
  it("replaces every address with a stable short label", async () => {
    const out = await redactEmails("to: Person.Name+tag@Example.COM and other@sub.example.org");
    expect(out).not.toMatch(/@/);
    expect(out).toMatch(/^to: email#[0-9a-f]{6} and email#[0-9a-f]{6}$/);
  });

  it("gives one address one label whatever its case, and two addresses two", async () => {
    const a = await emailLabel("Person@Example.com");
    expect(await emailLabel("person@example.com")).toBe(a);
    expect(await emailLabel("someone-else@example.com")).not.toBe(a);
    expect(await redactEmails("a person@example.com, again PERSON@example.com")).toBe(`a ${a}, again ${a}`);
  });

  it("is the first six hex digits of the SHA-256 of the lowercased address", async () => {
    const bytes = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode("person@example.com")),
    );
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    expect(await emailLabel("Person@Example.com")).toBe(`email#${hex.slice(0, 6)}`);
  });

  it("keeps a sentence's full stop and finds an address inside JSON", async () => {
    const label = await emailLabel("a.person@example.com");
    expect(await redactEmails("Write to a.person@example.com.")).toBe(`Write to ${label}.`);
    expect(await redactEmails('{"to":"a.person@example.com","n":1}')).toBe(`{"to":"${label}","n":1}`);
  });

  it("stays fast on a long string built to make a pattern backtrack", async () => {
    const started = Date.now();
    const out = await redactEmails(`x@${"a.".repeat(60_000)}a${"@".repeat(20_000)}${"b".repeat(40_000)}`);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(out).not.toContain("email#");
  });

  it("leaves text without an address alone", async () => {
    for (const text of [
      "[Request ID: 51c34f59011c0f6b] Server Error",
      "https://permtracker.app/perm-case-status?case=G-100-26100-111111",
      "user@ with no domain, @handle, a@b",
      "",
    ]) {
      expect(await redactEmails(text)).toBe(text);
    }
  });
});

describe("sentryReportAction.report", () => {
  const originalFetch = global.fetch;
  let bodies: string[] = [];

  beforeEach(() => {
    bodies = [];
    vi.stubEnv("SENTRY_DSN", "https://publickey@o123.ingest.sentry.io/456");
    global.fetch = (async (_url: unknown, init?: { body?: string }) => {
      bodies.push(String(init?.body ?? ""));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("sends no raw address, in the message, the stack, the extra or the resource id, and keeps the user id", async () => {
    const t = createTestContext();
    const error = new Error("Resend 422: person@example.com is not a valid recipient");
    await t.action(internal.sentryReportAction.report, {
      source: "action",
      operation: "notificationActions.sendWeeklyDigestEmail",
      message: error.message,
      stack: error.stack,
      userId: "k17abc123def",
      resourceId: "resource-of other@example.org",
      extra: "to: person@example.com",
    });
    expect(bodies).toHaveLength(1);
    const sent = bodies[0]!;
    expect(sent).not.toContain("person@example.com");
    expect(sent).not.toContain("other@example.org");
    expect(sent).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
    const label = await emailLabel("person@example.com");
    expect(sent).toContain(label);
    const event = JSON.parse(sent) as {
      user?: { id?: string };
      extra?: Record<string, unknown>;
      exception: { values: { value: string }[] };
    };
    expect(event.user?.id).toBe("k17abc123def");
    expect(event.extra?.detail).toBe(`to: ${label}`);
    expect(event.exception.values[0]!.value).toBe(`Resend 422: ${label} is not a valid recipient`);
  });
});
