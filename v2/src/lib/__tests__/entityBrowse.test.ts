import { describe, expect, it } from "vitest";

import {
  BROWSE_BUCKETS,
  BROWSE_KINDS,
  BROWSE_OTHER,
  browseHref,
  bucketLabel,
  bucketOf,
  bucketPhrase,
  bucketRanges,
  isBrowseBucket,
  type BrowseBucket,
} from "@/lib/entityBrowse";
import { MIN_TOTAL_FOR_PAGE, hasOwnPage } from "@/lib/entityPayload";

/**
 * The A-Z partition, proved rather than assumed.
 *
 * `bucketOf` and `bucketRanges` are two vocabularies for one boundary:
 * membership as the app computes it, and membership as SQL selects it. If they
 * drift, some entity belongs to a bucket whose query never reaches it - and
 * the symptom is not an error, it is a page that quietly stops being linked
 * from anywhere, which is the exact defect the whole browse tier exists to
 * remove. So the assertion is that they are inverses over the entire
 * first-character space, not that they agree on a handful of examples.
 *
 * String comparison in JS is UTF-16 code-unit order and in SQLite (BINARY
 * collation on a plain TEXT column) it is UTF-8 byte order. Those agree for
 * every character in the BMP below U+E000, and slugify emits only `[a-z0-9-]`,
 * so the two orderings cannot disagree on anything this table holds.
 */

/** Does this bucket's SQL predicate select `slug`? */
function selects(bucket: BrowseBucket, slug: string): boolean {
  return bucketRanges(bucket).some(([lo, hi]) => slug >= lo && slug < hi);
}

/** Every printable ASCII lead character, plus a few beyond it. */
function candidateSlugs(): string[] {
  const out: string[] = [];
  for (let code = 0x20; code <= 0x7e; code += 1) {
    out.push(`${String.fromCharCode(code)}cme-holdings-inc`);
  }
  // Real shapes from the corpus, and two that slugify cannot currently emit
  // but that the partition must still place somewhere rather than lose.
  out.push(
    "3m-co",
    "zzz-consulting",
    "a",
    "0",
    "9-west",
    "-leading-dash",
    "école-normale",
    "企業",
  );
  return out;
}

describe("the browse partition", () => {
  it("is 27 unique buckets: a-z plus one for everything else", () => {
    expect(BROWSE_BUCKETS).toHaveLength(27);
    expect(new Set(BROWSE_BUCKETS).size).toBe(27);
    expect(BROWSE_BUCKETS.at(-1)).toBe(BROWSE_OTHER);
    for (const b of BROWSE_BUCKETS) expect(isBrowseBucket(b)).toBe(true);
  });

  it("refuses anything that is not a bucket, including path tricks", () => {
    for (const bad of ["", "A", "aa", "0", "9", "..", "../../etc", "%2e", "zz"]) {
      expect(isBrowseBucket(bad)).toBe(false);
    }
  });

  it("puts every possible slug in EXACTLY ONE bucket", () => {
    // The coverage half: no slug can be missing from the index, and no slug
    // can be listed on two letters. Print the sample size first - a test that
    // silently iterated nothing would read exactly like a pass.
    const slugs = candidateSlugs();
    expect(slugs.length).toBeGreaterThan(90);
    for (const slug of slugs) {
      const owners = BROWSE_BUCKETS.filter((b) => selects(b, slug));
      expect({ slug, owners }).toEqual({ slug, owners: [bucketOf(slug)] });
    }
  });

  it("routes a-z to their own letter and everything else to the digits bucket", () => {
    expect(bucketOf("apple-inc")).toBe("a");
    expect(bucketOf("zebra-llc")).toBe("z");
    expect(bucketOf("3m-co")).toBe(BROWSE_OTHER);
    expect(bucketOf("")).toBe(BROWSE_OTHER);
    // Uppercase cannot appear (slugify lowercases) and must NOT be mistaken
    // for its letter: "A" sorts below "a" in binary order, so a bucket that
    // claimed it would be claiming a range its SQL never selects.
    expect(bucketOf("Acme")).toBe(BROWSE_OTHER);
  });

  it("gives a letter one half-open range and the residue two", () => {
    expect(bucketRanges("a")).toEqual([["a", "b"]]);
    expect(bucketRanges("z")).toEqual([["z", "{"]]);
    // The complement, not a hardcoded "0" to "a". Anything above "z" has to be
    // caught too, or a future slug rule that admits a new character would
    // silently drop those entities out of every index.
    expect(bucketRanges(BROWSE_OTHER)).toHaveLength(2);
    expect(bucketRanges(BROWSE_OTHER)[0]![0]).toBe("");
  });

  it("labels and phrases each bucket for the two places they read differently", () => {
    expect(bucketLabel("s")).toBe("S");
    expect(bucketLabel(BROWSE_OTHER)).toBe("0-9");
    // "beginning with S" reads; "beginning with 0-9" does not.
    expect(bucketPhrase("s")).toBe("S");
    expect(bucketPhrase(BROWSE_OTHER)).toBe("a number");
  });
});

describe("browse URLs", () => {
  it("builds every href from one place, so nothing links to a 404", () => {
    expect(browseHref("/perm-employers")).toBe("/perm-employers/browse");
    expect(browseHref("/perm-employers", "s")).toBe("/perm-employers/browse/s");
    expect(browseHref("/perm-wages", BROWSE_OTHER)).toBe("/perm-wages/browse/0-9");
  });

  it("covers all three entity kinds, each pointing at its real hub", () => {
    expect(Object.keys(BROWSE_KINDS).sort()).toEqual([
      "attorney",
      "employer",
      "occupation",
    ]);
    expect(BROWSE_KINDS.employer.base).toBe("/perm-employers");
    expect(BROWSE_KINDS.attorney.base).toBe("/perm-attorneys");
    expect(BROWSE_KINDS.occupation.base).toBe("/perm-wages");
  });
});

describe("what the index is allowed to link", () => {
  it("reuses the canonical page threshold rather than restating it", () => {
    // The browse queries filter on MIN_TOTAL_FOR_PAGE, the same constant the
    // sitemap and the detail pages' noindex rule read. A second definition of
    // "has a page" is an index that links to 404s at scale, so this pins the
    // shared predicate rather than the number.
    expect(hasOwnPage({ total: MIN_TOTAL_FOR_PAGE })).toBe(true);
    expect(hasOwnPage({ total: MIN_TOTAL_FOR_PAGE - 1 })).toBe(false);
  });
});
