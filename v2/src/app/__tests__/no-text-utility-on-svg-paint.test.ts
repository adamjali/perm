import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * An SVG mark must never take its colour from a remapped TEXT utility.
 *
 * globals.css deliberately remaps two utilities to their text-safe variants:
 *
 *     .text-primary     { color: var(--primary-text) }      #1D8229
 *     .text-destructive { color: var(--destructive-text) }   #E30000 / #FF4747
 *
 * That is correct for text, where the brand lime #2ECC40 measures ~2.1:1 on
 * the page and fails 4.5:1. It is wrong for a graphic, where the brand colour
 * IS the colour and the 3:1 non-text floor applies. FrontierProgressChart
 * reached for the utility and shipped a forest-green queue line while three
 * sibling charts, which name `var(--primary)`, shipped lime.
 *
 * Nothing else can see this. It typechecks, the class generates, contrast
 * passes (the darker green passes MORE), and the only symptom is a chart that
 * is quietly the wrong colour.
 *
 * Scope is SVG geometry that PAINTS. `text-primary` on an SVG <text> element
 * is correct and stays legal, which is why the tag list is explicit.
 */

const ROOT = join(process.cwd(), "src");

/** Elements whose fill/stroke is paint, not type. */
const PAINTED = "path|circle|rect|line|polygon|polyline|ellipse|stop|g";

/** The utilities globals.css remaps away from their token of the same name. */
const REMAPPED = ["text-primary", "text-destructive"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx") && !entry.includes(".test.")) out.push(full);
  }
  return out;
}

export function findPaintViolations(files: string[]): string[] {
  const found: string[] = [];
  const tag = new RegExp(`<(${PAINTED})\\b[^>]*>`, "gs");
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(tag)) {
      const el = m[0];
      // Only flag an element that actually paints. A <g> carrying the class
      // as a wrapper for <text> children is legitimate.
      if (!/\b(fill|stroke|stopColor|stop-color)=/.test(el)) continue;
      for (const util of REMAPPED) {
        if (new RegExp(`className="[^"]*\\b${util}\\b`).test(el)) {
          const line = src.slice(0, m.index).split("\n").length;
          found.push(`${file.replace(ROOT, "src")}:${line} <${m[1]}> uses ${util}`);
        }
      }
    }
  }
  return found;
}

describe("no remapped text utility on SVG paint", () => {
  const files = walk(ROOT);

  it("scanned a plausible number of components", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    expect(files.length).toBeGreaterThan(200);
  });

  it("finds no SVG mark coloured through text-primary or text-destructive", () => {
    expect(findPaintViolations(files)).toEqual([]);
  });

  it("catches a violation when one exists", () => {
    // Probed against the real defect this gate was written for, so a future
    // refactor that breaks the pattern cannot leave it silently passing.
    const fixture = join(process.cwd(), "src/app/__tests__/__fixtures__/svg-paint.fixture.txt");
    const found = findPaintViolations([fixture]);
    expect(found).toHaveLength(2);
    expect(found[0]).toContain("text-primary");
  });
});
