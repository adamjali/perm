import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The three reference pages that collapsed on 2026-09-13, and the invariants
 * that make collapsing safe.
 *
 * Adam: "no you shouldn't leave anything alone check and fix everything plz".
 * Measured before the change, visible prose words: /glossary 2,386 (95% of
 * the page), /perm-case-statuses 2,005 (91%), /methodology 1,337 (87%),
 * against 670 for a comparable gov.uk service page.
 *
 * COLLAPSING IS ONLY SAFE IF THREE THINGS HOLD, and each is asserted rather
 * than assumed:
 *
 *  1. Every word stays in the DOM. <details> keeps its body whether open or
 *     shut, so a crawler reads the full definition either way - but only if
 *     the long-form field is still RENDERED. A refactor that trimmed it to
 *     shorten the page would take it out of search, which is the difference
 *     between collapsing and deleting.
 *  2. No entry opens by default. A dictionary is arrived at with one term in
 *     mind; an open first entry reintroduces the wall for everyone else.
 *  3. The anchor stays on the <details> ELEMENT. /perm-case-statuses has a
 *     "Jump to a status" nav and a DefinedTermSet whose @ids both target
 *     `#<anchor>`; /glossary has per-term ids. A fragment jump must land on
 *     the visible summary row whether or not the browser auto-expands the
 *     body - so the id cannot move inside.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const PAGES = {
  glossary: read("src/app/(site)/(public)/glossary/page.tsx"),
  statuses: read("src/app/(site)/(public)/perm-case-statuses/page.tsx"),
  methodology: read("src/app/(site)/(public)/methodology/page.tsx"),
};

describe("every word stays in the DOM", () => {
  it("/glossary still renders the whole definition (lead AND rest)", () => {
    expect(PAGES.glossary).toContain("{lead}");
    expect(PAGES.glossary).toContain("{rest.join(\" \")}");
  });
  it("/perm-case-statuses still renders the rest of each summary, the clock, who acts and the source", () => {
    for (const field of ["{rest}", "{m.deadline}", "{m.action}", "<Source cite={m.cite}", "<Source cite={e.cite}"]) {
      expect(PAGES.statuses).toContain(field);
    }
  });
  it("/methodology still renders how and counted-over for every traced figure", () => {
    expect(PAGES.methodology).toContain("{t.how}");
    expect(PAGES.methodology).toContain("{t.population}");
  });
});

describe("no entry opens by default", () => {
  it.each(Object.entries(PAGES))("%s has no <details open>", (_name, src) => {
    expect(src).not.toMatch(/<details[^>]*\bopen\b/);
  });
  it("/methodology's register does not ask DisclosureList to open its first entry", () => {
    // DisclosureList defaults to closed; passing openFirst here would
    // reintroduce the wall for the one figure nobody asked about.
    const call = PAGES.methodology.slice(PAGES.methodology.indexOf("<DisclosureList"));
    expect(call.slice(0, call.indexOf("/>"))).not.toContain("openFirst");
  });
});

describe("the anchor stays on the <details> element", () => {
  it("/glossary puts the term's id on the <details>", () => {
    expect(PAGES.glossary).toMatch(/<details\s+key=\{t\.slug\}\s+id=\{t\.slug\}/);
  });
  it("/perm-case-statuses puts every status anchor on the <details>", () => {
    expect(PAGES.statuses).toMatch(/<details\s+id=\{anchor\}/);
    expect(PAGES.statuses).toMatch(/<details\s+key=\{m\.status\}\s+id=\{anchor\}/);
    // And nothing else claims those ids.
    expect(PAGES.statuses).not.toMatch(/<(div|article)\s+[^>]*id=\{anchor\}/);
  });
  it("the jump nav and the DefinedTermSet still target the same anchors", () => {
    expect(PAGES.statuses).toContain("href={`#${a.anchor}`}");
    expect(PAGES.statuses).toContain("#${statusAnchor(m.status)}`");
  });
});

describe("splitLead cuts at a sentence, never inside a section number", () => {
  // Both pages carry the same helper by design; assert the rule on both.
  const helpers = [
    ["glossary", PAGES.glossary],
    ["statuses", PAGES.statuses],
  ] as const;
  it.each(helpers)("%s splits on '. ' (period + space)", (_n, src) => {
    expect(src).toContain('indexOf(". ")');
    expect(src).not.toMatch(/split\(["']\.["']\)/);
  });
  it("behaves correctly on a definition that cites 20 CFR 656.40 mid-sentence", () => {
    // Re-derive the helper from its source so this cannot pass on a stale copy.
    const body = PAGES.statuses.match(/function splitLead\(text: string\)[^{]*\{([\s\S]*?)\n\}/)?.[1];
    expect(body).toBeTruthy();
    const splitLead = new Function("text", body!) as (t: string) => [string, string];
    expect(splitLead("Valid under 20 CFR 656.40 for 90 days. Then it lapses."))
      .toEqual(["Valid under 20 CFR 656.40 for 90 days.", "Then it lapses."]);
    expect(splitLead("One sentence, no split.")).toEqual(["One sentence, no split.", ""]);
  });
});
