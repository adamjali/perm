import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DOL's published average and its queue month are read live (lib/dolNow.ts,
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
]);

// "about 372 days", "average ... 336 days", "working cases filed around September 2025"
const TYPED = [
  /\b(?:about|averages?|average of|average is|average puts it at)\s+(?:about\s+)?\*{0,2}3\d\d\*{0,2}\s+days/i,
  /working cases filed (?:around|in)\s+\*{0,2}(?:January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d/i,
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
    expect(typedDolFigures("As of August 2026 DOL is working cases filed around September 2025.")).toHaveLength(1);
    expect(typedDolFigures("an average of about **372 days** from filing")).toHaveLength(1);
    expect(typedDolFigures("<DolNow show=\"average\" /> on DOL's published average")).toHaveLength(0);
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
