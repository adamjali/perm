import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A table that scrolls sideways is a `ScrollBox`, so a keyboard can reach it.
 *
 * On a phone a wide table scrolls inside its box, and a box holding only text
 * and figures has nothing a keyboard can land on, so its far columns are out of
 * reach (WCAG 2.1.1; axe: scrollable-region-focusable). `ScrollBox` gives the
 * box a tab stop and a name. A box whose table holds a link or a button already
 * has a way in and keeps a plain div. Found by the Oct 15 2026 axe sweep on
 * four pages at 390 wide; 47 boxes were converted.
 */

const BOX = /<div\s+className="[^"]*\boverflow-x-auto\b[^"]*"\s*>\s*<table\b/g;
const CONTROL = /<(Link|a|button|Button|input|select|textarea|PendingLink)\b|href=/;
/** Boxes whose table holds a control the scan can't see, drawn by a helper. */
const HOLDS_A_CONTROL_ELSEWHERE: Record<string, string> = {
  "src/components/tools/RateBars.tsx": "its header cells are sort buttons, drawn by a helper above the table",
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      sourceFiles(path, out);
    } else if (path.endsWith(".tsx") && !path.endsWith(".test.tsx") && !path.endsWith(".stories.tsx")) {
      out.push(path);
    }
  }
  return out;
}

/** The text of the table a box holds, up to its closing tag. */
function tableAt(source: string, start: number): string {
  const end = source.indexOf("</table>", start);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

function plainBoxes(path: string, source: string): string[] {
  if (HOLDS_A_CONTROL_ELSEWHERE[path]) return [];
  return [...source.matchAll(BOX)]
    .filter((m) => !CONTROL.test(tableAt(source, m.index)))
    .map((m) => `${path}:${source.slice(0, m.index).split("\n").length}`);
}

describe("sideways-scrolling tables a keyboard can reach", () => {
  const files = sourceFiles("src");

  it("reads the tree, and its check finds a plain box when one is there", () => {
    expect(files.length).toBeGreaterThan(200);
    expect(plainBoxes("x.tsx", '<div className="mt-4 overflow-x-auto">\n<table><tr><td>1</td></tr></table></div>')).toHaveLength(1);
    expect(plainBoxes("x.tsx", '<div className="overflow-x-auto"><table><tr><td><Link href="/a">a</Link></td></tr></table></div>')).toHaveLength(0);
    expect(plainBoxes("x.tsx", '<ScrollBox label="Rows" className="mt-4"><table><tr><td>1</td></tr></table></ScrollBox>')).toHaveLength(0);
  });

  it("every table box with no control in it is a ScrollBox", () => {
    const found = files.flatMap((f) => plainBoxes(f, readFileSync(f, "utf8")));
    expect(found).toEqual([]);
  });

  it("each exception still exists, so the list can't outlive its reason", () => {
    for (const path of Object.keys(HOLDS_A_CONTROL_ELSEWHERE)) {
      expect(readFileSync(path, "utf8")).toMatch(new RegExp(BOX.source));
    }
  });
});
