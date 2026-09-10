import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every STATIC public page's meta description fits Google's snippet.
 *
 * `pnpm audit:pages` already checks this against the live site and it is not
 * enough on its own: it samples **3 URLs per template**, and `/tools/*` and
 * `/visa-bulletin/*` are not really templates - each of those pages carries its
 * own hand-written `metadata`, and merely shares a URL prefix. On 2026-09-10 the
 * live audit reported exactly one over-length description (`/badges`, 251) while
 * **eight** were being served; the other seven sat on URLs it never fetched.
 *
 * So this gate is static and exhaustive where the live one is live and sampled.
 * Neither replaces the other: this one cannot see a description assembled at
 * request time, and the live one cannot see an unsampled URL.
 *
 * Dynamic segments are deliberately out of scope - one `generateMetadata` serves
 * every slug, so sampling genuinely is sufficient there, and the SOC-title
 * overflow that class is prone to is already gated elsewhere.
 */
const PUBLIC = join(__dirname, "..", "(site)", "(public)");
const CAP = 155;

/** An interpolation whose value is unknown statically; assume a realistic width. */
const PLACEHOLDER = "05/29/26";

function staticPages(dir: string, route: string[] = []): Array<{ route: string; file: string }> {
  const out: Array<{ route: string; file: string }> = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith("[")) continue;                     // dynamic: one generator
      const seg = name.startsWith("(") && name.endsWith(")") ? [] : [name];
      out.push(...staticPages(full, [...route, ...seg]));
    } else if (name === "page.tsx") {
      out.push({ route: "/" + route.join("/"), file: full });
    }
  }
  return out;
}

/** The description this page will render, with interpolations widened. */
function descriptionOf(src: string): string | null {
  const patterns = [
    /const DESCRIPTION\s*=\s*\n?\s*[`"]((?:[^`"\\]|\\.)*)[`"]/,
    /^\s{2}description:\s*\n?\s*"((?:[^"\\]|\\.)*)"/m,
  ];
  for (const re of patterns) {
    const m = re.exec(src);
    if (m?.[1]) return m[1].replace(/\$\{[^}]+\}/g, PLACEHOLDER).replace(/\\"/g, '"');
  }
  return null;
}

const pages = staticPages(PUBLIC);

describe("static public page descriptions", () => {
  it("finds a plausible number of pages and descriptions", () => {
    // 60 static public pages on 2026-09-10. A path typo would read as a pass.
    expect(pages.length).toBeGreaterThan(45);
    const withDesc = pages.filter((p) => descriptionOf(readFileSync(p.file, "utf8")));
    expect(withDesc.length).toBeGreaterThan(40);
  });

  it("would catch the 251-character description that shipped (control)", () => {
    const real =
      "Embeddable SVG badges carrying figures the Department of Labor and the State " +
      "Department publish: the PERM and prevailing wage queues, average decision days, " +
      "visa bulletin cutoffs, and counts of the record. Three shapes, two backgrounds, " +
      "rebuilt daily.";
    expect(real.length).toBeGreaterThan(CAP);
  });

  it("keeps every one at or under the cap", () => {
    const over = pages
      .map((p) => ({ ...p, d: descriptionOf(readFileSync(p.file, "utf8")) }))
      .filter((p) => p.d && p.d.length > CAP)
      .map((p) => `${p.route}: ${p.d!.length} chars`);
    expect(over).toEqual([]);
  });
});
