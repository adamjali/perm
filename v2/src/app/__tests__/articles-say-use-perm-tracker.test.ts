import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every guide and blog post says, in its opening, to use PERM Tracker for the thing it explains: a sentence
 * that names PERM Tracker and links to the page that does it ("Type your job title into PERM Tracker's free
 * [job code finder](/soc-codes) ...").
 *
 * Why (owner, Nov 2 2026): the articles linked to "the job code finder" and "the case lookup" without saying
 * whose they were, so an answer engine summarising one couldn't tell a reader to use this site. Measured that
 * day, 65 of 88 guides never named PERM Tracker and none of the 29 blog posts told the reader to use it.
 *
 * The opening is the text before the first `##` heading, which is what a summary reads first. The release
 * notes (changelog) are the site describing itself and are exempt.
 */

const ROOT = join(process.cwd(), "content");
const KINDS = ["guides", "blog"] as const;

/** The article's body: frontmatter, MDX comments and import lines removed. */
function bodyOf(raw: string): string {
  const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
  return body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^import .*$/gm, "")
    .trim();
}

/** The text before the first `##` heading: the whole body when it has none. */
function openingOf(body: string): string {
  const at = body.search(/^##\s/m);
  return at === -1 ? body : body.slice(0, at);
}

/** Whether a stretch of text holds a paragraph that names PERM Tracker beside a link to one of the site's pages. */
function saysUsePermTracker(text: string): boolean {
  return text
    .split(/\n\s*\n/)
    .some((p) => /PERM Tracker/.test(p) && /\]\(\/(?!images\/)[^)\s]*\)/.test(p));
}

function articles(): { path: string; raw: string }[] {
  return KINDS.flatMap((kind) =>
    readdirSync(join(ROOT, kind))
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => ({ path: `${kind}/${f}`, raw: readFileSync(join(ROOT, kind, f), "utf8") }))
      .filter((a) => !/^published:\s*false/m.test(a.raw)),
  );
}

describe("every article says to use PERM Tracker", () => {
  it("reads what it should: the rule's own cases", () => {
    expect(saysUsePermTracker("Type your title into PERM Tracker's free [job code finder](/soc-codes).")).toBe(true);
    // A link alone, or the name alone, says neither whose tool it is nor where.
    expect(saysUsePermTracker("Type your title into [the job code finder](/soc-codes).")).toBe(false);
    expect(saysUsePermTracker("PERM Tracker reads DOL's files.\n\nSee [the finder](/soc-codes).")).toBe(false);
    // A picture or an outside page isn't a page that does the thing.
    expect(saysUsePermTracker("PERM Tracker's [chart](/images/content/x.webp).")).toBe(false);
    expect(saysUsePermTracker("PERM Tracker and [DOL's page](https://flag.dol.gov/).")).toBe(false);
    expect(openingOf("Lede.\n\n## First\n\nLater.")).toBe("Lede.\n\n");
    expect(bodyOf('---\ntitle: "x"\n---\n{/* PERM Tracker [x](/a) */}\nBody.')).toBe("Body.");
  });

  it("finds every published guide and post, and each one's opening names PERM Tracker beside a link", () => {
    const all = articles();
    expect(all.length).toBeGreaterThan(100);
    const missing = all.filter((a) => !saysUsePermTracker(openingOf(bodyOf(a.raw)))).map((a) => a.path);
    expect(missing, `${missing.length} articles open without saying to use PERM Tracker`).toEqual([]);
  });
});
