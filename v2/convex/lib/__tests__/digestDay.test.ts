/**
 * The weekly summary's day: one fixed weekday per account, spread across
 * Monday, Tuesday and Wednesday (Oct 12 2026: every summary went on Monday).
 */
import { describe, expect, it } from "vitest";
import { DIGEST_DAYS, digestDayName, digestSlot } from "../digestDay";
import { isOwnTestAddress } from "../emailBlocklist";

describe("digestSlot", () => {
  it("gives an account the same day every time", () => {
    expect(digestSlot("k577zsgc2hqkypgjp070hhnh458g4dyg")).toBe(digestSlot("k577zsgc2hqkypgjp070hhnh458g4dyg"));
    expect(DIGEST_DAYS).toContain(digestDayName("abc").toLowerCase());
  });

  it("spreads many accounts across all three days, none with most of them", () => {
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[digestSlot(`user${i}x${(i * 7919).toString(36)}`)]!++;
    for (const c of counts) {
      expect(c).toBeGreaterThan(800);
      expect(c).toBeLessThan(1200);
    }
  });
});

describe("isOwnTestAddress", () => {
  it("matches the site's own accounts but not support@ or other domains", () => {
    expect(isOwnTestAddress("demo@permtracker.app")).toBe(true);
    expect(isOwnTestAddress(" QA-123@PermTracker.app ")).toBe(true);
    expect(isOwnTestAddress("support@permtracker.app")).toBe(false);
    expect(isOwnTestAddress("adam@press.permtracker.app")).toBe(false);
    expect(isOwnTestAddress("someone@permtracker.app.example.com")).toBe(false);
    expect(isOwnTestAddress("person@gmail.com")).toBe(false);
    expect(isOwnTestAddress("")).toBe(false);
    expect(isOwnTestAddress(undefined)).toBe(false);
  });
});
