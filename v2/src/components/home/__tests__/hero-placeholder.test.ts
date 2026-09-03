import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A placeholder longer than its input is clipped, and nobody sees it clipped
 * on the machine they wrote it on.
 *
 * Measured on the live page at four phone widths: the hero input has 212px of
 * usable space at 320px, 267 at 375, 282 at 390 and 322 at 430. At the 16px
 * mono face this input uses, a 38-character placeholder measured 365px, so it
 * was clipped on EVERY phone. `G-100-24339-516453` is 18 characters and 173px.
 *
 * 22 characters is roughly 210px in that face, which is the 320px budget. The
 * cap is on characters rather than pixels because a static test cannot measure
 * a font; it is deliberately a little tight so the real check never has to run.
 */
const MAX_CHARS = 22;

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
