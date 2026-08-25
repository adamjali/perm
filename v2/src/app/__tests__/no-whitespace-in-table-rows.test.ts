import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A whitespace text node cannot be a child of <tr>.
 *
 * It is invalid HTML, and React says so at runtime: "In HTML, whitespace text
 * nodes cannot be a child of <tr>... This will cause a hydration error."
 *
 * We introduced it wholesale. The fix for glued table text was a `{" "}`
 * separator between cells, which put the space in exactly the wrong place:
 * `</td>{" "}` is a text node whose parent is the row. It landed in seven
 * files and 44 places before anyone noticed, because it only shows up as a
 * console warning in a test run.
 *
 * The separator still exists and still does its job; it lives INSIDE the
 * cell, before the closing tag, where it is legal and where an extractor
 * still sees a boundary between columns.
 */

const ROOT = join(process.cwd(), "src");

/** `</td>{" "}`, `{" "}<th`, and a bare space between two cell expressions. */
const PATTERNS: [RegExp, string][] = [
  [/<\/(?:td|th)>\s*\{" "\}/, 'a {" "} after a closing cell tag'],
  [/\{" "\}\s*<(?:td|th)\b/, 'a {" "} before an opening cell tag'],
  // Same-line whitespace ONLY. \s+ also matches a newline, and a newline
  // between two cell expressions is the CORRECT form: JSX strips it. The
  // first run of this gate flagged the very lines it had just fixed.
  [/\}[ \t]+\{(?=\s*head\()/, "a literal space between two cell expressions"],
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(full, out);
    } else if (entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("no whitespace text nodes inside table rows", () => {
  const files = walk(ROOT);

  it("scanned a plausible number of files", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it.each(PATTERNS)("finds no case of %s", (pattern) => {
    const offenders = files
      .filter((f) => pattern.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(process.cwd() + "/", ""));
    expect(offenders).toEqual([]);
  });
});
