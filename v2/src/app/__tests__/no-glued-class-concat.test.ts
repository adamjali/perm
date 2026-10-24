import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A class string joined to another with `+` needs a space between them. Without it two class
 * names become one that matches nothing: `"... border" + (current ? "bg-primary ...")` gave the
 * visa bulletin hub's current month `borderbg-primary`, near-black text on the dark page at
 * 1.02:1, and the sortable headers' "ring-ring" + "text-right" dropped their alignment (axe and a
 * scan, Oct 21 2026). Ten places had it. Use `cn()` or end the first string with a space.
 */

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" || name.startsWith(".") ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const looksLikeClasses = (s: string) => /(^|\s)(flex|grid|border|bg-|text-|px-|py-|p-\d|min-h-|w-|focus-visible:)/.test(s);

/**
 * Every `"<classes without a trailing space>" +` and the operand after it: a string, or a
 * parenthesised expression read to its matching paren, ternary branches over several lines
 * included. A literal in that operand starting with a letter is glued to the one before.
 */
function findGlued(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/"([^"\n]*[A-Za-z0-9\]\)])"\s*\+\s*/g)) {
    if (!looksLikeClasses(m[1]!)) continue;
    const i = m.index! + m[0].length;
    let operand = "";
    if (src[i] === '"') {
      const end = src.indexOf('"', i + 1);
      operand = src.slice(i, end + 1);
    } else if (src[i] === "(") {
      let depth = 0;
      for (let j = i; j < src.length && j < i + 600; j++) {
        if (src[j] === "(") depth++;
        else if (src[j] === ")" && --depth === 0) {
          operand = src.slice(i, j + 1);
          break;
        }
      }
    }
    for (const lit of operand.matchAll(/"([^"\n]*)"/g)) {
      // a value compared against (`theme === "dark"`) is not a class
      if (/[=!]==\s*$/.test(operand.slice(0, lit.index))) continue;
      if (/^[A-Za-z]/.test(lit[1]!)) {
        out.push(`${m[0].trim()} ${lit[0]}`.slice(0, 120));
        break;
      }
    }
  }
  return out;
}

describe("class strings joined with + keep a space between classes", () => {
  it("catches the shape it was written for", () => {
    expect(findGlued('className={"flex border" + (on ? "bg-primary" : "bg-card")}')).toHaveLength(1);
    expect(findGlued('className={"flex border " + (on ? "bg-primary" : "bg-card")}')).toHaveLength(0);
    // the month strip's own shape: the ternary over several lines
    expect(findGlued('"flex min-h-11 border" +\n  (current\n    ? "bg-primary text-primary-foreground"\n    : "bg-card")')).toHaveLength(1);
    // a false branch glued while the true branch carries its space
    expect(findGlued('"flex border " + (on ? " bg-primary" : "bg-card")')).toHaveLength(0);
    expect(findGlued('"flex border" + (on ? " bg-primary" : "bg-card")')).toHaveLength(1);
  });

  it("finds none under src", () => {
    const all = files(join(process.cwd(), "src"));
    expect(all.length).toBeGreaterThan(500);
    const hits = all.flatMap((f) => findGlued(readFileSync(f, "utf8")).map((h) => `${f.slice(process.cwd().length + 1)}: ${h}`));
    expect(hits).toEqual([]);
  });
});
