import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Two things this public site and its public repository must never say again.
 *
 * 1. WHO ACTED. The employer census was headed "Whose PERM cases DOL has pulled
 *    aside" over 5,958 cases, 2,848 of them appeals the employers filed
 *    themselves, and it was quoted to about 127,000 people on X on Sep 25 2026.
 *    A hold, an RFI or a NORD is DOL's doing; an appeal is the employer's.
 *    Comments may quote the old headline to explain it; rendered code may not.
 *
 * 2. THE FIREWALL KEY. Rule 5 bypassed Bot Protection for any request that
 *    merely carried `x-permtracker-audit`, and a dozen scripts in this public
 *    repository sent it with the value "1". The rule now matches a secret
 *    value kept in `.env.local`; a script that hardcodes a value either leaks
 *    the key or sends one the firewall ignores.
 */

const ROOT = process.cwd();

function walk(dir: string, keep: (p: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".") || name === "__tests__") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, keep, out);
    else if (keep(p)) out.push(p);
  }
  return out;
}

/** Source with // and block comments removed, so an explanation can quote what the code may not say. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("public surface hygiene", () => {
  it("never attributes every out-of-queue case to DOL", () => {
    const files = walk(join(ROOT, "src"), (p) => /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p));
    expect(files.length).toBeGreaterThan(300);
    const offenders = files.filter((f) => /DOL(?:'s|&apos;s)?\s+(?:has\s+)?pulled/i.test(code(readFileSync(f, "utf8"))));
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });

  it("catches the old headline in rendered code (control)", () => {
    expect(/DOL(?:'s|&apos;s)?\s+(?:has\s+)?pulled/i.test(code("<h1>Whose PERM cases DOL has pulled aside</h1>"))).toBe(true);
    expect(/DOL(?:'s|&apos;s)?\s+(?:has\s+)?pulled/i.test(code("// Whose PERM cases DOL has pulled aside"))).toBe(false);
  });

  it("never hardcodes a value for the firewall's audit header", () => {
    const literal = /x-permtracker-audit["']?\s*[:=,]\s*["'][^"'$]+["']|x-permtracker-audit:\s*[A-Za-z0-9]+["']/;
    const files = walk(join(ROOT, "scripts"), (p) => /\.(py|mjs|js|sh)$/.test(p) && !/test_/.test(p));
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8")
        .split("\n")
        // the probe deliberately sends a WRONG value to prove it is refused
        .filter((l) => !l.includes("wrong value"))
        .join("\n");
      return literal.test(src);
    });
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
    // control: the shape every script used until Sep 25 2026
    expect(literal.test(`headers={"x-permtracker-audit": "1"}`)).toBe(true);
    expect(literal.test(`-H "x-permtracker-audit: 1"`)).toBe(true);
    expect(literal.test(`{ "x-permtracker-audit": AUDIT_KEY }`)).toBe(false);
  });
});
