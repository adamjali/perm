import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A test may not hardcode a path that exists on one machine.
 *
 * `zz-render-case-preview.test.tsx` wrote its output to an absolute path
 * inside the author's local scratchpad. It passed here, went green through a
 * full four-project local run, and then took CI down on the first push with
 * `EACCES: mkdir '/private/tmp/claude-501/...'` - a directory no runner has
 * and none is allowed to create.
 *
 * That is the shape worth gating: a local suite CANNOT catch it, because
 * locally the path is real. The only signals are a red CI or this check.
 *
 * `tmpdir()` is the portable answer - RUNNER_TEMP on CI, /var/folders on
 * macOS, /tmp on Linux. A bare "/tmp" is also rejected: it happens to work on
 * both platforms this project runs on, which is exactly what makes it easy to
 * reach for and wrong on the next one.
 */

const ROOT = join(process.cwd(), "src");
const CONVEX = join(process.cwd(), "convex");

/** Absolute paths that belong to one machine, one user, or one OS. */
const MACHINE_PATH = /"(\/(?:private\/)?(?:tmp|Users|home|var\/folders)\/[^"]{2,})"/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.test\.tsx?$/.test(entry)) {
      // This file's own probe fixtures are deliberately bad paths. Without
      // this the gate flags itself, which is a real result the first time and
      // pure noise every time after.
      if (entry === "no-machine-paths.test.ts") continue;
      out.push(full);
    }
  }
  return out;
}

/** Comments legitimately quote the bad path to explain it. Strip them first. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*/, ""))
    .join("\n");
}

export function findMachinePaths(files: string[]): string[] {
  const found: string[] = [];
  for (const file of files) {
    const src = code(readFileSync(file, "utf8"));
    src.split("\n").forEach((line, i) => {
      const m = MACHINE_PATH.exec(line);
      if (m) found.push(`${file}:${i + 1} ${m[1]}`);
    });
  }
  return found;
}

describe("no machine-specific paths in tests", () => {
  const files = [...walk(ROOT), ...walk(CONVEX)];

  it("scanned a plausible number of test files", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    expect(files.length).toBeGreaterThan(100);
  });

  it("finds none", () => {
    expect(findMachinePaths(files)).toEqual([]);
  });

  it("catches one when it exists", () => {
    // Probed rather than trusted: three shapes that must flag, two that must not.
    const flagged = [
      'const OUT = "/private/tmp/claude-501/x/scratchpad";',
      'const OUT = "/tmp/emailrender";',
      'writeFileSync("/Users/someone/out.html", x);',
    ];
    const clean = [
      'const OUT = join(tmpdir(), "permtracker-emailrender");',
      'const p = "/api/case-alert/confirm";',
      '// historical: it used to write to "/private/tmp/claude-501/x"',
    ];
    for (const src of flagged) {
      expect(code(src)).toMatch(MACHINE_PATH);
    }
    for (const src of clean) {
      expect(code(src)).not.toMatch(MACHINE_PATH);
    }
  });
});
