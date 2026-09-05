import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The surfaces a MACHINE reads must not describe this as PERM-only.
 *
 * The site takes case numbers for all three DOL programs - PERM (`G-`),
 * prevailing wage requests (`P-`) and H-1B LCAs (`I-200`/`I-203`) - and will
 * also find a case by employer name when the reader has no number at all.
 *
 * An audit in September 2026 fixed 41 places where a reader would form the
 * wrong belief about that, after Google's AI Mode twice stated the site could
 * not look up a pending `P-` case. **That audit walked live PAGES, so it could
 * not see either surface below**, and both still said "check any PERM case
 * number" afterwards:
 *
 *   - `llms.txt` is a route handler, not a page. Its blockquote summary is the
 *     single most quotable line on the site for an LLM.
 *   - the JSON-LD `description` in `structuredData.ts` renders on EVERY page.
 *
 * Deliberately narrow: it asserts the three prefixes are present, not how the
 * sentence is phrased. A gate that tried to judge the framing semantically
 * would flag every honest mention of PERM on a PERM-heavy site.
 */

const SURFACES = [
  "src/app/llms.txt/route.ts",
  "src/lib/structuredData.ts",
] as const;

/** The three program prefixes, as a reader would recognise them. */
const PREFIXES = [/\bG-/, /\bP-/, /\bI-20[03]\b/];

describe("machine-read copy covers all three DOL programs", () => {
  it.each(SURFACES)("%s names every program prefix", (rel) => {
    const src = readFileSync(path.join(process.cwd(), rel), "utf8");
    // A file that shrank to nothing would pass a "no bad phrase" check while
    // saying nothing at all, so assert it still has substance first.
    expect(src.length).toBeGreaterThan(2000);
    const missing = PREFIXES.filter((re) => !re.test(src)).map(String);
    expect(missing).toEqual([]);
  });

  it.each(SURFACES)("%s does not claim PERM-only lookup", (rel) => {
    const src = readFileSync(path.join(process.cwd(), rel), "utf8");
    // The exact phrasing that shipped, and its near neighbours. Not a general
    // "mentions PERM" rule - that would be unusable on this site.
    const banned = [
      /check any PERM case number/i,
      /any PERM case number for/i,
      /PERM case numbers? only/i,
    ];
    const hits = banned.filter((re) => re.test(src)).map(String);
    expect(hits).toEqual([]);
  });
});
