import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A picked option is lime (Adam, Oct 28 2026: "green is primary remember that"), the look
 * `choiceVariants` gives every row of choices. A pressed toggle drawn in ink reads as a
 * different kind of control, and two shipped that way in one week. This reads every
 * component for an `aria-pressed` toggle whose pressed class is the ink fill.
 */
const ROOTS = ["src/components", "src/app"];
/** How far past `aria-pressed=` the toggle's own className can sit. */
const WINDOW = 500;
const INK_PICK = /bg-foreground text-background/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "__tests__" ? [] : files(p);
    return p.endsWith(".tsx") ? [p] : [];
  });
}

function inkPicks(src: string): number {
  let hits = 0;
  for (let at = src.indexOf("aria-pressed="); at !== -1; at = src.indexOf("aria-pressed=", at + 1)) {
    if (INK_PICK.test(src.slice(at, at + WINDOW))) hits += 1;
  }
  return hits;
}

describe("a picked option is lime", () => {
  it("finds an ink pick in a toggle shaped like the ones that shipped", () => {
    // Arrange
    const shipped = `<button aria-pressed={on} className={cn("min-h-11 px-4", on ? "bg-foreground text-background" : "bg-background")}>`;
    // Act / Assert
    expect(inkPicks(shipped)).toBe(1);
    expect(inkPicks(`<button aria-pressed={on} className={choiceVariants({ on })}>`)).toBe(0);
  });

  it("no toggle on the site draws its pick in ink", () => {
    // Arrange
    const all = ROOTS.flatMap(files);
    // Act
    const found = all.map((f) => ({ f, n: inkPicks(readFileSync(f, "utf8")) })).filter((x) => x.n > 0);
    // Assert
    expect(all.length).toBeGreaterThan(300);
    expect(found).toEqual([]);
  });
});
