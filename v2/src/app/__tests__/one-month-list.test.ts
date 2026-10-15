/**
 * The month names live in one place, convex/lib/months.ts. Thirty copies had
 * grown across pages, charts and emails, each with its own fallback for a bad
 * date; this keeps a new one from starting.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src", "convex"];
const HOME = join("convex", "lib", "months.ts");
const LIST = /"Jan(?:uary)?",\s*"Feb(?:ruary)?",\s*"Mar(?:ch)?"/;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "_generated" || name === "__tests__" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".stories.tsx")) out.push(path);
  }
}

describe("one list of month names", () => {
  it("is spelled out only in convex/lib/months.ts", () => {
    const files: string[] = [];
    for (const root of ROOTS) walk(root, files);
    expect(files.length).toBeGreaterThan(500);
    expect(readFileSync(HOME, "utf8")).toMatch(LIST);
    const copies = files.filter((f) => f !== HOME && LIST.test(readFileSync(f, "utf8")));
    expect(copies).toEqual([]);
  });
});
