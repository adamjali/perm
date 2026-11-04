import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The site keeps a row's `source` only when it names a source it knows, and reads anything else as null. Three
 * sources (court dockets, DOJ, embassies) were written by the Python feed and missing from the site's list, so
 * their rows reached the page with no source. The two lists are read as text: the reader is server-only.
 */
function pythonSources(): string[] {
  const src = readFileSync("scripts/lib_policy_feed.py", "utf8");
  const block = src.match(/^SOURCES = \(([\s\S]*?)\)$/m);
  if (!block) throw new Error("SOURCES not found in scripts/lib_policy_feed.py");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function siteSources(): string[] {
  const src = readFileSync("src/lib/db/policyNotices.ts", "utf8");
  const block = src.match(/const SOURCES: readonly PolicySource\[\] = \[([\s\S]*?)\];/);
  if (!block) throw new Error("SOURCES not found in src/lib/db/policyNotices.ts");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function siteUnion(): string[] {
  const src = readFileSync("src/lib/db/policyNotices.ts", "utf8");
  const block = src.match(/export type PolicySource =([\s\S]*?);/);
  if (!block) throw new Error("PolicySource not found in src/lib/db/policyNotices.ts");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("the site knows every policy source the feed writes", () => {
  it("reads both lists (control)", () => {
    expect(pythonSources().length).toBeGreaterThan(10);
    expect(pythonSources()).toContain("embassies");
  });

  it("the site's list and type match the Python feed's", () => {
    const py = [...pythonSources()].sort();
    expect([...siteSources()].sort()).toEqual(py);
    expect([...siteUnion()].sort()).toEqual(py);
  });
});
