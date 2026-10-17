import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Articles written for attorneys cite the way an attorney expects: Bluebook,
 * "20 C.F.R. § 656.10(d)", "72 Fed. Reg. 27,904". The attorney who reviewed the
 * practice templates asked for it (Oct 17 2026); pages for people waiting on
 * their own case stay plain. Quoted regulation text is left as written, so the
 * check skips anything inside quotation marks.
 */

const ROOT = join(process.cwd(), "content");

function isAttorneyFacing(raw: string): boolean {
  const fm = /^---\n([\s\S]*?)\n---/.exec(raw)?.[1] ?? "";
  if (/^category:\s*"practice"/m.test(fm)) return true;
  if (/^tags:.*"practice"/m.test(fm)) return true;
  const body = raw.slice(fm.length + 8).trim();
  const first = body.split("\n", 1)[0] ?? "";
  return /\bfor (?:the )?attorneys?\b|\bfor immigration attorneys\b|\bparalegal/i.test(first);
}

function oldStyleCitations(raw: string): string[] {
  if (/^published:\s*false/m.test(raw)) return [];
  const found: string[] = [];
  for (const line of raw.split("\n")) {
    if (/^(?:tags|image|title|seoTitle):/.test(line)) continue;
    // Quoted regulation text keeps its own wording; frontmatter values are quoted too.
    const fmValue = /^(?:description|seoDescription|imageAlt|imageCredit):\s*"(.*)"$/.exec(line);
    const text = fmValue
      ? fmValue[1]!
      : line.replace(/\\"(?:[^"\\]|\\[^"])*\\"/g, "").replace(/"[^"\n]*"/g, "").replace(/\]\([^)]*\)/g, "]");
    const m = text.match(/\b\d+ CFR\b|\b\d+ FR \d|\((?=\d{3}\.\d)/g);
    if (m) found.push(line.trim().slice(0, 120));
  }
  return found;
}

describe("attorney-facing articles cite in Bluebook form", () => {
  const files = ["blog", "guides"].flatMap((t) =>
    readdirSync(join(ROOT, t))
      .filter((n) => n.endsWith(".mdx"))
      .map((n) => ({ name: `${t}/${n}`, raw: readFileSync(join(ROOT, t, n), "utf8") })),
  );
  const attorney = files.filter((f) => isAttorneyFacing(f.raw));

  it("finds the attorney-facing articles", () => {
    // 21 on Oct 17 2026; a drop means the detection broke, not that pages left.
    expect(attorney.length).toBeGreaterThanOrEqual(20);
  });

  it.each(attorney.map((f) => [f.name, f.raw] as const))("%s", (_name, raw) => {
    expect(oldStyleCitations(raw)).toEqual([]);
  });

  it("flags an old-style citation and leaves a quoted one alone", () => {
    const page = [
      "---",
      'description: "What 20 CFR 656.10(d) asks."',
      "---",
      "The rule is in (656.17(e)).",
      'It reads "under 20 CFR 656.40(c) and 656.21".',
      "A DOL rule, 72 FR 27904.",
    ].join("\n");
    expect(oldStyleCitations(page)).toHaveLength(3);
    expect(oldStyleCitations(page.replace(/72 FR 27904/, "72 Fed. Reg. 27,904"))).toHaveLength(2);
  });
});
