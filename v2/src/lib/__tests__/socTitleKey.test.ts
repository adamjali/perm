import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { keyOfSlug, titleKey, titleSlug } from "../socTitleKey";

/** The builder and the site key a title one way: the fixture scripts/test_soc_titles.py also reads. */
const FIXTURE = JSON.parse(readFileSync(join(process.cwd(), "scripts/fixtures/soc_title_keys.json"), "utf8")) as {
  cases: [string, string][];
};

describe("titleKey", () => {
  it("reads the shared fixture", () => {
    expect(FIXTURE.cases.length).toBeGreaterThanOrEqual(15);
  });

  it.each(FIXTURE.cases)("%j keys as %j", (raw, want) => {
    expect(titleKey(raw)).toBe(want);
  });
});

describe("title page addresses", () => {
  it("round-trips a key", () => {
    expect(titleSlug("software engineer")).toBe("software-engineer");
    expect(keyOfSlug("software-engineer")).toBe("software engineer");
  });

  it("refuses an address no key makes", () => {
    for (const bad of ["Software-Engineer", "software--engineer", "-x", "x-", "a/b", "", "a".repeat(121)]) {
      expect(keyOfSlug(bad), bad).toBeNull();
    }
  });
});
