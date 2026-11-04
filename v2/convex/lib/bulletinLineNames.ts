/**
 * A visa bulletin line's names: its slug for `/visa-bulletin/categories/<slug>` and its short name for titles
 * and notifications. Here, not in src/lib/bulletinLines.ts (which re-exports them), so Convex's bulletin push
 * names a line exactly as its page does.
 *
 * The slug is words, not codes, because the words are what people search: "eb3 other workers" rather than
 * "EW3", "rest of world" rather than the bulletin's "all chargeability areas except those listed".
 */

import type { CountryKey } from "./perm/calculators/priorityDate";

/** Bulletin category code -> slug. A code with no entry gets no page. */
export const CATEGORY_SLUG: Record<string, string> = {
  EB1: "eb1",
  EB2: "eb2",
  EB3: "eb3",
  EW3: "eb3-other-workers",
  EB4: "eb4",
  EB5: "eb5-unreserved",
  EB5R: "eb5-rural",
  EB5HU: "eb5-high-unemployment",
  EB5I: "eb5-infrastructure",
};

export const COUNTRY_SLUG: Record<CountryKey, string> = {
  india: "india",
  china: "china",
  mexico: "mexico",
  philippines: "philippines",
  worldwide: "rest-of-world",
};

/** In the order the pages list them: the two long queues first. */
export const LINE_PAGE_COUNTRIES: readonly CountryKey[] = ["india", "china", "philippines", "mexico", "worldwide"];

/** Short names for titles and headings. */
export const LINE_CATEGORY_SHORT: Record<string, string> = {
  EB1: "EB-1",
  EB2: "EB-2",
  EB3: "EB-3",
  EW3: "EB-3 Other Workers",
  EB4: "EB-4",
  EB5: "EB-5 Unreserved",
  EB5R: "EB-5 Rural",
  EB5HU: "EB-5 High Unemployment",
  EB5I: "EB-5 Infrastructure",
};

export const LINE_COUNTRY_SHORT: Record<CountryKey, string> = {
  india: "India",
  china: "China",
  mexico: "Mexico",
  philippines: "Philippines",
  worldwide: "Rest of World",
};

export function lineSlug(category: string, country: CountryKey): string {
  return `${CATEGORY_SLUG[category] ?? category.toLowerCase()}-${COUNTRY_SLUG[country]}`;
}

/** "EB-2 India", "EB-3 Other Workers, Rest of World". */
export function lineName(category: string, country: CountryKey): string {
  const cat = LINE_CATEGORY_SHORT[category] ?? category;
  return cat.includes(" ") ? `${cat}, ${LINE_COUNTRY_SHORT[country]}` : `${cat} ${LINE_COUNTRY_SHORT[country]}`;
}
