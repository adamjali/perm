import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * `sr-only` goes on a wrapper, never on a <table>.
 *
 * `sr-only` works by squeezing a box to 1px and hiding its overflow. A table
 * can't be narrower than its content and ignores `overflow` (it isn't a block
 * container), so a screen-reader table kept its full width and pushed the
 * page sideways on a phone: /lca-wage-sources measured 1,092px wide at 390,
 * and the daily pulse's table ran 7px past the edge on every page carrying it
 * (Oct 4 2026). A <div className="sr-only"> around the table does what was
 * meant.
 */

const ROOT = join(process.cwd(), "src");
const SR_ONLY_TABLE = /<table\b[^>]*className=(?:"[^"]*|\{[^}]*)\bsr-only\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx") && !entry.includes(".test.")) out.push(full);
  }
  return out;
}

describe("screen-reader tables", () => {
  it("the pattern finds the shape it exists to catch, and passes the wrapped one", () => {
    expect(SR_ONLY_TABLE.test('<table className="sr-only">')).toBe(true);
    expect(SR_ONLY_TABLE.test('<table className={cn("sr-only", x)}>')).toBe(true);
    expect(SR_ONLY_TABLE.test('<div className="sr-only">\n  <table>')).toBe(false);
  });

  it("never put sr-only on the <table> itself", () => {
    const files = walk(ROOT);
    expect(files.length).toBeGreaterThan(300);
    const found = files
      .filter((f) => SR_ONLY_TABLE.test(readFileSync(f, "utf8")))
      .map((f) => relative(process.cwd(), f));
    expect(found).toEqual([]);
  });
});
