/**
 * The key a job title is counted under, the same as scripts/build_soc_titles.py writes it
 * (`title_key`), so a title typed into the finder lands on the row the builder wrote.
 * scripts/fixtures/soc_title_keys.json holds the two together.
 *
 * Lower case, accents off, "&" as "and", anything not a letter or digit a space;
 * seniority words at the front dropped (senior, sr, jr, junior, lead, staff,
 * principal) and level marks at the end (I to V, 1 to 9, "level"), never the last
 * word. "SR. SOFTWARE ENGINEER III" and "Software Engineer" are one title.
 */

const SENIORITY: ReadonlySet<string> = new Set(["senior", "sr", "jr", "junior", "lead", "staff", "principal"]);
const LEVELS: ReadonlySet<string> = new Set(["i", "ii", "iii", "iv", "v", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const LEVEL_WORDS: ReadonlySet<string> = new Set(["level", "lvl"]);

/** Lower case, accents off, "&" as "and", every other non-letter or digit a space, split into words. */
export function titleWords(raw: string): string[] {
  return (raw ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

export function titleKey(raw: string): string {
  const words = titleWords(raw);
  while (words.length > 1 && SENIORITY.has(words[0]!)) words.shift();
  while (words.length > 1 && (LEVELS.has(words[words.length - 1]!) || LEVEL_WORDS.has(words[words.length - 1]!))) words.pop();
  return words.join(" ");
}

/** A title page's address segment: the key with hyphens for spaces. */
export const titleSlug = (key: string): string => key.replace(/ /g, "-");

/** The key a title page's address segment stands for; null when it can't be one. */
export function keyOfSlug(slug: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return null;
  return slug.replace(/-/g, " ");
}
