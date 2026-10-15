import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

/**
 * The `"final": {...}` set inside PROGRAMS[<key>] in the Python ingest.
 *
 * Shared by the PWD and LCA parity tests. Not a test file itself: importing
 * one test module from another drags its `vi.mock` registrations along and
 * the second file's mocks silently lose, which is how the LCA search test
 * first "ran" against the PWD file's mock and never saw a call.
 */
export function pythonFinalSet(key: string): Set<string> {
  const src = readFileSync(join(process.cwd(), "scripts/ingest_pwd_status_direct.py"), "utf8");
  const start = src.indexOf(`"${key}": {`);
  expect(start, `PROGRAMS["${key}"] not found`).toBeGreaterThan(-1);
  const block = /"final": \{([\s\S]*?)\}/.exec(src.slice(start));
  expect(block, `final set for ${key} not found`).not.toBeNull();
  return new Set([...block![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!));
}
