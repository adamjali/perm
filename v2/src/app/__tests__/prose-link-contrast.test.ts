import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * In-article links must be readable on the light page.
 *
 * globals.css remaps `.text-primary` to the text-safe --primary-text, but that
 * remap lives in `@layer utilities`, and `.prose-neobrutalist a` is UNLAYERED,
 * so it wins regardless of specificity. With `color: var(--primary)` it painted
 * every link in every guide and blog post #2ECC40 on #FAFAFA: 2.05:1 against
 * the 4.5:1 floor, measured in the browser on 2026-09-23 after an outside audit
 * flagged it. The MDX renderer's own `text-primary` class never got a say.
 */

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} not found in globals.css`);
  return css.slice(start, css.indexOf("}", start));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("in-article link contrast", () => {
  it("the unlayered prose link rule paints with the text-safe token, never the brand lime", () => {
    const rule = block(".prose-neobrutalist a");
    expect(rule).toMatch(/\bcolor:\s*var\(--primary-text\)/);
    expect(rule).not.toMatch(/\bcolor:\s*var\(--primary\)/);
  });

  it("the light theme's --primary-text clears 4.5:1 on the light page", () => {
    const start = css.indexOf(":root {");
    const root = css.slice(start, css.indexOf("\n}", start));
    const text = root.match(/--primary-text:\s*(#[0-9a-fA-F]{6})/)?.[1];
    const page = root.match(/--background:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(text, "--primary-text in :root").toBeDefined();
    expect(page, "--background in :root").toBeDefined();
    expect(contrast(text!, page!)).toBeGreaterThanOrEqual(4.5);
    // The control: the lime itself must FAIL on the same page, or this
    // arithmetic is not measuring what it claims to.
    expect(contrast("#2ECC40", page!)).toBeLessThan(4.5);
  });
});
