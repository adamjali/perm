import { describe, it, expect } from "vitest";
import { metadata as loginMetadata } from "../login/page";
import { metadata as signupMetadata } from "../signup/page";

describe("(auth) pages noindex metadata", () => {
  // Auth pages should never appear in SERPs. Per Google: robots.txt Disallow
  // blocks crawl but NOT indexing — Google can still index a Disallowed URL
  // it learns about from inbound links. The right signal is per-page
  // `metadata.robots: { index: false, follow: true }`. These tests lock that
  // contract; dropping the `robots` field would re-expose them to indexing.

  it("/login is noindex,follow", () => {
    expect(loginMetadata.robots).toEqual({ index: false, follow: true });
  });

  it("/signup is noindex,follow", () => {
    expect(signupMetadata.robots).toEqual({ index: false, follow: true });
  });

  it("both keep a defined canonical (still useful for any inbound link normalization)", () => {
    expect(loginMetadata.alternates?.canonical).toBe("/login");
    expect(signupMetadata.alternates?.canonical).toBe("/signup");
  });
});
