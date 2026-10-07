import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from "@/lib/time";

/** How long between two moments, in the largest whole unit: "8 minutes", "3 days". */
export function between(from: number, to: number): string {
  const ms = Math.max(0, to - from);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (ms < MS_PER_MINUTE) return "under a minute";
  if (ms < MS_PER_HOUR) return plural(Math.floor(ms / MS_PER_MINUTE), "minute");
  if (ms < 2 * MS_PER_DAY) return plural(Math.floor(ms / MS_PER_HOUR), "hour");
  return plural(Math.floor(ms / MS_PER_DAY), "day");
}

/** Where a subscription was made, as the form records it, in words. */
const SOURCE_WORDS: Record<string, string> = {
  "perm-case-status": "the PERM case page",
  "pwd-status": "the wage-request lookup",
  "lca-status": "the LCA lookup",
  "seasonal-status": "the H-2A and H-2B lookup",
  onboarding: "onboarding",
  "employer-page": "an employer page",
};

export const sourceWords = (s: string) => SOURCE_WORDS[s] ?? s;
