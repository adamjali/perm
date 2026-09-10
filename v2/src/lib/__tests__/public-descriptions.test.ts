import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * No PUBLIC description may tell a reader this site is attorney-only software.
 *
 * The September 2026 audit fixed 41 places where a reader would form a wrong
 * belief about what this site can look up. It walked pages and libs. It did not
 * walk **MDX frontmatter**, and frontmatter `description` is exactly what Google
 * prints as the snippet - so on 2026-09-10 the search result for the brand query
 * still read "The complete guide to tracking PERM cases, from creating your
 * first case to mastering deadlines, recruitment, notifications, and the AI
 * assistant", from an article whose BODY had already been corrected.
 *
 * Third instance of one lesson: enumerate surfaces by how they are READ, not by
 * whether they are pages. Routes and libs were the first two (`llms.txt`, the
 * shared JSON-LD description); frontmatter is the third.
 *
 * SCOPE IS PUBLIC METADATA ONLY. The signed-in app really is case-management
 * software, and its own copy ("Get started by creating your first case" in a
 * dashboard empty state, the product tour's "the AI assistant") is accurate
 * where it sits. A gate that flagged those would be wrong and would be
 * suppressed within a week.
 */
const ROOT = join(__dirname, "..", "..", "..");

/** Copy that would tell a searcher the product is attorney-only, or overclaim. */
const STALE: Array<[RegExp, string]> = [
  [/creating your first case|\byour first case\b/i, "app-onboarding framing"],
  [/mastering deadlines|the AI assistant/i, "app-feature framing"],
  [/for immigration attorneys\b|attorneys and law firms\b/i, "attorney-only"],
  [/case management (software|platform|system)/i, "attorney-only"],
  [/check any PERM case number|\bany PERM case\b(?! number, or)/i, "PERM-only, omits P- and I-"],
  [/real[- ]time/i, "the DOL sweep is daily, not real time"],
];

/**
 * Descriptions allowed to match, each with the reason. An exception list that
 * can grow in silence is how a gate dies, so the count is asserted below.
 */
const ALLOWED: Array<[string, string]> = [
  [
    "content/blog/best-immigration-case-management-tools.mdx",
    "The article's SUBJECT is case-management software - it is a comparison piece. " +
      "Describing it any other way would misdescribe the article.",
  ],
];

function mdxFiles(): string[] {
  const out: string[] = [];
  for (const kind of ["blog", "guides", "changelog"]) {
    const dir = join(ROOT, "content", kind);
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".mdx") && statSync(join(dir, f)).isFile()) {
        out.push(join("content", kind, f));
      }
    }
  }
  return out;
}

interface Hit { file: string; key: string; text: string; why: string }

function scan(): { hits: Hit[]; scanned: number } {
  const hits: Hit[] = [];
  let scanned = 0;
  for (const rel of mdxFiles()) {
    const parts = readFileSync(join(ROOT, rel), "utf8").split("---");
    if (parts.length < 3) continue;
    const fm = parts[1] ?? "";
    for (const key of ["description", "seoDescription"]) {
      const m = new RegExp(`^${key}:\\s*"(.*?)"\\s*$`, "m").exec(fm);
      if (!m?.[1]) continue;
      scanned += 1;
      const bad = STALE.find(([re]) => re.test(m[1]!));
      if (bad) hits.push({ file: rel, key, text: m[1]!, why: bad[1] });
    }
  }
  return { hits, scanned };
}

describe("public descriptions", () => {
  it("scans a plausible number of them, so a broken path cannot read as a pass", () => {
    const { scanned } = scan();
    // 55 MDX pieces at the time of writing, most carrying both keys.
    expect(scanned).toBeGreaterThan(60);
  });

  it("detects the exact string Google was printing (control)", () => {
    const real =
      "The complete guide to tracking PERM cases, from creating your first case to " +
      "mastering deadlines, recruitment, notifications, and the AI assistant.";
    expect(STALE.some(([re]) => re.test(real))).toBe(true);
    // ...and does not fire on the copy that replaced it.
    const fixed =
      "PERM Tracker has two halves: look up any PERM, PWD or LCA case number with " +
      "no account, or sign in to manage a caseload. This guide covers both.";
    expect(STALE.some(([re]) => re.test(fixed))).toBe(false);
  });

  it("has no stale public description outside the written exceptions", () => {
    const allowed = new Set(ALLOWED.map(([f]) => f));
    const unexpected = scan().hits.filter((h) => !allowed.has(h.file));
    expect(
      unexpected.map((h) => `${h.file} ${h.key}: ${h.why} :: ${h.text}`),
    ).toEqual([]);
  });

  it("keeps the exception list short and reasoned", () => {
    expect(ALLOWED).toHaveLength(1);
    for (const [file, reason] of ALLOWED) {
      expect(mdxFiles()).toContain(file);        // a stale exception is a dead one
      expect(reason.length).toBeGreaterThan(40); // a reason, not a shrug
    }
  });
});
