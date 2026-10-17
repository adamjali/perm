/**
 * The page never slides sideways on a phone. html's overflow-x: hidden doesn't
 * stop iPhone Safari panning a page whose content is wider than the screen (the
 * case list's pagination did it, Oct 17 2026), so body clips sideways overflow.
 * `clip`, never `hidden`: hidden makes body a scroll container and every sticky
 * header and the data rail would stop sticking.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
const body = /@layer base \{[\s\S]*?\n {2}body \{([\s\S]*?)\n {2}\}/.exec(css)?.[1] ?? "";

describe("no sideways pan on a phone", () => {
  it("finds the base body rule", () => {
    expect(body).toContain("@apply bg-background");
  });

  it("clips sideways overflow at the body, without making it a scroll container", () => {
    expect(body).toMatch(/overflow-x:\s*clip;/);
    expect(body).not.toMatch(/overflow(-x)?:\s*(hidden|auto|scroll);/);
  });

  it("breaks a string with nowhere to break only when it would run past its box", () => {
    expect(body).toMatch(/overflow-wrap:\s*break-word;/);
  });

  it("never lets a select grow past its box, from the base layer so a narrower width still wins", () => {
    expect(css).toMatch(/@layer base \{\s*select \{\s*max-width: 100%;\s*\}\s*\}/);
  });
});
