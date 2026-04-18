import { describe, it, expect } from "vitest";
import { isEmailBlocked, getBlockedEmails } from "../emailBlocklist";

describe("isEmailBlocked", () => {
  it("returns true for known blocked email (exact match)", () => {
    expect(isEmailBlocked("blocked@gmail.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isEmailBlocked("blocked@GMAIL.COM")).toBe(true);
    expect(isEmailBlocked("blocked@Gmail.Com")).toBe(true);
  });

  it("trims whitespace", () => {
    expect(isEmailBlocked("  blocked@gmail.com  ")).toBe(true);
    expect(isEmailBlocked("\tblocked@gmail.com\n")).toBe(true);
  });

  it("returns false for unrelated emails", () => {
    expect(isEmailBlocked("someone@example.com")).toBe(false);
    expect(isEmailBlocked("owner@gmail.com")).toBe(false);
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
    expect(isEmailBlocked("soltau@gmail.com")).toBe(false);
    expect(isEmailBlocked("mona@gmail.com")).toBe(false);
    expect(isEmailBlocked("blocked")).toBe(false);
  });
});

describe("getBlockedEmails", () => {
  it("returns an array including the known blocked email", () => {
    const list = getBlockedEmails();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toContain("blocked@gmail.com");
  });

  it("returns a copy (mutating does not affect module state)", () => {
    const list1 = getBlockedEmails();
    const list2 = getBlockedEmails();
    // Different array instances
    expect(list1).not.toBe(list2);
    // Same content
    expect(list1).toEqual(list2);
  });
});
