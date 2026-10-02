/**
 * Large image previews everywhere (Google Discover needs max-image-preview:large
 * to show a big picture). The root layout sets them; a page that sets `robots`
 * replaces the WHOLE object, so a page restating `index: true` silently drops
 * them. Four legal pages did that until Oct 2 2026.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__") pages(p, out);
    } else if (/^(page|layout)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("robots preview settings", () => {
  it("the root asks every engine, and Google by name, for large previews", () => {
    // Read as text: importing the layout pulls in next/font, which only runs in a build.
    const src = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    const robots = src.slice(src.indexOf("robots: {"), src.indexOf("verification:"));
    const general = robots.slice(0, robots.indexOf("googleBot:"));
    const google = robots.slice(robots.indexOf("googleBot:"));
    expect(general).toContain('"max-image-preview": "large"');
    expect(general).toContain('"max-snippet": -1');
    expect(google).toContain('"max-image-preview": "large"');
  });

  it("no page restates index: true and drops them", () => {
    const files = pages(join(process.cwd(), "src/app"));
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((f) => {
      if (f.endsWith(join("src", "app", "layout.tsx"))) return false;
      return /robots:\s*\{[^}]*index:\s*true/.test(readFileSync(f, "utf8"));
    });
    expect(offenders).toEqual([]);
  });
});
