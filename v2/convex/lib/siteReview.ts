/**
 * What a review from the site's own form must be before it's stored (convex/siteReviews.ts). Pure, so the HTTP
 * route and its tests share one rule. Cheap checks first; every length is capped before the email pattern runs,
 * since an unbounded string into a backtracking pattern is a compute-exhaustion primitive.
 */

export const REVIEW_TEXT_MIN = 10;
export const REVIEW_TEXT_MAX = 2000;
export const REVIEW_NAME_MAX = 80;
const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * A link or an address in a review or a name: a scheme, "www.", an email address, or a name ending in a common
 * top-level domain ("followersnow.com"). Reviews are words about the site, and a link is how review spam pays.
 * The domain list is deliberately short: "e.g.", "U.S.", "St.Louis" and "2.0" must stay ordinary writing.
 */
const LINK_RE =
  /\b(?:https?|ftp):\/\/|\bwww\.|[^\s@]+@[^\s@]+\.[a-z]{2,}|\b[a-z0-9-]+\.(?:com|net|org|io|app|co|ly|me|info|biz|xyz|ru|cn|top|site|online|link|click|shop|store|live|gg|tv|us|uk|in)\b/i;

/** Characters a person never types on purpose: controls, zero-width marks and direction overrides. */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/** A person can't read the form and write ten characters in under this; a script posts at once. */
export const MIN_FILL_MS = 3000;

/**
 * A submission a script made: the hidden "website" field filled, or sent sooner after the form appeared than a
 * person could write a review (`elapsed`, measured by the form). The route answers it as if it worked and stores
 * nothing, so a bot learns nothing. A real form always sends `elapsed`.
 */
export function looksAutomated(body: Record<string, unknown>): boolean {
  if (typeof body.website === "string" && body.website.trim() !== "") return true;
  const elapsed = body.elapsed;
  return typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS;
}

export interface ReviewInput {
  rating: number;
  text: string;
  name: string;
  email?: string;
}

export type ReviewCheck = { ok: true; review: ReviewInput } | { ok: false; message: string };

export function checkReview(body: Record<string, unknown>): ReviewCheck {
  const { rating, text, name, email, consent } = body;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, message: "Pick from 1 to 5 stars." };
  }
  if (typeof text !== "string" || typeof name !== "string") {
    return { ok: false, message: "A review and a name are both needed." };
  }
  const cleanText = text.replace(INVISIBLE, "").replace(/[ \t]+/g, " ").trim();
  const cleanName = name.replace(INVISIBLE, "").trim().replace(/\s+/g, " ");
  if (cleanText.length < REVIEW_TEXT_MIN || cleanText.length > REVIEW_TEXT_MAX) {
    return { ok: false, message: `The review needs ${REVIEW_TEXT_MIN} to ${REVIEW_TEXT_MAX.toLocaleString("en-US")} characters.` };
  }
  if (cleanName.length === 0 || cleanName.length > REVIEW_NAME_MAX) {
    return { ok: false, message: `Give a name up to ${REVIEW_NAME_MAX} characters. A first name or initials is fine.` };
  }
  if (LINK_RE.test(cleanText) || LINK_RE.test(cleanName)) {
    return { ok: false, message: "Reviews can't include links, web addresses or email addresses. Please take them out." };
  }
  let cleanEmail: string | undefined;
  if (email !== undefined && email !== null && email !== "") {
    if (typeof email !== "string") return { ok: false, message: "That email address doesn't look right." };
    const e = email.trim().toLowerCase();
    if (e.length > EMAIL_MAX || !EMAIL_RE.test(e)) return { ok: false, message: "That email address doesn't look right." };
    cleanEmail = e;
  }
  if (consent !== true) {
    return { ok: false, message: "Tick the box to let us show your review." };
  }
  return { ok: true, review: { rating, text: cleanText, name: cleanName, ...(cleanEmail ? { email: cleanEmail } : {}) } };
}
