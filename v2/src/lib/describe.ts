/**
 * The longest search-result description that fits.
 *
 * Callers pass candidates richest first; the first one at or under the cap
 * wins. Google cuts a snippet near 155 characters, so a longer one ends
 * mid-sentence, while a short one leaves the space unused, which is what a
 * template offering only a short form and a shorter one produces on nearly
 * every employer, law firm, occupation and place page.
 *
 * If nothing fits (a very long legal name), the last candidate is cut at a
 * word boundary rather than mid-word.
 */
export const DESCRIPTION_MAX = 155;

export function firstThatFits(candidates: readonly string[], max: number = DESCRIPTION_MAX): string {
  for (const c of candidates) if (c.length <= max) return c;
  const last = candidates[candidates.length - 1] ?? "";
  const cut = last.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,:;\s]+$/, "")}.`;
}

/** "a", "a and b", "a, b and c". */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Candidates for `firstThatFits` that say what a page holds: `${lead} See a, b
 * and c${tail}.` for every run of `items` that keeps their order and keeps the
 * first, with every tail, longest first. So the one that fits says the most it
 * can about the page. Bing asks for 150 to 160 characters (its "too short"
 * report, Oct 2026) and Google cuts near 155, so filling the space with what the
 * page really holds suits both. Every item must be something every page in the
 * template shows; up to 8 items.
 */
export function seeCandidates(lead: string, items: readonly string[], tails: readonly string[] = [""]): string[] {
  if (items.length === 0) return [];
  const [first, ...rest] = items.slice(0, 8);
  const out = new Set<string>();
  for (let mask = 0; mask < 1 << rest.length; mask++) {
    const picked = [first as string, ...rest.filter((_, i) => mask & (1 << i))];
    for (const tail of tails) out.add(`${lead} See ${andList(picked)}${tail}.`);
  }
  return [...out].sort((a, b) => b.length - a.length);
}
