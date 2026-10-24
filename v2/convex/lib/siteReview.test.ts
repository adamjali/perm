import { describe, expect, it } from "vitest";

import { checkReview, isHoneypot, isQuick, MIN_FILL_MS, REVIEW_NAME_MAX, REVIEW_TEXT_MAX, checkNote, NOTE_MAX } from "./siteReview";

const good = { rating: 5, text: "Told me the day my case moved.", name: "Pat" };

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

  it("refuses a rating that isn't a whole number from 1 to 5, naming the stars", () => {
    for (const rating of [0, 6, 4.5, "5", null, Number.NaN]) {
      const r = checkReview({ ...good, rating });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.field).toBe("rating");
    }
  });

  it("takes a rating on its own, or with a word or two", () => {
    for (const text of [undefined, null, "", "   ", "Great"]) {
      const r = checkReview({ ...good, text });
      expect(r.ok, String(text)).toBe(true);
      if (r.ok) expect(r.review.text).toBe(text === "Great" ? "Great" : "");
    }
  });

  it("keeps paragraphs but no runs of blank lines", () => {
    const r = checkReview({ ...good, text: "First line.\r\n\r\n\r\n\r\nSecond   line.  \n  Third." });
    expect(r.ok && r.review.text).toBe("First line.\n\nSecond line.\nThird.");
  });

  it("refuses an overlong review, and a missing or overlong name, each naming its field", () => {
    const long = checkReview({ ...good, text: "x".repeat(REVIEW_TEXT_MAX + 1) });
    expect(!long.ok && long.field).toBe("text");
    expect(checkReview({ ...good, text: 42 }).ok).toBe(false);
    const blank = checkReview({ ...good, name: "   " });
    expect(!blank.ok && blank.field).toBe("name");
    expect(checkReview({ ...good, name: "x".repeat(REVIEW_NAME_MAX + 1) }).ok).toBe(false);
  });

  it("refuses a malformed or overlong email before trying the pattern", () => {
    const bad = checkReview({ ...good, email: "not an email" });
    expect(!bad.ok && bad.field).toBe("email");
    expect(checkReview({ ...good, email: `${"a".repeat(260)}@example.com` }).ok).toBe(false);
  });

  it("refuses links, web addresses and email addresses in the review or the name", () => {
    for (const text of [
      "Great tool, see https://spam.example for more",
      "Visit www.cheap-meds.example today, really",
      "Loved it. Buy followers at followersnow.com now",
      "Write to me at someone@example.com about it",
      "Full-width trick: ｈｔｔｐｓ://spam.example",
      "Full-width domain: followersnow．ｃｏｍ",
    ]) {
      const r = checkReview({ ...good, text });
      expect(r.ok, text).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/link|address/i);
    }
    const name = checkReview({ ...good, name: "Pat from spam.example.com" });
    expect(!name.ok && name.field).toBe("name");
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

  it("strips direction overrides and control characters, and keeps the joiners Indic and Persian need", () => {
    const r = checkReview({ ...good, text: "Told me‮ the day\u0007 my case﻿ moved.", name: "Pat⁦" });
    expect(r.ok && r.review.text).toBe("Told me the day my case moved.");
    expect(r.ok && r.review.name).toBe("Pat");
    const hindi = "क्‍ष"; // a conjunct written with a zero-width joiner
    const persian = "می‌خواهم"; // a word written with a zero-width non-joiner
    const kept = checkReview({ ...good, text: `${hindi} ${persian}` });
    expect(kept.ok && kept.review.text).toBe(`${hindi} ${persian}`);
  });
});

describe("telling a script from a person", () => {
  it("the hidden field filled is a script", () => {
    expect(isHoneypot({ website: "https://spam.example" })).toBe(true);
    expect(isHoneypot({ website: "" })).toBe(false);
    expect(isHoneypot({})).toBe(false);
  });

  it("a send faster than a person, or with no timing, is marked quick", () => {
    expect(isQuick({ elapsed: 45_000 })).toBe(false);
    expect(isQuick({ elapsed: MIN_FILL_MS - 1 })).toBe(true);
    expect(isQuick({})).toBe(true);
    expect(isQuick({ elapsed: "60000" })).toBe(true);
  });
});

describe("checkNote", () => {
  it("tidies a private note like a review, keeps a link (only the owner reads it), and refuses an empty or huge one", () => {
    expect(checkNote("  Add RFI\u202E alerts.\r\n\r\n\r\nThanks  ")).toEqual({ ok: true, note: "Add RFI alerts.\n\nThanks" });
    expect(checkNote("See https://example.com/page")).toEqual({ ok: true, note: "See https://example.com/page" });
    expect(checkNote("   ").ok).toBe(false);
    expect(checkNote(42).ok).toBe(false);
    expect(checkNote("x".repeat(NOTE_MAX + 1)).ok).toBe(false);
  });
});
