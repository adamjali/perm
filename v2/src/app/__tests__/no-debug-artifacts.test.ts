import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * No debug artifact reaches a rendered page.
 *
 * `XPROBEX` shipped to production in the site header, between Sign In and
 * Sign Up. It was a visible marker someone used while checking that a
 * whitespace fix had applied, and it survived review because the change it
 * arrived with was 34 files of near-identical `{" "}` insertions that got
 * characterised by diff statistics rather than read.
 *
 * A marker chosen to be visible in a browser is, by construction, visible to
 * every visitor. This is the cheap check that would have caught it.
 */

const ROOTS = ["src", "content", "convex"];
const EXTENSIONS = [".ts", ".tsx", ".mdx"];

/** Deliberately narrow: shouty sentinels, not ordinary words. */
const FORBIDDEN = [
  /\bXPROBEX\b/,
  /\bPROBE_?STRING\b/,
  /\bTEST_?STRING\b/,
  /\b__TEST__\b/,
  /\bREMOVE_?ME\b/,
  /\bDELETE_?THIS\b/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((e) => full.endsWith(e))) out.push(full);
  }
  return out;
}

describe("no debug artifacts in shipped source", () => {
  const files = ROOTS.flatMap((r) => walk(r)).filter(
    // A sentinel inside a test is the test's own subject.
    (f) => !/\.test\.[tj]sx?$|__tests__|\.stories\./.test(f),
  );

  it("scans a plausible number of files", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    expect(files.length).toBeGreaterThan(300);
  });

  it.each(FORBIDDEN.map((p) => [p.source, p] as const))(
    "no source file contains %s",
    (_label, pattern) => {
      const offenders = files.filter((f) =>
        pattern.test(readFileSync(f, "utf8")),
      );
      expect(offenders).toEqual([]);
    },
  );
});
