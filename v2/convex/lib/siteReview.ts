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
  const cleanText = text.trim();
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanText.length < REVIEW_TEXT_MIN || cleanText.length > REVIEW_TEXT_MAX) {
    return { ok: false, message: `The review needs ${REVIEW_TEXT_MIN} to ${REVIEW_TEXT_MAX.toLocaleString("en-US")} characters.` };
  }
  if (cleanName.length === 0 || cleanName.length > REVIEW_NAME_MAX) {
    return { ok: false, message: `Give a name up to ${REVIEW_NAME_MAX} characters. A first name or initials is fine.` };
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
