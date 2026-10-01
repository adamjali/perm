/**
 * The longest search-result description that fits.
 *
 * Callers pass candidates richest first; the first one at or under the cap
 * wins. Google cuts a snippet near 155 characters, so a longer one ends
 * mid-sentence, while a short one leaves the space unused: an Ahrefs crawl and
 * our own audit (Oct 1 2026) found 285 of 855 sampled pages under 110
 * characters, nearly every employer, law firm, occupation and place page,
 * because each template offered only a short form and a shorter one.
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
