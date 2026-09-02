import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A SERVER component may not take a VALUE import from `@phosphor-icons/react`.
 *
 * WHY. The package's main entry calls `React.createContext` at module scope to
 * build its IconContext, and `createContext` exists only in React's CLIENT
 * build. A server file importing a value from it fails `next build` with
 *
 *     TypeError: (0 , d.createContext) is not a function
 *
 * naming webpack bootstrap and no source file. That error cost four production
 * builds to trace on 2026-09-01, and the only thing that found it was reading
 * module ids out of `.next/server/chunks/*.js`. `@phosphor-icons/react/ssr` is
 * published for exactly this case.
 *
 * WHY A TEST AND NOT JUST THE BUILD. The build only fails once the offending
 * file is actually rendered on a server path. A file that is server-side but
 * not currently reached is DORMANT: it compiles fine today and detonates the
 * day an unrelated change shifts the chunk graph. This test sees it now.
 *
 * THE `import type` DISTINCTION IS THE WHOLE POINT. A type-only import is
 * erased at compile and emits no runtime require, so it can never pull
 * createContext anywhere. Four files import the main entry that way and are
 * correct. A first pass at this audit matched the bare specifier, counted those
 * four, and reported three "dormant traps" that did not exist - the same
 * distinction that had been applied correctly to `convex/react` an hour
 * earlier. Match the VALUE form only.
 */

const SRC = join(process.cwd(), "src");
const MAIN = /^\s*import\s+(?!type\s)[^;]*?from\s+["']@phosphor-icons\/react["']/m;
const TYPE_ONLY = /^\s*import\s+type\s+[^;]*?from\s+["']@phosphor-icons\/react["']/m;
const USE_CLIENT = /^\s*["']use client["']/;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e) && !p.includes("__tests__") && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

describe("@phosphor-icons/react is never value-imported from a server file", () => {
  const files = walk(SRC);

  it("scanned a plausible number of modules", () => {
    // A sweep that sees nothing passes every assertion below while proving
    // nothing. This repo has ~750 non-test modules under src/.
    expect(files.length).toBeGreaterThan(400);
  });

  it("has no server-side VALUE import of the main entry", () => {
    const offenders = files.filter((f) => {
      const t = readFileSync(f, "utf8");
      return !USE_CLIENT.test(t) && MAIN.test(t);
    });

    expect(
      offenders.map((f) => f.slice(SRC.length + 1)),
      "These files render on the server and take a VALUE import from " +
        "@phosphor-icons/react, whose main entry calls createContext at module " +
        "scope. They will fail `next build` the moment they are reached on a " +
        "server path. Import from '@phosphor-icons/react/ssr' instead.",
    ).toEqual([]);
  });

  it("does NOT flag type-only imports, which are erased at compile", () => {
    // The control for this test's own worst failure mode. If this ever returns
    // zero the codebase changed, but if it returns files AND the assertion
    // above is still green, the VALUE/TYPE distinction is working.
    const typeOnly = files.filter((f) => {
      const t = readFileSync(f, "utf8");
      return TYPE_ONLY.test(t) && !MAIN.test(t);
    });
    for (const f of typeOnly) {
      const t = readFileSync(f, "utf8");
      expect(MAIN.test(t), `${f} should not match the VALUE pattern`).toBe(false);
    }
  });
});
