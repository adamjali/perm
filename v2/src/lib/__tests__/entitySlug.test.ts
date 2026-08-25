import { describe, expect, it } from "vitest";

import { findBySlug, slugify, withUniqueSlugs } from "../entitySlug";

describe("slugify", () => {
  it("reduces a DOL legal entity name to a URL segment", () => {
    expect(slugify("Microsoft Corporation")).toBe("microsoft-corporation");
    expect(slugify("JPMORGAN CHASE & CO.")).toBe("jpmorgan-chase-co");
    expect(slugify("Ernst & Young U.S. LLP")).toBe("ernst-young-u-s-llp");
  });

  it("never leaves a trailing separator, including after the length cap", () => {
    const long = "A".repeat(58) + " Corporation";
    expect(slugify(long).endsWith("-")).toBe(false);
    expect(slugify("Trailing punctuation, ")).toBe("trailing-punctuation");
  });

  it("survives a name with nothing sluggable in it", () => {
    expect(slugify("&&&")).toBe("");
  });
});

describe("withUniqueSlugs", () => {
  it("gives the two real colliding DOL spellings different URLs", () => {
    // Both of these are in the live top-100 and both reduce to the same base.
    const rows = [
      { name: "NORMAN W. FRIES, INC", total: 514 },
      { name: "Norman W. Fries, Inc.", total: 242 },
    ];
    const slugged = withUniqueSlugs(rows, (r) => r.name);
    expect(slugged[0]!.slug).toBe("norman-w-fries-inc");
    expect(slugged[1]!.slug).toBe("norman-w-fries-inc-2");
    expect(new Set(slugged.map((s) => s.slug)).size).toBe(2);
  });

  it("gives the busier entity the clean slug, since the caller sorts by volume", () => {
    const rows = [
      { name: "Acme Inc", total: 900 },
      { name: "ACME, INC.", total: 100 },
    ];
    const slugged = withUniqueSlugs(rows, (r) => r.name);
    expect(findBySlug(slugged, "acme-inc")?.total).toBe(900);
    expect(findBySlug(slugged, "acme-inc-2")?.total).toBe(100);
  });

  it("falls back rather than emitting an empty URL segment", () => {
    const slugged = withUniqueSlugs([{ name: "&&&" }], (r) => r.name);
    expect(slugged[0]!.slug).toBe("entity");
  });

  it("returns undefined for a slug that is not in the set", () => {
    const slugged = withUniqueSlugs([{ name: "Acme Inc" }], (r) => r.name);
    expect(findBySlug(slugged, "nope")).toBeUndefined();
  });
});
