import { describe, expect, it } from "vitest";

import { bearerMatches, secretMatches } from "../secretMatch";

/**
 * Every shared secret a route handler checks is compared in constant time (Nov 4 2026). Fifteen routes (the
 * revalidate-* routes, /api/sentry-check and three /api/cron routes) compared with `!==`, which stops at the first
 * differing character, so the time a refusal took said how much of the secret was right. The helper digests both
 * sides first, so neither the length nor a matching prefix shows; an unset or empty secret refuses everything.
 */

const ROUTES = import.meta.glob("../../app/api/**/route.ts", { query: "?raw", import: "default", eager: true });

describe("secretMatches", () => {
  it("accepts the exact secret", async () => {
    expect(await secretMatches("s3cret-value", "s3cret-value")).toBe(true);
  });

  it("refuses a different value, a prefix, a longer value and a different case", async () => {
    expect(await secretMatches("s3cret-valuf", "s3cret-value")).toBe(false);
    expect(await secretMatches("s3cret", "s3cret-value")).toBe(false);
    expect(await secretMatches("s3cret-value-and-more", "s3cret-value")).toBe(false);
    expect(await secretMatches("S3CRET-VALUE", "s3cret-value")).toBe(false);
  });

  it("refuses everything while the secret is unset or empty, an empty guess included", async () => {
    for (const expected of [undefined, null, ""]) {
      expect(await secretMatches("", expected)).toBe(false);
      expect(await secretMatches("anything", expected)).toBe(false);
      expect(await secretMatches(null, expected)).toBe(false);
    }
  });

  it("refuses a missing or empty guess", async () => {
    expect(await secretMatches(null, "s3cret-value")).toBe(false);
    expect(await secretMatches(undefined, "s3cret-value")).toBe(false);
    expect(await secretMatches("", "s3cret-value")).toBe(false);
  });
});

describe("bearerMatches", () => {
  it("accepts exactly `Bearer <secret>`", async () => {
    expect(await bearerMatches("Bearer abc123", "abc123")).toBe(true);
  });

  it("refuses the bare secret, another scheme, a wrong secret and no secret", async () => {
    expect(await bearerMatches("abc123", "abc123")).toBe(false);
    expect(await bearerMatches("Basic abc123", "abc123")).toBe(false);
    expect(await bearerMatches("Bearer abc124", "abc123")).toBe(false);
    expect(await bearerMatches("Bearer ", "")).toBe(false);
    expect(await bearerMatches("Bearer undefined", undefined)).toBe(false);
    expect(await bearerMatches(null, "abc123")).toBe(false);
  });
});

describe("the route handlers", () => {
  const files = Object.entries(ROUTES) as [string, string][];

  it("were all read", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("compare no shared secret with === or !==", () => {
    const offenders = files.filter(([, src]) =>
      /(?:secret|expected|auth|token)\s*[!=]==\s*(?:expected|secret|`Bearer)|`Bearer \$\{[^}]+\}`\s*[!=]==/i.test(src),
    );
    expect(offenders.map(([path]) => path)).toEqual([]);
  });

  it("route every secret check through the helper", () => {
    const checking = files.filter(([, src]) => /process\.env\.(?:REVALIDATE_SECRET|SENTRY_CHECK_SECRET|CRON_SECRET)/.test(src));
    expect(checking.length).toBe(15);
    for (const [path, src] of checking) {
      expect(src, path).toMatch(/\b(?:secretMatches|bearerMatches)\(/);
    }
  });
});
