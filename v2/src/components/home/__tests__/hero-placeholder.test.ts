import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A placeholder longer than its input is clipped, and nobody sees it clipped
 * on the machine they wrote it on.
 *
 * The hero input has 212px of usable space at 320px, the narrowest phone.
 * It's set in the body face (Inter, 16px): "Case number or employer", 23
 * characters, measures 196px there (Oct 1 2026). The cap is on characters
 * because a static test can't measure a font; 24 keeps the longest allowed
 * placeholder inside 212px at Inter's widths.
 */
const MAX_CHARS = 24;

describe("the hero case input's placeholder fits a phone", () => {
  const source = readFileSync("src/components/home/HeroSection.tsx", "utf8");

  it("finds the placeholder it is meant to check", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    expect(/placeholder="[^"]*"/.test(source)).toBe(true);
  });

  it("keeps every placeholder in the hero within the narrowest phone", () => {
    const offenders = [...source.matchAll(/placeholder="([^"]*)"/g)]
      .map((m) => m[1]!)
      .filter((p) => p.length > MAX_CHARS);
    expect(offenders).toEqual([]);
  });
});
