import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * An outbound DOL link must go where its own words say it goes.
 *
 * THE DEFECT THIS EXISTS FOR, found by a reader on 2026-09-03. Two PERM
 * surfaces told someone holding a case number that "DOL's own system" and
 * "DOL's own status page" were the authority on that case, and linked to
 * `flag.dol.gov/processingtimes` - a page of queue averages that cannot look a
 * case up at all. The wage-request and LCA equivalents already pointed at
 * `case-status-search`, so the three programs disagreed.
 *
 * `audit_internal_links.py` catches exactly this shape for internal links and
 * cannot see outbound ones, which is why it went unnoticed.
 *
 * The rule is deliberately narrow: it fires only on phrases that PROMISE a
 * per-case lookup. A link labelled "processing times" or "OFLC data" is left
 * alone, because those are what the processing-times page is.
 */

const ROOTS = ["src", "content"];
const PROCESSING = "https://flag.dol.gov/processingtimes";
const CASE_SEARCH = "https://flag.dol.gov/case-status-search";

/** Wording that can only mean "look up one case". */
const PER_CASE = [
  /DOL(?:&apos;|'|’)s own system/i,
  /DOL(?:&apos;|'|’)s own status page/i,
  /DOL(?:&apos;|'|’)s own case-status/i,
  /case[- ]status search/i,
  /check (?:it|your case|this case) on/i,
  /look (?:it|your case) up (?:on|at) DOL/i,
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|mdx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("outbound DOL links go where their words say", () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it("scans a plausible number of files", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    expect(files.length).toBeGreaterThan(300);
  });

  it("never promises a per-case lookup and link to the processing-times page", () => {
    // THE SENTENCE CONTAINING THE LINK, NOT A BLOCK AROUND IT. A first version
    // took six lines either side and reported three findings, all false: a
    // schema `description` mentioning the case-status search four lines above
    // an unrelated `isBasedOn`, and two paragraphs where one sentence names
    // the case-status search and the NEXT one links to the processing-times
    // page. Both of those are correct writing. The promise only matters when
    // it is made about THIS link, which means the same sentence.
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      let at = src.indexOf(PROCESSING);
      while (at !== -1) {
        const before = src.slice(Math.max(0, at - 400), at);
        // Back up to the nearest sentence or block boundary. `</p>` and a
        // JSX/markdown paragraph break end a sentence as surely as a full stop.
        const cut = Math.max(
          before.lastIndexOf(". "),
          before.lastIndexOf(".\n"),
          before.lastIndexOf("</p>"),
          before.lastIndexOf("\n\n"),
          // The end of a preceding string VALUE. A schema object puts the
          // phrase in `description` and the URL in `isBasedOn`, two keys
          // apart, which is not a promise about the link at all.
          before.lastIndexOf('",'),
        );
        const sentence = cut === -1 ? before : before.slice(cut);
        // ...plus the anchor's own text, which follows the href.
        const after = src.slice(at, at + 400);
        const anchorText = after.slice(0, after.indexOf("</a>") + 1 || 200);
        const window = sentence + " " + anchorText;
        const hit = PER_CASE.find((re) => re.test(window));
        if (hit) {
          const lineNo = src.slice(0, at).split("\n").length;
          offenders.push(`${file}:${lineNo} promises ${hit} but links to /processingtimes`);
        }
        at = src.indexOf(PROCESSING, at + 1);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("still has the per-case link in use, so the rule is not vacuous", () => {
    // If nothing anywhere used the right URL, the check above would pass by
    // accident on a site that had lost the link entirely.
    const uses = files.filter((f) => readFileSync(f, "utf8").includes(CASE_SEARCH));
    expect(uses.length).toBeGreaterThanOrEqual(3);
  });
});
