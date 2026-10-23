import { describe, expect, it } from "vitest";

import { checkReview, looksAutomated, MIN_FILL_MS, REVIEW_NAME_MAX, REVIEW_TEXT_MAX } from "./siteReview";

const good = { rating: 5, text: "Told me the day my case moved.", name: "Pat", consent: true };

describe("checkReview", () => {
  it("accepts a complete review and tidies it", () => {
    expect(checkReview({ ...good, text: "  Told me the day my case moved.  ", name: " Pat   K ", email: " Pat@Example.com " })).toEqual({
      ok: true,
      review: { rating: 5, text: "Told me the day my case moved.", name: "Pat K", email: "pat@example.com" },
    });
  });

  it("leaves the email out when it's blank", () => {
    const r = checkReview({ ...good, email: "" });
    expect(r.ok && "email" in r.review).toBe(false);
  });

  it("refuses a rating that isn't a whole number from 1 to 5", () => {
    for (const rating of [0, 6, 4.5, "5", null, Number.NaN]) {
      expect(checkReview({ ...good, rating }).ok).toBe(false);
    }
  });

  it("refuses text that's too short or too long, and a missing or overlong name", () => {
    expect(checkReview({ ...good, text: "Great" }).ok).toBe(false);
    expect(checkReview({ ...good, text: "x".repeat(REVIEW_TEXT_MAX + 1) }).ok).toBe(false);
    expect(checkReview({ ...good, name: "   " }).ok).toBe(false);
    expect(checkReview({ ...good, name: "x".repeat(REVIEW_NAME_MAX + 1) }).ok).toBe(false);
  });

  it("refuses a malformed or overlong email before trying the pattern", () => {
    expect(checkReview({ ...good, email: "not an email" }).ok).toBe(false);
    expect(checkReview({ ...good, email: `${"a".repeat(260)}@example.com` }).ok).toBe(false);
  });

  it("needs the box ticked to show the review", () => {
    expect(checkReview({ ...good, consent: false }).ok).toBe(false);
    expect(checkReview({ ...good, consent: "true" }).ok).toBe(false);
  });

  it("refuses links, web addresses and email addresses in the review or the name", () => {
    for (const text of [
      "Great tool, see https://spam.example for more",
      "Visit www.cheap-meds.example today, really",
      "Loved it. Buy followers at followersnow.com now",
      "Write to me at someone@example.com about it",
    ]) {
      const r = checkReview({ ...good, text });
      expect(r.ok, text).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/link|address/i);
    }
    expect(checkReview({ ...good, name: "Pat from spam.example.com" }).ok).toBe(false);
  });

  it("keeps ordinary writing that only looks a little like an address", () => {
    for (const text of [
      "It helped, e.g. with my RFI. Works in the U.S. and in St.Louis.",
      "Version 2.0 of my plan worked. Ratio 3.5 to 1.",
      "My PERM went RFI -> Analyst Review -> Certified.",
    ]) {
      expect(checkReview({ ...good, text }).ok, text).toBe(true);
    }
  });

  it("strips invisible characters before measuring", () => {
    const r = checkReview({ ...good, text: "Told me\u200B the day\u202E my case moved.", name: "Pa\u200Dt" });
    expect(r.ok && r.review.text).toBe("Told me the day my case moved.");
    expect(r.ok && r.review.name).toBe("Pat");
  });
});

describe("looksAutomated", () => {
  it("passes a person who took their time and left the hidden field empty", () => {
    expect(looksAutomated({ elapsed: 45_000, website: "" })).toBe(false);
  });

  it("catches the hidden field filled, a post faster than anyone types, and a post with no timing", () => {
    expect(looksAutomated({ elapsed: 45_000, website: "https://spam.example" })).toBe(true);
    expect(looksAutomated({ elapsed: MIN_FILL_MS - 1 })).toBe(true);
    expect(looksAutomated({})).toBe(true);
    expect(looksAutomated({ elapsed: "60000" })).toBe(true);
  });
});
