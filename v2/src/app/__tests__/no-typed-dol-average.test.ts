import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DOL's published average, its queue month and its wage-request wait are read live (lib/dolNow.ts,
 * <DolNow /> in articles), never typed into prose. Five articles and the FAQ
 * said "about 372 days as of August 2026" in October, when DOL said 336 and
 * its queue had moved three months.
 *
 * DATED RECORDS ARE ALLOWED: a sentence about what DOL said on one named day,
 * beside what other tools said that day, is history and stays true. Each file
 * allowed here names that day in the sentence.
 */
const DATED_RECORDS = new Set([
  "content/guides/how-accurate-are-perm-estimates.mdx", // "On one day in August 2026, six public PERM tools..."
  "content/guides/reading-the-perm-data.mdx", // "On August 24, 2026 it said 372, while public tools..."
  "src/app/(site)/(public)/methodology/page.tsx", // SPREAD: readings taken 2026-08-24
  "content/changelog/corrections.mdx", // quotes the wrong figure a page printed, beside the day it was corrected
  "src/components/tools/dataShots.ts", // each picture's alt says what its dated capture shows, retaken with the picture
]);

// "about 372 days", "average ... 336 days", "working cases filed around September 2025"
const TYPED = [
  /\b(?:about|averages?|average of|average is|average puts it at)\s+(?:about\s+)?\*{0,2}3\d\d\*{0,2}\s+days/i,
  /working cases filed (?:around|in)\s+\*{0,2}(?:January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d/i,
  // DOL's wage-request wait: "NPWC processing takes 4-7 months", "Processing time**: Currently 4-7 months"
  /\b(?:NPWC|PWD|prevailing wage|processing time)\b[^.,;()\n|]{0,40}?\b\d+\s*(?:-|to|–)\s*\d+\s*(?:months|mo)\b/i,
  // DOL's month in other words (Oct 28 2026, the featured guide): "DOL is reviewing applications filed in
  // November 2025", "DOL is working requests received in April 2026"
  /\bDOL(?:'s|’s)?\s+(?:analyst review\s+)?is\s+(?:working|reviewing|deciding|processing|adjudicating)\s+(?:on\s+)?(?:cases|applications|requests|filings|PERM cases|wage requests)\s+(?:received|filed|submitted)\s+(?:around|in)\s+\*{0,2}(?:January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d/i,
  // an average said another way: "The average time to a determination is 336 days"
  /\baverage\b[^.\n]{0,40}?\bis\s+\*{0,2}[2-4]\d\d\*{0,2}\s+days/i,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === "node_modules" || e === "__tests__") continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(mdx|tsx|ts)$/.test(e)) out.push(p);
  }
  return out;
}

export function typedDolFigures(src: string): string[] {
  return TYPED.flatMap((re) => {
    const m = re.exec(src);
    return m ? [m[0]] : [];
  });
}

describe("DOL's figures are read live, not typed", () => {
  it("finds a typed figure when one is there (control)", () => {
    expect(typedDolFigures("DOL's average is about 372 days as of August 2026.")).toHaveLength(1);
    expect(typedDolFigures("As of August 2026 DOL is working cases filed around September 2025.").length).toBeGreaterThan(0);
    expect(typedDolFigures("an average of about **372 days** from filing")).toHaveLength(1);
    expect(typedDolFigures("<DolNow show=\"average\" /> on DOL's published average")).toHaveLength(0);
    expect(typedDolFigures("Current NPWC processing takes 4-7 months per OFLC.")).toHaveLength(1);
    expect(typedDolFigures("- **Processing time**: Currently 4-7 months (check OFLC)")).toHaveLength(1);
    expect(typedDolFigures("NPWC processing times currently range from 4 to 7 months")).toHaveLength(1);
    expect(typedDolFigures("- **Processing time**: <DolNow show=\"pwdWait\" /> on DOL’s queue")).toHaveLength(0);
    expect(typedDolFigures("the prevailing wage determination, the recruitment period (2-3 months)")).toHaveLength(0);
    expect(typedDolFigures("DOL is reviewing applications filed in November 2025, as of its own figure")).toHaveLength(1);
    expect(typedDolFigures("DOL is working requests received in April 2026 for the standard queue")).toHaveLength(1);
    expect(typedDolFigures("The average time to a determination is 336 days, about eleven months")).toHaveLength(1);
    expect(typedDolFigures("DOL is deciding cases filed in <DolNow show=\"month\" />")).toHaveLength(0);
  });

  it("no page or article types DOL's average or queue month", () => {
    const root = process.cwd();
    const files = [...walk(join(root, "content")), ...walk(join(root, "src", "app")), ...walk(join(root, "src", "components"))];
    expect(files.length).toBeGreaterThan(200);
    const found = files
      .map((f) => ({ f: f.slice(root.length + 1), hits: typedDolFigures(readFileSync(f, "utf8")) }))
      .filter((x) => x.hits.length > 0 && !DATED_RECORDS.has(x.f));
    expect(found, JSON.stringify(found, null, 2)).toEqual([]);
  });
});
