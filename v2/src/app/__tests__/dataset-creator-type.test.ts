import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import path from "node:path";

/**
 * A Dataset's `creator` must be `Organization` or `Person`, never a subtype.
 *
 * Search Console flagged `/perm-processing-times` on 2026-09-02 with "Invalid
 * object type for field creator". The value was `GovernmentOrganization`, which
 * is perfectly good schema.org - it IS an Organization - but Google's Dataset
 * parser matches the type literally and does not walk the class hierarchy. The
 * more precise answer was the rejected one.
 *
 * Exactly one item was affected because every other Dataset on the site takes
 * its creator as an `@id` reference to the shared Organization node
 * (`getDatasetSchema`); only this page hand-rolled an inline creator. So the
 * rule this guards is narrow: an INLINE creator object in a page's schema must
 * use the bare type.
 *
 * Scans source rather than rendered HTML on purpose - the defect is in a
 * literal, and a rendered check would need every Dataset page built and
 * crawled to catch a one-line typo.
 */

const ALLOWED = new Set(["Organization", "Person"]);

describe("Dataset creator type", () => {
  it("no page declares a creator with a schema.org subtype", () => {
    const files = globSync("src/app/**/*.tsx", { cwd: process.cwd() });
    // A plausible file count, so a broken glob cannot read as a clean pass.
    expect(files.length).toBeGreaterThan(50);

    const bad: string[] = [];
    for (const rel of files) {
      const src = readFileSync(path.join(process.cwd(), rel), "utf8");
      if (!src.includes("creator:")) continue;
      // Match the @type on the line after an inline `creator: {`.
      for (const m of src.matchAll(/creator:\s*\{[^}]*?"@type":\s*"([A-Za-z]+)"/g)) {
        const type = m[1]!;
        if (!ALLOWED.has(type)) bad.push(`${rel}: creator @type "${type}"`);
      }
    }
    expect(bad).toEqual([]);
  });
});
