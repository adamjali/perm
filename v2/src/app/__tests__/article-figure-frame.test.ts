import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * An article's figure components draw their own frame, and the picture fills it.
 *
 * `.prose-article img` is unlayered and gives a bare markdown image a border and
 * a 1.5em margin. ScreenshotFigure and VideoFigure are `not-prose`, which keeps
 * the typography plugin's styles away but not this rule, so every article
 * picture sat inside its frame with an empty band above and below it (seen on a
 * phone in the getting-started guide, Oct 21 2026). The rule must skip anything
 * inside `.not-prose`.
 */

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function rulesFor(selectorStart: string): string[] {
  const out: string[] = [];
  let at = css.indexOf(selectorStart);
  while (at >= 0) {
    const open = css.indexOf("{", at);
    out.push(css.slice(at, open).trim());
    at = css.indexOf(selectorStart, open);
  }
  return out;
}

describe("article figures", () => {
  it("the prose image rule leaves a not-prose figure's picture alone", () => {
    const selectors = rulesFor(".prose-article img");
    expect(selectors.length).toBeGreaterThan(0);
    for (const s of selectors) expect(s).toMatch(/:not\(\.not-prose img\)/);
  });

  it("both figure components are not-prose", () => {
    for (const file of ["ScreenshotFigure.tsx", "VideoFigure.tsx"]) {
      const src = readFileSync(join(process.cwd(), "src/components/content", file), "utf8");
      expect(src, file).toMatch(/<figure className="not-prose\b/);
    }
  });
});
