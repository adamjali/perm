import { describe, expect, it } from "vitest";
import { readFileSync, globSync } from "node:fs";

/**
 * Every Dataset must declare a `license`.
 *
 * Search Console emailed on 2026-09-10: "Missing field 'license'", one page
 * affected. It was `/visa-bulletin/family`, shipped two days earlier.
 *
 * THIS IS THE SECOND TIME A HAND-ROLLED DATASET HAS MISSED A FIELD AND GOOGLE
 * HAS HAD TO TELL US. The first was `creator` on `/perm-processing-times`
 * (2026-09-02, see dataset-creator-type.test.ts). Both have the same cause:
 * sixteen pages emit a Dataset, fourteen build it through `getDatasetSchema`
 * and inherit its defaults, and the two that hand-roll their own inherit
 * nothing. A page author writing a literal has no way to know what the shared
 * builder would have added.
 *
 * So this checks the property rather than the mechanism: a page may still
 * hand-roll a Dataset - `/perm-processing-times` and `/visa-bulletin/family`
 * both do it for good reason, because their creator is a federal agency rather
 * than this site - but it may not ship one without a licence.
 *
 * Scans source rather than rendered HTML for the same reason the creator gate
 * does: the defect is a missing literal, and catching it should not require
 * building and crawling every Dataset page.
 */

/** Rough end of the object literal that opens at `from`. */
function literalAfter(src: string, from: number): string {
  // Far enough to cover the longest Dataset literal on the site and short
  // enough not to run into the next schema block.
  return src.slice(from, from + 2500);
}

describe("Dataset license", () => {
  const files = globSync("src/app/**/*.tsx", { cwd: process.cwd() });

  it("scanned a plausible number of files", () => {
    // A broken glob would make every assertion below vacuous.
    expect(files.length).toBeGreaterThan(50);
  });

  it("every hand-rolled Dataset declares a license", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Pages that go through the shared builder inherit its license.
      //
      // Matched as a CALL, not a substring. The first version of this line was
      // `src.includes("getDatasetSchema")`, and the fix it was written to
      // protect carries a comment that mentions `getDatasetSchema` by name -
      // so the gate skipped the very file it existed for and passed while the
      // licence was deleted. Caught by probing rather than by reading: the
      // mutation landed (1 occurrence -> 0) and the test still went green.
      if (/getDatasetSchema\s*\(/.test(src)) continue;

      for (const m of src.matchAll(/["']@type["']\s*:\s*["']Dataset["']/g)) {
        if (!/\blicense\s*:/.test(literalAfter(src, m.index ?? 0))) {
          offenders.push(file);
        }
      }
    }

    expect(
      [...new Set(offenders)],
      "these pages hand-roll a Dataset with no `license`, which is what Search " +
        "Console emails about. Add one, or build the schema with getDatasetSchema.",
    ).toEqual([]);
  });

  it("the shared builder still emits one", () => {
    // Fourteen of the sixteen Datasets depend on this single line.
    const src = readFileSync("src/lib/structuredData.ts", "utf8");
    expect(/license:\s*`?\$?\{?baseUrl/.test(src), "getDatasetSchema dropped its license").toBe(true);
  });
});
