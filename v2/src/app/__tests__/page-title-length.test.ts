import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every title Google will show fits in what Google will show.
 *
 * The sibling gate next door caps DESCRIPTIONS and nothing capped titles, so
 * they drifted: on 2026-09-21 an Ahrefs crawl of 5,002 URLs reported 88
 * over-length titles, and measuring all 354 static pages ourselves found
 * **134**. Ninety-six were one template - `/visa-bulletin/[month]` rendered
 * "Visa Bulletin {Month} {Year}: Every EB Cutoff and What Moved | PERM
 * Tracker", 73-75 characters on every month page - and the other 38 were
 * hand-written titles that had each crept a few characters past the line.
 *
 * Google cuts a title around 600px, about 60 characters. Past that the tail is
 * dropped, and the tail is where the brand sits: a 74-character title loses
 * "| PERM Tracker" in every result it appears in.
 *
 * THE BRAND SUFFIX COUNTS. `src/app/layout.tsx` sets
 * `template: "%s | PERM Tracker"`, so a page exporting `title: "X"` renders
 * `X | PERM Tracker`. Only `title: { absolute }` escapes it, and that is the
 * documented escape hatch for an entity name too long to cut - which is why
 * this gate reads the absolute form as the whole title rather than skipping it.
 *
 * Dynamic segments are out of scope for the same reason as the description
 * gate: one `generateMetadata` serves every slug there, so the entity-title
 * rules (`entityTitle`) own that class and are tested with it.
 */
const PUBLIC = join(__dirname, "..", "(site)", "(public)");
const CONTENT = join(__dirname, "..", "..", "..", "content");
const CAP = 60;
const SUFFIX = " | PERM Tracker";

/** An interpolation whose value is unknown statically; assume a realistic width. */
const PLACEHOLDER = "September 2026";

function staticPages(dir: string, route: string[] = []): Array<{ route: string; file: string }> {
  const out: Array<{ route: string; file: string }> = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith("[")) continue; // dynamic: one generator serves all
      const seg = name.startsWith("(") && name.endsWith(")") ? [] : [name];
      out.push(...staticPages(full, [...route, ...seg]));
    } else if (name === "page.tsx") {
      out.push({ route: "/" + route.join("/"), file: full });
    }
  }
  return out;
}

const widen = (s: string) => s.replace(/\$\{[^}]+\}/g, PLACEHOLDER).replace(/\\"/g, '"');

/** The full <title> this page renders, brand suffix included. */
function titleOf(src: string): string | null {
  const absolute = /title:\s*\{\s*absolute:\s*["`]((?:[^"`\\]|\\.)*)["`]/.exec(src);
  if (absolute?.[1]) return widen(absolute[1]);
  for (const re of [
    /const TITLE\s*=\s*\n?\s*["`]((?:[^"`\\]|\\.)*)["`]/,
    /^\s{2}title:\s*\n?\s*["`]((?:[^"`\\]|\\.)*)["`]/m,
  ]) {
    const m = re.exec(src);
    if (m?.[1]) return widen(m[1]) + SUFFIX;
  }
  return null;
}

/** MDX renders `seoTitle` when present, else the display `title`. */
function contentTitles(): Array<{ route: string; title: string }> {
  const out: Array<{ route: string; title: string }> = [];
  for (const kind of ["blog", "guides", "changelog"]) {
    const dir = join(CONTENT, kind);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".mdx")) continue;
      const src = readFileSync(join(dir, file), "utf8");
      const seo = /^seoTitle:\s*"((?:[^"\\]|\\.)*)"/m.exec(src);
      const plain = /^title:\s*"((?:[^"\\]|\\.)*)"/m.exec(src);
      const raw = seo?.[1] ?? plain?.[1];
      if (raw) out.push({ route: `/${kind}/${file.slice(0, -4)}`, title: raw + SUFFIX });
    }
  }
  return out;
}

const pages = staticPages(PUBLIC);
const content = contentTitles();

describe("titles fit a search result", () => {
  it("finds a plausible number of pages and titles", () => {
    // 60 static pages and 55 content files on 2026-09-21. A path typo would
    // find nothing and read as a pass, which is how a blind gate ships.
    expect(pages.length).toBeGreaterThan(45);
    expect(pages.filter((p) => titleOf(readFileSync(p.file, "utf8"))).length).toBeGreaterThan(40);
    expect(content.length).toBeGreaterThan(40);
  });

  it("would catch the visa-bulletin title that shipped on 96 pages (control)", () => {
    const real = "Visa Bulletin September 2026: Every EB Cutoff and What Moved" + SUFFIX;
    expect(real.length).toBeGreaterThan(CAP);
  });

  it("keeps every static page at or under the cap", () => {
    const over = pages
      .map((p) => ({ ...p, t: titleOf(readFileSync(p.file, "utf8")) }))
      .filter((p) => p.t && p.t.length > CAP)
      .map((p) => `${p.route}: ${p.t!.length} chars`);
    expect(over).toEqual([]);
  });

  it("keeps every article at or under the cap", () => {
    const over = content
      .filter((c) => c.title.length > CAP)
      .map((c) => `${c.route}: ${c.title.length} chars`);
    expect(over).toEqual([]);
  });
});
