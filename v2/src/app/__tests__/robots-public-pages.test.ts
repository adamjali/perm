/**
 * No public page is blocked by robots.txt.
 *
 * A robots.txt path is a prefix, so '/api' blocked '/api-terms' and Search
 * Console listed the page "indexed, though blocked by robots.txt" (Oct 4
 * 2026). Every page under the public tree is checked against the '*' group
 * with the longest-match rule crawlers use (RFC 9309).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import robots from "../robots";

const PUBLIC = path.join(process.cwd(), "src/app/(site)/(public)");

function publicPaths(dir = PUBLIC, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith("[") || name.startsWith("_") || name.startsWith("@")) continue;
    const seg = name.startsWith("(") ? "" : `/${name}`;
    const child = path.join(dir, name);
    if (fs.existsSync(path.join(child, "page.tsx"))) out.push(prefix + seg || "/");
    out.push(...publicPaths(child, prefix + seg));
  }
  return out;
}

function list(v: string | string[] | undefined): string[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

/** RFC 9309: the longest matching rule decides; a tie goes to allow. */
function allowed(p: string, allow: string[], disallow: string[]): boolean {
  const longest = (rules: string[]) => Math.max(-1, ...rules.filter((r) => r && p.startsWith(r)).map((r) => r.length));
  return longest(allow) >= longest(disallow);
}

describe("robots.txt", () => {
  const rules = list(robots().rules as never).find((r: { userAgent?: string | string[] }) =>
    list(r.userAgent).includes("*"),
  ) as { allow?: string | string[]; disallow?: string | string[] };
  const pages = publicPaths();

  it("finds the public pages it checks", () => {
    expect(pages.length).toBeGreaterThan(80);
    expect(pages).toContain("/api-terms");
  });

  it("blocks no public page", () => {
    const blocked = pages.filter((p) => !allowed(p, list(rules.allow), list(rules.disallow)));
    expect(blocked).toEqual([]);
  });

  it("still blocks the API itself", () => {
    expect(allowed("/api/case-search", list(rules.allow), list(rules.disallow))).toBe(false);
  });
});
