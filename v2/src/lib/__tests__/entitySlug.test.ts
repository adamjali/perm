import { describe, expect, it } from "vitest";

import fixtures from "../__fixtures__/entityIdentity.json";
import { entityKey, findBySlug, slugify, withUniqueSlugs } from "../entitySlug";

/**
 * The TypeScript half of a contract whose other half is Python.
 *
 * `scripts/entity_identity.py` writes the entity table and this module reads
 * it, so a key computed differently in the two is a detail page that 404s
 * from its own index. Neither can import the other, so both run against ONE
 * fixture file and `scripts/test_entity_identity.py` asserts the same rows.
 */
describe("entityKey (mirrored in scripts/entity_identity.py)", () => {
  it.each(fixtures.keys as Array<[string, string]>)(
    "%s -> %s",
    (raw, want) => {
      expect(entityKey(raw)).toBe(want);
    },
  );

  it("re-glues a punctuation-shredded legal suffix so the noise list sees it", () => {
    // The whole bug: `P.C.` shredded to `p` + `c`, and a noise list that has
    // always contained "pc" never matched it. 604 pairs of firms were two
    // firms with two pages and two ranks because of this one ordering.
    expect(entityKey("Jackson Lewis P.C.")).toBe(entityKey("Jackson Lewis PC"));
    expect(entityKey("SAMSUNG AUSTIN SEMICONDUCTOR, L.L.C.")).toBe(
      entityKey("SAMSUNG AUSTIN SEMICONDUCTOR, LLC"),
    );
  });

  it("keeps a re-glued run that is a real word rather than a suffix", () => {
    // Control. If this ever collapses, every assertion above is passing for
    // the wrong reason: the re-glue would be merging firms, not suffixes.
    expect(entityKey("Ernst & Young U.S. LLP")).not.toBe(entityKey("Ernst & Young LLP"));
  });

  it.each(fixtures.must_not_merge as Array<[string, string]>)(
    "keeps %s apart from %s",
    (a, b) => {
      // Every pair here was proposed by a looser version of the identity rule
      // and is two different parties. Over-merging misattributes one entity's
      // approval rate to another, which is worse than printing two rows.
      expect(entityKey(a)).not.toBe(entityKey(b));
    },
  );

  it("falls back rather than collapsing every noise-only name into one key", () => {
    expect(entityKey("The Company")).toBe("the company");
    expect(entityKey("&&&")).toBe("");
  });
});

describe("slugify", () => {
  it.each(fixtures.slugs as Array<[string, string]>)("%s -> %s", (raw, want) => {
    expect(slugify(raw)).toBe(want);
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
