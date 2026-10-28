import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY SECTION OPENS WITH ITS ANSWER. Each `##` section of a guide or blog post
 * starts with a plain paragraph whose first sentence answers the heading in 40
 * words or fewer, before any table, list, steps or figure. It's the sentence a
 * search result or an AI answer quotes, and the one a skimming reader takes
 * away; a section that opens with a table gives them nothing to quote (Oct 28
 * 2026: 260 of 685 sections did).
 *
 * The closing sections that hold links or a disclaimer, not an answer
 * ("Related", "What this can't tell you"), are exempt by name.
 */

const EXEMPT = /^(?:related(?: articles| guides| reading)?|what this (?:can.t|doesn.t) tell you|sources|further reading|see also|next steps?)\b/i;
/** The longest first sentence that still reads as one quotable answer. */
export const ANSWER_MAX_WORDS = 40;

export interface SectionLead {
  heading: string;
  problem: string | null;
}

/** Each `##` section's first block, judged: null when it opens with a short plain answer. */
export function sectionLeads(mdx: string): SectionLead[] {
  const body = mdx.replace(/^---[\s\S]*?\n---\n/, "");
  const lines = body.split("\n");
  const out: SectionLead[] = [];
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith("```")) fenced = !fenced;
    if (fenced) continue;
    const m = /^##\s+(.+)$/.exec(line);
    if (!m) continue;
    const heading = m[1]!.trim();
    if (EXEMPT.test(heading)) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j]!.trim()) j++;
    const first = (lines[j] ?? "").trim();
    const opensWithBlock =
      !first ||
      /^[<|#>!{-]/.test(first) ||
      (first.startsWith("*") && !first.startsWith("**")) ||
      /^\d+\.\s/.test(first);
    if (opensWithBlock) {
      out.push({ heading, problem: `opens with ${first ? JSON.stringify(first.slice(0, 30)) : "nothing"}` });
      continue;
    }
    const para: string[] = [];
    while (j < lines.length && lines[j]!.trim()) para.push(lines[j++]!.trim());
    const text = para
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`]/g, "");
    const sentence = text.split(/(?<=[.?!])\s+(?=[A-Z0-9"“(])/)[0] ?? "";
    const words = sentence.split(/\s+/).filter(Boolean).length;
    out.push({ heading, problem: words > ANSWER_MAX_WORDS ? `first sentence is ${words} words` : null });
  }
  return out;
}

const ROOT = join(process.cwd(), "content");
const files = ["guides", "blog"].flatMap((d) =>
  readdirSync(join(ROOT, d))
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => `${d}/${f}`),
);

describe("every article section opens with its answer", () => {
  it("reads the articles it judges", () => {
    expect(files.length).toBeGreaterThan(80);
  });

  it("judges the shapes it should", () => {
    const leads = sectionLeads(
      [
        "## Opens with a table",
        "",
        "| a | b |",
        "## Opens with an answer",
        "",
        "DOL decides cases in filing order. More detail follows here.",
        "## Opens long",
        "",
        `${"word ".repeat(45)}end.`,
        "## Opens in bold",
        "",
        "**Most cases** are decided in filing order.",
        "## Related",
        "",
        "- a link",
      ].join("\n"),
    );
    expect(leads.map((l) => [l.heading, l.problem === null])).toEqual([
      ["Opens with a table", false],
      ["Opens with an answer", true],
      ["Opens long", false],
      ["Opens in bold", true],
    ]);
  });

  it.each(files)("%s", (file) => {
    const bad = sectionLeads(readFileSync(join(ROOT, file), "utf8")).filter((l) => l.problem);
    expect(bad.map((l) => `${l.heading}: ${l.problem}`)).toEqual([]);
  });
});
