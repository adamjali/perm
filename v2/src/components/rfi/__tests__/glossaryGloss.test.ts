import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ENTRIES } from "../StageGlossary";

/**
 * The one-line gloss on every status, and the collapse it exists to serve.
 *
 * WHY THE FIELD IS REQUIRED. The glossary used to render all ten entries fully
 * expanded - a definition, a deadline, a what-follows and a sourcing note each,
 * stacked down the page. Measured on the live site 2026-09-13 that section was
 * over half of `/perm-rfi-audit`'s 3,277 VISIBLE words, against 670 for a
 * comparable gov.uk service page. Collapsed, the same content is a dictionary
 * index, and the gloss is the line that makes the index usable.
 *
 * WHAT THE COLLAPSE MUST NOT COST. `<details>` keeps its body in the DOM, so a
 * crawler reads the full definition whether the entry is open or shut. That is
 * the whole reason this is safe, and it is asserted below rather than assumed:
 * the rendered source must still contain the long-form text.
 */

const SRC = readFileSync(
  join(process.cwd(), "src/components/rfi/StageGlossary.tsx"),
  "utf8",
);

describe("every entry carries a usable gloss", () => {
  it("has entries at all, so a vacuous pass is impossible", () => {
    expect(ENTRIES.length).toBeGreaterThanOrEqual(10);
  });

  it.each(ENTRIES.map((e) => [e.term ?? e.status ?? "?", e] as const))(
    "%s",
    (_label, e) => {
      expect(e.gloss.trim()).not.toBe("");
      // One line beside the term at a phone width. Ten words is comfortable,
      // fourteen is the ceiling before it wraps to three lines on a 320px
      // screen and stops being a scannable index.
      const n = e.gloss.trim().split(/\s+/).length;
      expect(n).toBeLessThanOrEqual(14);
      // A DEFINITION, NOT A TEASER. "What this means" or "Read more" would
      // make the closed list useless and the open one mandatory.
      expect(e.gloss.trim()).toMatch(/[.:]$/);
      expect(e.gloss.toLowerCase()).not.toMatch(/read more|learn more|click|see below/);
      // It must not simply repeat the term it sits under.
      const term = (e.term ?? e.status ?? "").toLowerCase();
      expect(e.gloss.trim().toLowerCase()).not.toBe(term);
    },
  );

  it("a gloss is never just the opening of `what` verbatim", () => {
    // If it were, the closed row and the first line of the open body would be
    // the same sentence twice, which reads as a rendering bug.
    for (const e of ENTRIES) {
      expect(e.what.startsWith(e.gloss)).toBe(false);
    }
  });
});

describe("the collapse keeps every word for search", () => {
  it("renders the long-form fields, not only the gloss", () => {
    // The bodies are `{e.what}`, `{e.deadline}`, `{e.next}`, `{e.unsourced}`.
    // A refactor that dropped one to shorten the page would take it out of the
    // DOM too, which is the difference between collapsing and deleting.
    for (const field of ["{e.what}", "{e.deadline}", "{e.next}", "{e.unsourced}"]) {
      expect(SRC).toContain(field);
    }
  });

  it("uses native <details>, not a JS disclosure", () => {
    // A controlled component would render only the open entry, so the closed
    // definitions would leave the DOM and the search cost would be real.
    expect(SRC).toContain("<details key={label}");
    expect(SRC).not.toMatch(/useState|aria-expanded=\{/);
  });

  it("no entry is open by default, so the page opens as an index", () => {
    // `<details open>` on any entry reintroduces the wall for the term nobody
    // asked about.
    expect(SRC).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it("the count and its date stay visible when the entry is shut", () => {
    // A reader scanning "how many are at this stage" should not have to open
    // ten doors. CountBadge must sit inside the <summary>, not the body.
    const summary = SRC.slice(SRC.indexOf("<summary"), SRC.indexOf("</summary>"));
    expect(summary).toContain("<CountBadge");
    expect(summary).toContain("{e.gloss}");
  });
});
