import { describe, expect, it } from "vitest";

import { checkReview, REVIEW_NAME_MAX, REVIEW_TEXT_MAX } from "./siteReview";

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
});
