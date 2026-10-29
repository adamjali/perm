import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The privacy page names every company the chat sends a conversation to, and
 * says nothing about them that the chat's free tiers make false. On Oct 29 2026
 * its AI section was corrected while its retention list still said OpenRouter
 * kept nothing ("Zero Data Retention"): the free model the chain runs on can't
 * be reached under that setting. Two parts of one page disagreeing is the defect.
 */

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");
const flat = (s: string) => s.replace(/\s+/g, " ");

const PROVIDER_NAMES: Record<string, RegExp> = {
  google: /Google Gemini/,
  groq: /Groq/,
  mistral: /Mistral AI/,
  openrouter: /OpenRouter/,
};

describe("the privacy page and the chat's providers", () => {
  const chain = read("lib/ai/providers.ts") + read("lib/ai/summarize.ts");
  const used = [...new Set([...chain.matchAll(/\b(google|groq|mistral|openrouter)\(\s*['"]/g)].map((m) => m[1]!))];
  const page = flat(read("app/(site)/(public)/privacy/page.tsx"));

  it("finds the chain's providers", () => {
    expect(used.length).toBeGreaterThanOrEqual(3);
  });

  it("names every provider the chat or summarizer calls", () => {
    for (const p of used) expect(page, p).toMatch(PROVIDER_NAMES[p]!);
  });

  it("claims no zero retention or no storage for a free-tier provider", () => {
    expect(page).not.toMatch(/Zero Data Retention|\bZDR\b/);
    expect(page).not.toMatch(/(OpenRouter|Groq|Mistral AI|Google Gemini): Not stored/);
    expect(page).not.toMatch(/Does not use API data to train/i);
  });
});
