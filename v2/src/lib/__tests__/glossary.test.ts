import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GLOSSARY, glossaryLetters, glossarySorted } from "../glossary";

const PUBLIC = join(process.cwd(), "src/app/(site)/(public)");
const GUIDES = join(process.cwd(), "content/guides");

/** Whether an internal href resolves to a page in the public tree or a guide. */
function routeExists(href: string): boolean {
  const path = href.split("#")[0] ?? "";
  if (path.startsWith("/guides/")) return existsSync(join(GUIDES, `${path.slice("/guides/".length)}.mdx`));
  return existsSync(join(PUBLIC, path.slice(1), "page.tsx"));
}

describe("glossary", () => {
  it("has unique slugs and terms", () => {
    const slugs = GLOSSARY.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const terms = GLOSSARY.map((t) => t.term.toLowerCase());
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("keeps every definition short enough to stay a glossary entry", () => {
    for (const t of GLOSSARY) {
      expect(t.definition.length, `${t.term}: ${t.definition.length} chars`).toBeLessThanOrEqual(400);
      expect(t.definition.length, `${t.term} is too thin`).toBeGreaterThan(80);
    }
  });

  it("points every see-also at a page that exists", () => {
    for (const t of GLOSSARY) {
      for (const s of t.see ?? []) {
        expect(routeExists(s.href), `${t.term} -> ${s.href}`).toBe(true);
      }
    }
    // Control: the check can see a missing route.
    expect(routeExists("/no-such-page-anywhere")).toBe(false);
  });

  it("cites only eCFR sections", () => {
    for (const t of GLOSSARY) {
      if (t.cite) expect(t.cite.href).toMatch(/^https:\/\/www\.ecfr\.gov\/current\/title-(8|20)\//);
    }
  });

  it("sorts case-insensitively and lists each first letter once", () => {
    const sorted = glossarySorted().map((t) => t.term);
    expect(sorted).toEqual([...sorted].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
    const letters = glossaryLetters();
    expect(new Set(letters).size).toBe(letters.length);
    expect(letters.length).toBeGreaterThan(10);
  });
});
