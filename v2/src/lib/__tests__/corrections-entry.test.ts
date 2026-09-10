import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The corrections log is ONE changelog entry now, in the same shape as every
 * release note (Adam, 2026-09-10: "all the corrections, they should be under 1
 * changelog and follow same format as others"). It used to be a typed array in
 * `src/lib/corrections.ts` rendered as fourteen special-cased timeline rows,
 * and that array had a test asserting every entry carried all four parts.
 *
 * Moving to prose is exactly where that discipline goes quietly missing, so
 * this file replaces that gate rather than dropping it: an entry that does not
 * name the page, quote what it said, state what was true and say what changed
 * is a softened correction, which is the one thing this log promises not to be.
 */
const MDX = join(__dirname, "..", "..", "..", "content", "changelog", "corrections.mdx");
const src = readFileSync(MDX, "utf8");
const [, frontmatter, ...rest] = src.split("---");
const body = rest.join("---");
const sections = body.split(/^## /m).slice(1);

describe("the corrections changelog entry", () => {
  it("is a real changelog post, with the frontmatter every other one has", () => {
    for (const key of ["title", "description", "date", "image", "imageAlt", "category", "tags"]) {
      expect(frontmatter, `missing ${key}`).toMatch(new RegExp(`^${key}:`, "m"));
    }
    expect(frontmatter).toMatch(/category: "Correction"/);
    // The same 155-char cap content-frontmatter.test.ts holds every other post to.
    const d = /description:\s*"(.*?)"\s*$/m.exec(frontmatter)?.[1] ?? "";
    expect(d.length).toBeGreaterThan(0);
    expect(d.length).toBeLessThanOrEqual(155);
  });

  it("carries every correction, and each one names all four parts", () => {
    // 14 at the move. It only ever grows: entries are added, never removed.
    expect(sections.length).toBeGreaterThanOrEqual(14);
    for (const s of sections) {
      const heading = s.split("\n")[0] ?? "";
      // "<where> · <Mon D, YYYY>" - the page and the date it shipped.
      expect(heading, `heading: ${heading}`).toMatch(
        /^.+ · (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}$/,
      );
      for (const part of ["**It said:**", "**What was true:**", "**What changed:**"]) {
        expect(s, `${heading} is missing ${part}`).toContain(part);
      }
    }
  });

  it("dates the post to its newest correction", () => {
    const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const iso = (h: string) => {
      const m = /· (\w{3}) (\d{1,2}), (\d{4})$/.exec(h.split("\n")[0] ?? "");
      if (!m) return "";
      const mm = String(MON.indexOf(m[1]!) + 1).padStart(2, "0");
      return `${m[3]}-${mm}-${String(m[2]).padStart(2, "0")}`;
    };
    const newest = sections.map(iso).filter(Boolean).sort().at(-1);
    expect(/date:\s*"(.*?)"/.exec(frontmatter)?.[1]).toBe(newest);
  });

  it("keeps the standard that says what belongs here", () => {
    // The bar is a reader who could have formed a false belief, not a bug.
    expect(body).toMatch(/never removed and\s*\n?never softened/);
    expect(body).toMatch(/false belief/);
  });
});
