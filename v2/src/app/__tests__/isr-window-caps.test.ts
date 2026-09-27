import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A cached read's window is the CEILING of every page that reads it.
 *
 * `unstable_cache({ revalidate: N })` and `fetch(..., { next: { revalidate: N } })`
 * both lower a page's ISR window to N. getFreshness sat in an hour-long
 * `unstable_cache` under DataProvenance, so 86 ISR pages declaring a day, six
 * hours or thirty days were built at one hour, and Vercel billed 15.3M ISR
 * write units against 3.8M reads for the cycle to Sep 28 2026 (measured
 * Sep 27). Nothing errored; the route table was the only place it showed.
 */

const SRC = join(process.cwd(), "src");
/** The shortest window a shared cached read may carry: a day. */
const FLOOR = 86400;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      out.push(...files(p));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("no cached read caps a page's ISR window below a day", () => {
  const all = files(SRC).map((f) => ({ f, src: strip(readFileSync(f, "utf8")) }));

  it("scans a plausible number of files", () => {
    expect(all.length).toBeGreaterThan(300);
  });

  it("every unstable_cache window is at least a day", () => {
    const found: string[] = [];
    const short: string[] = [];
    for (const { f, src } of all) {
      for (const m of src.matchAll(/unstable_cache\(/g)) {
        // The call's own argument list, by balanced parentheses: the first
        // argument is usually an arrow function with calls of its own.
        let depth = 0;
        let end = m.index + m[0].length - 1;
        for (; end < src.length; end++) {
          if (src[end] === "(") depth++;
          else if (src[end] === ")" && --depth === 0) break;
        }
        const w = /revalidate:\s*(\d+)/.exec(src.slice(m.index, end));
        if (!w) continue;
        found.push(f);
        if (Number(w[1]) < FLOOR) short.push(`${f.replace(SRC, "src")}: ${w[1]}`);
      }
    }
    expect(found.length, "unstable_cache call sites seen").toBeGreaterThan(0);
    expect(short).toEqual([]);
  });

  it("every fetch revalidate literal is at least a day", () => {
    const short: string[] = [];
    for (const { f, src } of all) {
      for (const m of src.matchAll(/next:\s*\{\s*revalidate:\s*(\d+)/g)) {
        if (Number(m[1]) < FLOOR) short.push(`${f.replace(SRC, "src")}: ${m[1]}`);
      }
    }
    expect(short).toEqual([]);
  });

  it("getFreshness is a per-request read, not a Data Cache entry", () => {
    const src = strip(readFileSync(join(SRC, "lib/turso/publicData.ts"), "utf8"));
    const def = /export const getFreshness = ([^;]+);/.exec(src)?.[1] ?? "";
    expect(def).toMatch(/^cache\(/);
    expect(def).not.toMatch(/unstable_cache/);
  });
});
