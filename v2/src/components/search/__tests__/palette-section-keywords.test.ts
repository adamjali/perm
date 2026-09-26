import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SECTIONS } from "@/components/tools/dataSections";

/**
 * Every keyword entry in the palette names a rail section that exists. A
 * section renamed in the rail would otherwise leave its keywords attached to
 * nothing, and "naics" would quietly stop finding the industry page.
 */
describe("the palette's section keywords", () => {
  it("are keyed by real rail sections", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "SearchPalette.tsx"), "utf8");
    const block = src.slice(src.indexOf("const SECTION_KEYWORDS"), src.indexOf("function staticIndex"));
    const keys = [...block.matchAll(/^\s+"?([a-z-]+)"?:\s*"/gm)].map((m) => m[1]);
    expect(keys.length, "keyword map looks empty").toBeGreaterThan(5);
    const real = new Set(SECTIONS.map((s) => s.key));
    expect(keys.filter((k) => !real.has(k as never))).toEqual([]);
  });
});
