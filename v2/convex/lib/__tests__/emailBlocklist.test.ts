import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isEmailBlocked,
  getBlockedEmails,
  assertBlocklistConfigured,
} from "../emailBlocklist";

// Synthetic fixtures only. The real blocklist entries are real people's email
// addresses and live in the BLOCKED_EMAILS environment variable, never in this
// repository. See the module docblock.
const BLOCKED = "blocked@example.com";
const ALSO_BLOCKED = "second@example.com";

beforeEach(() => {
  vi.stubEnv("BLOCKED_EMAILS", `${BLOCKED},${ALSO_BLOCKED}`);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isEmailBlocked", () => {
  it("returns true for a blocked email (exact match)", () => {
    expect(isEmailBlocked(BLOCKED)).toBe(true);
    expect(isEmailBlocked(ALSO_BLOCKED)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isEmailBlocked("BLOCKED@EXAMPLE.COM")).toBe(true);
    expect(isEmailBlocked("Blocked@Example.Com")).toBe(true);
  });

  it("trims whitespace", () => {
    expect(isEmailBlocked(`  ${BLOCKED}  `)).toBe(true);
    expect(isEmailBlocked(`\t${BLOCKED}\n`)).toBe(true);
  });

  it("returns false for unrelated emails", () => {
    expect(isEmailBlocked("someone@example.com")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isEmailBlocked("")).toBe(false);
    expect(isEmailBlocked("   ")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isEmailBlocked(null)).toBe(false);
    expect(isEmailBlocked(undefined)).toBe(false);
  });

  it("does not match substrings or partial addresses", () => {
    expect(isEmailBlocked("locked@example.com")).toBe(false);
    expect(isEmailBlocked("blocked@example.co")).toBe(false);
    expect(isEmailBlocked("blocked")).toBe(false);
  });

  // `lib/email.ts` does `recipients.filter(isEmailBlocked)`, which invokes the
  // predicate as (value, index, array). Guard against a future signature change
  // that starts treating the second argument as meaningful.
  it("is safe to pass directly to Array.prototype.filter", () => {
    const recipients = ["keep@example.com", BLOCKED, "also-keep@example.com"];
    expect(recipients.filter(isEmailBlocked)).toEqual([BLOCKED]);
  });
});

describe("blocklist configuration", () => {
  it("normalizes case and whitespace in the env value itself", () => {
    vi.stubEnv("BLOCKED_EMAILS", "  Foo@Example.COM , bar@example.com  ");
    expect(isEmailBlocked("foo@example.com")).toBe(true);
    expect(isEmailBlocked("BAR@EXAMPLE.COM")).toBe(true);
  });

  it("ignores empty entries from trailing or doubled commas", () => {
    vi.stubEnv("BLOCKED_EMAILS", `${BLOCKED},,`);
    expect(getBlockedEmails()).toEqual([BLOCKED]);
  });

  it("picks up env changes without a reload", () => {
    expect(isEmailBlocked(BLOCKED)).toBe(true);
    vi.stubEnv("BLOCKED_EMAILS", "different@example.com");
    expect(isEmailBlocked(BLOCKED)).toBe(false);
    expect(isEmailBlocked("different@example.com")).toBe(true);
  });

  // Fails open on purpose: a config mistake must not stop the app sending mail
  // entirely. assertBlocklistConfigured is the guard that makes it loud.
  it("blocks nothing when BLOCKED_EMAILS is unset", () => {
    vi.stubEnv("BLOCKED_EMAILS", "");
    expect(isEmailBlocked(BLOCKED)).toBe(false);
    expect(getBlockedEmails()).toEqual([]);
  });
});

describe("getBlockedEmails", () => {
  it("returns the configured entries", () => {
    expect(getBlockedEmails()).toEqual([BLOCKED, ALSO_BLOCKED]);
  });

  it("returns a copy (mutating does not affect module state)", () => {
    const list1 = getBlockedEmails();
    const list2 = getBlockedEmails();
    expect(list1).not.toBe(list2);
    expect(list1).toEqual(list2);
  });
});

describe("assertBlocklistConfigured", () => {
  it("passes when the blocklist has entries", () => {
    expect(() => assertBlocklistConfigured()).not.toThrow();
  });

  it("throws when BLOCKED_EMAILS is unset", () => {
    vi.stubEnv("BLOCKED_EMAILS", "");
    expect(() => assertBlocklistConfigured()).toThrow(/BLOCKED_EMAILS is unset/);
  });

  it("throws when BLOCKED_EMAILS holds only separators", () => {
    vi.stubEnv("BLOCKED_EMAILS", " , , ");
    expect(() => assertBlocklistConfigured()).toThrow(/inert/);
  });
});
