import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * A JSX <title> takes exactly ONE child: plain text or one {expression}.
 *
 * `<title>{s.label}{" "}</title>` (the anti-glue space as a second child)
 * made React 19 render the node differently on the server and the client, and
 * /uscis-processing-times threw React error #418 on every load (outside audit,
 * 2026-09-23; the dev overlay named this node). Put the space INSIDE one
 * template literal instead: `{`${s.label} `}`.
 */

const ROOT = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx") && !entry.includes(".test.")) out.push(full);
  }
  return out;
}

/** True when the text is one balanced {...} from its first character to its last. */
function oneExpression(s: string): boolean {
  if (!s.startsWith("{") || !s.endsWith("}")) return false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") depth--;
    if (depth === 0 && i < s.length - 1) return false;
  }
  return depth === 0;
}

function singleChild(body: string): boolean {
  const t = body.trim();
  return !/[{}]/.test(t) || oneExpression(t);
}

describe("JSX <title> elements", () => {
  it("the checker itself tells one child from two", () => {
    expect(singleChild("{`${s.label} `}")).toBe(true);
    expect(singleChild("\n  {a ? `x` : `y`}\n")).toBe(true);
    expect(singleChild("How the site works")).toBe(true);
    expect(singleChild('{s.label}{" "}')).toBe(false);
    expect(singleChild("Label: {x}")).toBe(false);
  });

  it("every <title> in the source has exactly one child", () => {
    const titles: Array<{ file: string; body: string }> = [];
    for (const file of walk(ROOT)) {
      // Comments first: the first version of this gate matched the WORD
      // "<title>" in two comments explaining this very rule and failed on them.
      const src = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|\s)\/\/.*$/gm, "$1");
      for (const m of src.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/g)) {
        titles.push({ file: relative(ROOT, file), body: m[1]! });
      }
    }
    // A scan that finds nothing is not a pass.
    expect(titles.length).toBeGreaterThanOrEqual(5);
    const bad = titles.filter((t) => !singleChild(t.body)).map((t) => `${t.file}: ${t.body.trim()}`);
    expect(bad).toEqual([]);
  });
});
