import { describe, expect, it } from "vitest";

import { PAGE_KEYWORDS, MAIN_JOBS } from "@/lib/search/siteIndex";
import { PAGE_NAMES } from "@/lib/siteMap";

/**
 * Every keyword entry and every "main job" in the palette names a page the
 * site map knows. A page renamed or moved would otherwise leave its keywords
 * attached to nothing, and "naics" would quietly stop finding the industry page.
 */
describe("the palette's keywords and main jobs", () => {
  it("are keyed by real pages", () => {
    const keys = Object.keys(PAGE_KEYWORDS);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.filter((k) => !PAGE_NAMES.has(k))).toEqual([]);
    expect(MAIN_JOBS.filter((k) => !PAGE_NAMES.has(k))).toEqual([]);
  });
});
