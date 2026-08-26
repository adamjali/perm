import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A client component must not import the Turso layer.
 *
 * `src/lib/turso/client.ts` imports `server-only`, and TURSO_AUTH_TOKEN grants
 * access to the whole database. Importing it from a `"use client"` module
 * would put that credential in the browser bundle.
 *
 * THIS TEST EXISTS BECAUSE THE RUNTIME GUARD IS SWITCHED OFF IN TESTS.
 * `server-only` throws when imported with a DOM present, and every vitest
 * project here runs happy-dom or edge-runtime, so a test of a legitimate
 * SERVER module (sitemap.ts) failed to load at all. vitest.config.ts aliases
 * `server-only` to the package's own `empty.js` - the same file Next resolves
 * under the `react-server` condition - which fixes that and, as a side
 * effect, removes the throw everywhere in the suite.
 *
 * `next build` still catches a real violation. But a guard that only fires in
 * a 19-minute production build is a slow way to learn, so this asserts the
 * same property statically and in milliseconds.
 */

const ROOT = join(process.cwd(), "src");
const BANNED = /from\s+["']@\/lib\/turso\//;
const CLIENT = /^\s*["']use client["']/m;
/** A type-only import erases at compile time and carries no runtime code. */
const TYPE_ONLY = /import\s+type\s+\{[^}]*\}\s+from\s+["']@\/lib\/turso\//;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("no server-only Turso import from a client component", () => {
  const files = walk(ROOT);
  const clientFiles = files.filter((f) => CLIENT.test(readFileSync(f, "utf8")));

  it("scanned a plausible number of files", () => {
    // A gate that cannot see its subject reads exactly like a pass. Assert
    // coverage BEFORE the verdict, so a broken walk fails here rather than
    // silently reporting zero violations over zero files.
    expect(files.length).toBeGreaterThan(300);
    expect(clientFiles.length).toBeGreaterThan(50);
  });

  it("no client component imports @/lib/turso at runtime", () => {
    const offenders = clientFiles.filter((f) => {
      const src = readFileSync(f, "utf8");
      if (!BANNED.test(src)) return false;
      // Every turso import in the file must be type-only for it to be safe.
      const lines = src.split("\n").filter((l) => BANNED.test(l));
      return lines.some((l) => !TYPE_ONLY.test(l));
    });
    expect(offenders.map((f) => f.replace(ROOT, "src"))).toEqual([]);
  });
});
