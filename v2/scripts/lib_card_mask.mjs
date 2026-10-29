/**
 * What a social card masks when its spec says `"mask": "figures"`: every figure and date that moves with the data
 * (counts, percentages, dollar amounts, "October 27, 2026", "Jan 2026"), drawn as a grey bar of the same width, so
 * the card keeps the page's shape and never carries a stale number (owner's rule: a card holds no live figure).
 * Left alone: codes and names that carry digits (G-100-26125-868956, ETA-9089, I-140, FY2016, H-1B), and numbers of
 * one or two digits, which are mostly fixed wording ("60 days' notice").
 */
const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

export const FIGURE_SOURCE = [
  // A range: "3 to 4 months", "3.4 to 10 years", or "3.4 to 10" when a page renders the unit as its own text.
  "(?<![\\w-])\\d+(?:\\.\\d+)?\\s+to\\s+\\d+(?:\\.\\d+)?(?:\\s+(?:days|weeks|months|years)\\b)?(?![\\w-])",
  // A day's move: "+49", "-12" (after a space, so "I-140" and "G-100" stay).
  "(?<![\\w-])\\+\\d+\\b",
  "(?<=\\s)[-\\u2212]\\d+\\b",
  // A weekday names a day that passes: "Since the end of Tuesday".
  "\\b(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\\b",
  // A date as data prints it: "2026-10-21", "2026-11", and State's "01NOV13".
  "(?<![\\w-])\\d{4}-\\d{2}(?:-\\d{2})?(?![\\w-])",
  "\\b\\d{2}(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\\d{2}\\b",
  // A date: "October 27, 2026", "Oct 8", "January 2026".
  `\\b${MONTH}\\.?\\s+\\d{1,2}(?:,\\s*\\d{4})?\\b`,
  `\\b${MONTH}\\.?\\s+\\d{4}\\b`,
  // A count with thousands commas, or a dollar amount: "17,263", "$110,000".
  `(?<![\\w-])\\$?\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?%?(?![\\w-])`,
  // A percentage: "88%", "3.3%".
  `(?<![\\w-])\\d+(?:\\.\\d+)?%`,
  // A bare number of three or more digits: "598", "2026".
  `(?<![\\w-])\\$?\\d{3,}(?:\\.\\d+)?(?![\\w-])`,
].join("|");

/** Text that is only a figure ("8", "+49", "26%"): a count in its own cell, however short, is masked whole. */
export const BARE_SOURCE = "^\\s*[+\\-\\u2212]?\\$?\\d[\\d,.]*%?\\s*$";

export function isBareFigure(text) {
  return new RegExp(BARE_SOURCE).test(text);
}

/** The runs of `text` a card masks, in order. */
export function figureRuns(text) {
  return [...text.matchAll(new RegExp(FIGURE_SOURCE, "g"))].map((m) => m[0]);
}

/** The bar a masked run is drawn as: the run's own width, no text, the reviews card's grey. */
export const MASK_STYLE = "color:transparent!important;background:#E2E2E2!important;text-shadow:none!important";
