import { describe, expect, it } from "vitest";

import { SITE_URL } from "../links";
import { weeklyUnsubscribeUrl } from "../prefsLink";
import { makeUnsubscribeToken, verifyUnsubscribeToken } from "../unsubscribeToken";

/**
 * The weekly case summary and the re-engagement email carry a one-click unsubscribe, and until Nov 4 2026 both
 * built it on the raw `<deployment>.convex.site` host, the one place left that did (every other email has been on
 * permtracker.app since Sep 10; convex/lib/links.ts says why). The branded `/unsubscribe` is rewritten to the same
 * Convex route, so the token stays the bare, unscoped one: links already in inboxes keep working, and a new link
 * differs from an old one only in its host.
 */

const SOURCES = import.meta.glob("../../notificationActions.ts", { query: "?raw", import: "default", eager: true });

describe("the account emails' unsubscribe link", () => {
  it("is on the public site, at the Convex route's own path", async () => {
    const url = await weeklyUnsubscribeUrl("person@example.com", "test-secret");
    expect(url).toBeDefined();
    const parsed = new URL(url!);
    expect(parsed.origin).toBe(SITE_URL);
    expect(parsed.hostname).not.toMatch(/convex\.(site|cloud)$/);
    expect(parsed.pathname).toBe("/unsubscribe");
  });

  it("keeps the bare token the route has always verified", async () => {
    const url = await weeklyUnsubscribeUrl("person@example.com", "test-secret");
    const token = new URL(url!).searchParams.get("token");
    expect(token).toBe(await makeUnsubscribeToken("person@example.com", "test-secret"));
    expect(await verifyUnsubscribeToken(token!, "test-secret")).toBe("person@example.com");
  });

  it("is absent when the signing secret isn't set", async () => {
    expect(await weeklyUnsubscribeUrl("person@example.com", undefined)).toBeUndefined();
    expect(await weeklyUnsubscribeUrl("person@example.com", "")).toBeUndefined();
  });

  it("is the only way notificationActions builds one", () => {
    const source = Object.values(SOURCES)[0] as string;
    expect(source.length).toBeGreaterThan(1000);
    expect(source).toContain("weeklyUnsubscribeUrl(");
    // No link in this module may be built on the Convex host.
    expect(source).not.toMatch(/CONVEX_SITE_URL/);
  });
});
