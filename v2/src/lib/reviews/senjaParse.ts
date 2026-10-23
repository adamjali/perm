/**
 * The site's reviews, read from the Senja widget's own script (owner's call, Oct 23 2026: "real now use senja
 * widget auto update"). Pure: no fetching here, so it can be tested on a saved script. The fetch is in
 * `src/lib/reviews/senja.ts`.
 *
 * Senja builds the widget script with every published review inside it as one JSON array (`[{"id":...,
 * "rating":...,"text":...,"customer":{"name":...},"date":...}, ...]`) and rebuilds it within minutes of a new
 * review. There's no separate JSON route, so the array is cut out of the script by matching its brackets.
 */

/** Reviews by people who run PERM Tracker. The FTC's rule (16 CFR 465.5) wants an insider's review disclosed as
 * one; by the owner's call (Oct 23 2026) the site counts only outside reviews instead. Senja review ids. */
export const INSIDER_REVIEW_IDS: ReadonlySet<string> = new Set([
  "280adac2-2922-4717-921f-d39c4f779c21", // the attorney who manages PERM Tracker LLC (Feb 7 2026)
  "c8412498-c3c1-4b6a-91fe-4508e6354de1", // the other launch-day review (Feb 7 2026), left out by the same call
]);

export interface SiteReview {
  id: string;
  rating: number;
  text: string;
  name: string;
  /** ISO timestamp from Senja. */
  date: string;
}

export interface ReviewRating {
  value: string;
  count: string;
  best: "5";
  worst: "1";
}

/** Where the review array starts: an array whose first object begins with its id. */
const ARRAY_START = /\[\{"id":"/g;

/** The JSON value that opens at `start`, cut out by matching brackets outside strings; null when it never closes. */
function balanced(src: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'" };

/** Senja stores the text with HTML entities ("RFI -&gt; Analyst Review"); React escapes on render, so decode once. */
function decode(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m] ?? m);
}

/** Senja's dates ("2026-10-23 21:00:32.914+00") as milliseconds; JavaScript wants the T and a full "+00:00". */
function timeOf(date: string): number {
  return Date.parse(date.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
}

function asReview(raw: unknown): SiteReview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rating = r.rating;
  const text = typeof r.text === "string" ? decode(r.text).trim() : "";
  const customer = (r.customer ?? {}) as Record<string, unknown>;
  const date = typeof r.date === "string" ? r.date : "";
  if (typeof r.id !== "string" || typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null;
  }
  if (!text || Number.isNaN(timeOf(date))) return null;
  const name = typeof customer.name === "string" && customer.name.trim() ? customer.name.trim() : "A reviewer";
  return { id: r.id, rating, text, name, date };
}

/**
 * Every review in a Senja widget script, or null when the script holds no review array (a changed format reads as
 * "unreadable", never as "no reviews").
 */
export function parseSenjaWidget(js: string): SiteReview[] | null {
  for (const m of js.matchAll(ARRAY_START)) {
    const slice = balanced(js, m.index ?? 0);
    if (!slice) continue;
    let arr: unknown;
    try {
      arr = JSON.parse(slice);
    } catch {
      continue;
    }
    if (!Array.isArray(arr) || !arr.some((x) => x && typeof x === "object" && "rating" in x)) continue;
    return arr.map(asReview).filter((r): r is SiteReview => r !== null);
  }
  return null;
}

/** The reviews the site counts and shows: outside reviews only, newest first. */
export function outsideReviews(all: SiteReview[]): SiteReview[] {
  return all
    .filter((r) => !INSIDER_REVIEW_IDS.has(r.id))
    .sort((a, b) => timeOf(b.date) - timeOf(a.date));
}

/** The rating of a set of reviews, to one decimal place, as schema.org wants it (strings). */
export function ratingOf(reviews: SiteReview[]): ReviewRating {
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  const value = reviews.length ? (Math.round((sum / reviews.length) * 10) / 10).toFixed(1) : "0.0";
  return { value, count: String(reviews.length), best: "5", worst: "1" };
}
