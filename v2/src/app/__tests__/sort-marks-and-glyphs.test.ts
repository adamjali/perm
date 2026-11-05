/**
 * Icons are Phosphor icons, never typed characters (owner, Nov 5 2026: the "↕" on a sortable
 * header drew as a grey emoji box on an iPhone, and each table marked sorting its own way).
 *
 * 1. Every sortable header (`aria-sort`) draws the shared `<SortMark>`.
 * 2. No component or page types an arrow or an emoji-prone symbol into what it renders: phones
 *    draw several of them as colour emoji, and the rest are icons wearing a character's clothes.
 * 3. No article does either.
 *
 * The scan strips comments first, so a note about "↕" can't fail it, and it proves itself on
 * fixtures before reading the tree.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function walk(dir: string, keep: (p: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, keep, out);
    } else if (keep(p)) out.push(p);
  }
  return out;
}

/** Comments out: line, block and JSX ones. Good enough for this scan; string contents survive. */
export function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

/** Arrows used as icons, and symbols phones may draw as colour emoji. */
const GLYPHS = /[←→↑↓↔↕⇅⬆⬇⬅➡↩↪⤴⤵▶◀✔✖✅❌⚠☑★⭐]/u;

/** O*NET's licence asks for its registered mark in the credit line, word for word. */
const MARK_OK = /O\*NET®/g;

const offending = (src: string) =>
  stripComments(src)
    .replace(MARK_OK, "")
    .split("\n")
    .filter((l) => GLYPHS.test(l));

describe("the scan finds what it's for", () => {
  it("flags a typed sort arrow and leaves a comment about one alone", () => {
    expect(offending(`<span>{active ? "↑" : "↕"}</span>`)).toHaveLength(1);
    expect(offending(`// the old "↕" drew as an emoji\nconst a = 1;`)).toEqual([]);
    expect(offending(`{/* was ← Back */}<ArrowLeftIcon />`)).toEqual([]);
    expect(offending(`<p>O*NET® is a trademark</p>`)).toEqual([]);
    expect(offending(`1. Enter the date → the app works it out`)).toHaveLength(1);
  });
});

const components = walk(join(ROOT, "src"), (p) => p.endsWith(".tsx") && !p.includes(".test.") && !p.includes(".stories."));
const articles = walk(join(ROOT, "content"), (p) => p.endsWith(".mdx"));

describe("icons are icons", () => {
  it("read the tree", () => {
    expect(components.length).toBeGreaterThan(400);
    expect(articles.length).toBeGreaterThan(80);
  });

  it("every sortable header draws the shared sort mark", () => {
    const missing = components
      .filter((p) => /aria-sort=/.test(readFileSync(p, "utf8")))
      .filter((p) => !/<SortMark\b/.test(readFileSync(p, "utf8")))
      .map((p) => relative(ROOT, p));
    expect(missing).toEqual([]);
  });

  it("no component types an arrow or an emoji-prone symbol into what it renders", () => {
    const found = components.flatMap((p) => offending(readFileSync(p, "utf8")).map((l) => `${relative(ROOT, p)}: ${l.trim().slice(0, 90)}`));
    expect(found).toEqual([]);
  });

  it("no article does either", () => {
    const found = articles.flatMap((p) => offending(readFileSync(p, "utf8")).map((l) => `${relative(ROOT, p)}: ${l.trim().slice(0, 90)}`));
    expect(found).toEqual([]);
  });
});
