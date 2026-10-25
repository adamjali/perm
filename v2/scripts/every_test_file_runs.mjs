#!/usr/bin/env node
/**
 * Every test file in the repository is run by something.
 *
 * A test file that no vitest project's include globs reach runs nowhere, and a
 * suite missing it still goes green. This asks vitest for the files it would
 * run (`vitest list --filesOnly`), compares them with every test file git
 * tracks, and fails on any file that's in neither vitest's list nor
 * PLAYWRIGHT (the browser flows, which scripts/page_checks.py runs against
 * the live site each morning).
 *
 *   node scripts/every_test_file_runs.mjs
 */
import { execFileSync } from "node:child_process";
import { relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PLAYWRIGHT = /^tests\/e2e\/.+\.spec\.ts$/;

const tracked = execFileSync("git", ["ls-files", "*.test.ts", "*.test.tsx", "*.test.mjs", "*.test.js", "*.spec.ts", "*.spec.tsx"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const listed = JSON.parse(
  execFileSync("pnpm", ["exec", "vitest", "list", "--filesOnly", "--json"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }),
);
const run = new Set(listed.map((e) => relative(ROOT, typeof e === "string" ? e : e.file)));

const orphans = tracked.filter((f) => !run.has(f) && !PLAYWRIGHT.test(f));
console.log(`${tracked.length} test files tracked, ${run.size} run by vitest, ${tracked.filter((f) => PLAYWRIGHT.test(f)).length} by Playwright`);
if (tracked.length < 500 || run.size < 500) {
  console.log("FAIL: too few test files seen; the listing is wrong, so this check can't judge");
  process.exit(2);
}
for (const f of orphans) console.log(`FAIL: nothing runs ${f} (no vitest project includes it)`);
process.exit(orphans.length ? 1 : 0);
