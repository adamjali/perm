import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DOL's processing times page stopped printing a PERM filing month on Oct 31 2026: its PERM table is now the
 * average days to a decision over the last 30, 90 and 180 days, with no audit row. Fifteen places kept saying
 * DOL publishes the month its analysts (or its audit queue) have reached, and one guide's sentence ended with
 * nothing where the audit month had been. The month DOL is working comes from this site's daily check now
 * (convex/lib/permLine.ts).
 *
 * The wage-request table still prints its months, so a sentence about wage requests is left alone. A sentence
 * that says when DOL stopped ("until October 31", "no longer", "stopped") is history and passes.
 */
const CLAIMS = [
  /\bDOL publishes (?:which|the) (?:filing )?month\b/i,
  /\bDOL publishes (?:its|where)\b[^.]{0,40}\b(?:position|queue stands|month)\b/i,
  /\bpublished (?:frontier|position)\b/i,
  // the audit QUEUE's place, never the audit rate (which DOL has never published, and pages say so)
  /\baudit (?:review )?(?:queue|position|backlog)\b[^.]{0,80}\b(?:DOL publishes|published|DOL's table names)\b/i,
  /\bDOL publishes (?:a|an|its)\b[^.]{0,30}\baudit review\b/i,
  /\bmonth DOL says its analyst\b/i,
  // "a separate queue that DOL publishes its own date for", "their own queue, which DOL publishes separately"
  /\bqueue\b[^.]{0,40}\b(?:which|that) DOL publishes\b/i,
  /\bmonth DOL (?:says|publishes)\b/i,
  // "DOL works cases roughly in filing order and publishes which filing month it is deciding now": the verb away from
  // its subject (Nov 4 2026, the estimates guide).
  /\bDOL\b[^.]{0,80}\b(?:publishes|prints) (?:which|the) (?:filing )?month\b/i,
];

// A wage request's month is still printed; a dated sentence is history.
const ABOUT_WAGES = /\b(?:wage|prevailing|PWD|9141|NPWC|the center)\b/i;
const HISTORY = /\b(?:until October 31|since October 31|October 31, 2026|no longer|stopped|used to|printed|was working)\b/i;

// Rendered only while DOL's own stored reading carries a month (`from !== "check"`), so true whenever they show.
const WHILE_DOL_PRINTS = [
  "month DOL publishes as its analyst-review", // perm-queue/page.tsx, behind `agrees`
  "DOL publishes its own analyst-review position as", // CaseWall, behind `publishedFront`
];

// Wage-request pages, where "the month it's working" is the wage table's, which DOL still prints.
const WAGE_PAGES = new Set(["content/guides/track-a-prevailing-wage-request.mdx"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === "node_modules" || e === "__tests__" || e === "changelog") continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(mdx|tsx|ts)$/.test(e) && !/\.(test|stories)\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

/** Comments say what code does with DOL's stored month; only what a reader sees is judged. */
function readerText(path: string, src: string): string {
  if (path.endsWith(".mdx")) return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

export function staleMonthClaims(text: string): string[] {
  const sentences = text.replace(/&rsquo;|’/g, "'").replace(/&apos;/g, "'").split(/(?<=[.!?])\s+|\n\s*\n/);
  return sentences.filter(
    (s) =>
      CLAIMS.some((re) => re.test(s)) &&
      !ABOUT_WAGES.test(s) &&
      !HISTORY.test(s) &&
      !WHILE_DOL_PRINTS.some((p) => s.includes(p)),
  );
}

describe("no page says DOL still prints its PERM month", () => {
  it("finds the claim when it's there (control)", () => {
    expect(staleMonthClaims("DOL publishes which month it's working and nothing about the size of what's behind it.")).toHaveLength(1);
    expect(staleMonthClaims("Audited cases sit in a separate queue that DOL publishes its own date for.")).toHaveLength(1);
    expect(staleMonthClaims("Audited cases wait in their own queue, which DOL publishes separately.")).toHaveLength(1);
    expect(staleMonthClaims("The estimate is anchored to DOL's published position.")).toHaveLength(1);
    expect(staleMonthClaims("DOL publishes an Audit Review queue position alongside its analyst review position.")).toHaveLength(1);
    expect(staleMonthClaims("It opens with the filing month DOL says its analyst review is working.")).toHaveLength(1);
    expect(staleMonthClaims("DOL works cases roughly in filing order and publishes which filing month it is deciding now.")).toHaveLength(1);
  });

  it("passes the audit RATE, which DOL has never published", () => {
    expect(staleMonthClaims("An audit rate is not published anywhere we can source.")).toHaveLength(0);
    expect(staleMonthClaims("DOL publishes no PERM audit rate.")).toHaveLength(0);
  });

  it("passes a wage-request sentence and a dated one", () => {
    expect(staleMonthClaims("DOL publishes the filing month it is currently working for wage requests.")).toHaveLength(0);
    expect(staleMonthClaims("Until October 31, 2026, DOL published the filing month its analysts had reached.")).toHaveLength(0);
    expect(staleMonthClaims("DOL stopped printing which filing month its analysts have reached.")).toHaveLength(0);
  });

  it("holds for every page, guide, post and shared string", () => {
    const files = [...walk("src"), ...walk("content")].filter((f) => !WAGE_PAGES.has(f));
    expect(files.length).toBeGreaterThan(400);
    const found = files.flatMap((f) => staleMonthClaims(readerText(f, readFileSync(f, "utf8"))).map((s) => `${f}: ${s.trim().slice(0, 160)}`));
    expect(found).toEqual([]);
  });
});
