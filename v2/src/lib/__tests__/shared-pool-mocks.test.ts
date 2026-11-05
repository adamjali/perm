import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A file in the shared `unit` pool mocks nothing but `server-only`.
 *
 * The `unit` project runs with isolate:false, so a vi.mock in one file stays in the module registry for the next
 * file in the same worker. Twice on Nov 4 2026 a mocked database client or entity-link module from one file
 * answered another file's real calls, green alone and red only in CI's shuffled order. A file that mocks a module
 * belongs in ISOLATED_UNIT_FILES (vitest.config.ts), which runs each file in a fresh module graph. `server-only`
 * is the exception: its alias is already an empty module, so mocking it changes nothing for anyone.
 */
const ROOT = join(__dirname, "..", "..", "..");
const HARMLESS = new Set(["server-only"]);

function isolatedFiles(): Set<string> {
  const cfg = readFileSync(join(ROOT, "vitest.config.ts"), "utf8");
  const start = cfg.indexOf("const ISOLATED_UNIT_FILES");
  const list = cfg.slice(start, cfg.indexOf("];", start));
  return new Set([...list.matchAll(/"([^"]+\.test\.tsx?)"/g)].map((m) => m[1]!));
}

function walk(dir: string, deep: boolean): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (deep && e.name !== "node_modules" && e.name !== "dist") out.push(...walk(p, true));
    } else if (/\.test\.tsx?$/.test(e.name) && !e.name.includes(".ssr.test.")) out.push(p);
  }
  return out;
}

/** The `unit` project's include list, as files (vitest.config.ts). */
function sharedPoolFiles(): string[] {
  const iso = isolatedFiles();
  const all = [
    ...walk("src/lib", true),
    ...walk("src/hooks", true),
    ...walk("convex/lib/perm", true),
    ...walk("convex/lib", false),
    ...walk("extension", true),
    ...walk("sdk", true),
  ];
  return [...new Set(all)].filter((f) => !iso.has(f));
}

export function mockedModules(src: string): string[] {
  return [...src.matchAll(/\bvi\.(?:mock|doMock)\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]!);
}

describe("the shared unit pool", () => {
  it("finds the mocks it looks for", () => {
    // Split so the scan below doesn't read this example as a mock of its own.
    const vi_ = "vi.";
    expect(mockedModules(`${vi_}mock("../client", () => ({}));\n${vi_}doMock('@/lib/sentry')`)).toEqual([
      "../client",
      "@/lib/sentry",
    ]);
    expect(mockedModules(`// vi.mocked(x) is a type helper, not a mock\nvi.mocked(fn)`)).toEqual([]);
  });

  it("holds no file that mocks a module", () => {
    const files = sharedPoolFiles();
    expect(files.length, "shared-pool test files seen").toBeGreaterThan(200);
    const found: string[] = [];
    for (const f of files) {
      for (const m of mockedModules(readFileSync(join(ROOT, f), "utf8"))) {
        if (!HARMLESS.has(m)) found.push(`${relative(ROOT, join(ROOT, f))} mocks ${m}`);
      }
    }
    expect(found, "move these to ISOLATED_UNIT_FILES in vitest.config.ts").toEqual([]);
  });

  it("names only files that exist in its isolated list", () => {
    const missing = [...isolatedFiles()].filter((f) => {
      try {
        readFileSync(join(ROOT, f));
        return false;
      } catch {
        return true;
      }
    });
    expect(missing).toEqual([]);
  });
});
