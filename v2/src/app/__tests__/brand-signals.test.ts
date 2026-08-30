import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getWebSiteSchema } from "@/lib/structuredData";

/**
 * The signals Google corroborates a site name against, pinned.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The homepage H1 has drifted off the brand name twice. Each time the site's
 * markup stayed textbook-correct - `WebSite` schema, `og:site_name` and a title
 * that all say "PERM Tracker" - and each time Google stopped treating the
 * homepage as the page about the brand.
 *
 * Measured 2026-08-29, for the query "perm tracker" (44,259 impressions in 90
 * days, our largest by an order of magnitude): Google ranked `/faq`, which
 * carries an "About PERM Tracker" heading, and the homepage did not appear on
 * the first page at all. Clicks on that query fell 39% while impressions held
 * flat, which is Google's own documented signature of a presentation problem
 * rather than a ranking one.
 *
 * Google's site-names doc names the sources explicitly: `WebSite` structured
 * data is primary, and "our site name system will also consider content in
 * `og:site_name`, `<title>`, heading elements, and other text on a home page."
 * An earlier pass read that, put the name in the lede PARAGRAPH, and left the
 * heading alone. Prose is "other text"; it did not hold. The competitor whose
 * name Google does render has no `WebSite` schema, no `og:site_name` and no
 * canonical - and its H1 is its name.
 *
 * WHAT THIS TEST CAN AND CANNOT SEE
 * ---------------------------------
 * The H1 assertion is a SOURCE check, and source checks have been wrong here
 * before: the glued-text gate read clean for months while 172 defects were
 * served, because it could not see `.map()` output or custom components. This
 * one is narrower - it only asks whether a literal string sits inside the
 * literal <h1> of one file - so it is honest about the one thing it checks and
 * blind to everything else. The rendered check is `scripts/audit_all_pages.py`,
 * which reads the live sitemap.
 */

const HERO = join(process.cwd(), "src/components/home/HeroSection.tsx");
const BRAND = "PERM Tracker";

describe("homepage brand signals", () => {
  it("the hero H1 contains the site name", () => {
    const src = readFileSync(HERO, "utf8");
    const open = src.indexOf("<h1");
    const close = src.indexOf("</h1>", open);

    // Fail loudly rather than vacuously if the file is restructured: a gate
    // that cannot find its subject must not read as a pass.
    expect(open, "no <h1> in HeroSection.tsx").toBeGreaterThan(-1);
    expect(close, "unclosed <h1> in HeroSection.tsx").toBeGreaterThan(open);

    // STRIP JSX COMMENTS FIRST. The first version of this test did not, and it
    // passed with the brand deleted from the heading - because the comment
    // explaining why the brand belongs in the H1 sits inside the H1 and says
    // "PERM Tracker" four times. The gate was reading its own justification and
    // calling it evidence. Caught only by deleting the fix and watching the
    // test stay green, which is the entire reason to probe a gate rather than
    // trust it.
    const heading = src.slice(open, close).replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

    expect(
      heading,
      "The homepage H1 must contain the brand name. Google corroborates the " +
        "declared site name against heading elements, and when this H1 was a " +
        "bare data claim the /faq page took over the brand query.",
    ).toContain(BRAND);
  });
});

describe("homepage meta description", () => {
  const PAGE = join(process.cwd(), "src/app/(site)/(public)/page.tsx");

  /** The `description:` string on the top-level `metadata` export. */
  function homepageDescription(): string {
    const src = readFileSync(PAGE, "utf8");
    // Strip line comments first: the explanation above this field names the
    // phrase the assertion looks for, and matching that instead of the copy
    // would pass with the description empty. Same trap the H1 gate above hit.
    const clean = src.replace(/^\s*\/\/.*$/gm, "");
    const meta = clean.indexOf("export const metadata");
    const og = clean.indexOf("openGraph", meta);
    expect(meta, "no metadata export in page.tsx").toBeGreaterThan(-1);
    expect(og, "no openGraph block in page.tsx").toBeGreaterThan(meta);
    // Deliberately bounded to BEFORE openGraph: og has its own description,
    // written for a social card rather than a search result, and matching it
    // by accident would make this gate assert the wrong string.
    const m = /description:\s*\n?\s*"((?:[^"\\]|\\.)*)"/.exec(clean.slice(meta, og));
    expect(m, "no description found in the metadata export").not.toBeNull();
    return m![1]!.replace(/\\'/g, "'");
  }

  it("contains the phrase the page competes for", () => {
    // Measured in GSC 2026-08-30: "perm tracker" brought 1,088 of 2,300 clicks
    // over 90 days. The description this replaced was accurate and never said
    // it, so Google substituted text scraped off the page - a sentence from
    // the reviews section plus four trust-badge labels run together.
    expect(homepageDescription()).toContain("PERM Tracker");
  });

  it("fits in a SERP without being truncated", () => {
    // Google truncates around 155 characters. Measured on the UNESCAPED text:
    // house style is contraction-heavy and every apostrophe is six characters
    // as an HTML entity, which is how a compliant description gets reported as
    // over-length by a reader that measures the raw attribute.
    const d = homepageDescription();
    expect(d.length).toBeGreaterThan(70);
    expect(d.length).toBeLessThanOrEqual(155);
  });
});

describe("WebSite schema site-name candidates", () => {
  const schema = getWebSiteSchema("https://permtracker.app");

  it("declares the brand as the primary name", () => {
    expect(schema.name).toBe(BRAND);
  });

  it("offers the lowercase domain as Google's documented backup", () => {
    // "add your domain or subdomain name as your alternative name", and it
    // "needs to be in all lowercase ... for our system to detect this as a
    // site name preference." Google declines our primary name for two reasons
    // markup cannot fix - it is generic, and permtrack.app declares the
    // identical string - so the backup is the only lever we actually hold.
    expect(schema.alternateName).toContain("permtracker.app");
  });
});
