/**
 * What a review from the site's own form must be before it's stored (convex/siteReviews.ts). Pure, so the HTTP
 * route and its tests share one rule. Cheap checks first; every length is capped before a pattern runs, since an
 * unbounded string into a backtracking pattern is a compute-exhaustion primitive. Text is stored in NFC; the link
 * check also runs on an NFKC copy, so full-width "ｈｔｔｐ" and the like are caught (OWASP Input Validation).
 */

export const REVIEW_TEXT_MAX = 2000;
export const REVIEW_NAME_MAX = 80;
/** The most a review request's body may hold, in characters: the longest review and name with room to spare. */
export const REVIEW_BODY_MAX = 16_000;
const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * A link or an address in a review or a name: a scheme, "www.", an email address, or a name ending in a common
 * top-level domain ("followersnow.com"). Reviews are words about the site, and a link is how review spam pays.
 * The domain list is deliberately short: "e.g.", "U.S.", "St.Louis" and "2.0" must stay ordinary writing.
 */
const LINK_RE =
  /\b(?:https?|ftp):\/\/|\bwww\.|[^\s@]+@[^\s@]+\.[a-z]{2,}|\b[a-z0-9-]+\.(?:com|net|org|io|app|co|ly|me|info|biz|xyz|ru|cn|top|site|online|link|click|shop|store|live|gg|tv|us|uk|in)\b/i;

/**
 * Characters that never belong in a review: control characters (tab and new line kept), the byte-order mark, and
 * the direction embeddings, overrides and isolates (U+202A-202E, U+2066-2069) that can make text read differently
 * than it's stored. Zero-width joiners and non-joiners (U+200C, U+200D) and the direction marks stay: Indic and
 * Persian writing needs them (Unicode, chapter 23).
 */
const STRIP = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** A person can't pick stars and send in under this; a script posts at once. A faster send is flagged, not lost. */
export const MIN_FILL_MS = 1500;

export interface ReviewInput {
  rating: number;
  /** Optional: a rating can stand alone. Empty when none was written. */
  text: string;
  name: string;
  email?: string;
}

export type ReviewField = "rating" | "text" | "name" | "email";
export type ReviewCheck = { ok: true; review: ReviewInput } | { ok: false; field: ReviewField; message: string };

/** The hidden field filled: only a script does that. The route answers as if it worked and stores nothing. */
export function isHoneypot(body: Record<string, unknown>): boolean {
  return typeof body.website === "string" && body.website.trim() !== "";
}

/**
 * Sent sooner after the form appeared than a person likely could, or with no timing at all (a script posting to
 * the route directly). Kept, and marked for the owner, because a fast real person must never lose a review.
 */
export function isQuick(body: Record<string, unknown>): boolean {
  const elapsed = body.elapsed;
  return typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS;
}

function tidyText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(STRIP, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const hasLink = (s: string) => LINK_RE.test(s) || LINK_RE.test(s.normalize("NFKC"));

export function checkReview(body: Record<string, unknown>): ReviewCheck {
  const { rating, text, name, email } = body;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, field: "rating", message: "Tap a star to rate PERM Tracker." };
  }
  if (text !== undefined && text !== null && typeof text !== "string") {
    return { ok: false, field: "text", message: "That review couldn't be read. Please try again." };
  }
  if (typeof name !== "string") return { ok: false, field: "name", message: "Add a name to show with your review." };
  if ((typeof text === "string" && text.length > REVIEW_TEXT_MAX * 2) || name.length > REVIEW_NAME_MAX * 4) {
    return typeof text === "string" && text.length > REVIEW_TEXT_MAX * 2
      ? { ok: false, field: "text", message: `Keep the review under ${REVIEW_TEXT_MAX.toLocaleString("en-US")} characters.` }
      : { ok: false, field: "name", message: `Keep the name under ${REVIEW_NAME_MAX} characters.` };
  }
  const cleanText = tidyText(text ?? "");
  const cleanName = name.normalize("NFC").replace(STRIP, "").trim().replace(/\s+/g, " ");
  if (cleanText.length > REVIEW_TEXT_MAX) {
    return { ok: false, field: "text", message: `Keep the review under ${REVIEW_TEXT_MAX.toLocaleString("en-US")} characters.` };
  }
  if (cleanName.length === 0) {
    return { ok: false, field: "name", message: "Add a name to show with your review. A first name is fine." };
  }
  if (cleanName.length > REVIEW_NAME_MAX) {
    return { ok: false, field: "name", message: `Keep the name under ${REVIEW_NAME_MAX} characters.` };
  }
  if (hasLink(cleanText)) {
    return { ok: false, field: "text", message: "Reviews can't include links, web addresses or email addresses. Please take them out." };
  }
  if (hasLink(cleanName)) {
    return { ok: false, field: "name", message: "A name can't include a link, web address or email address." };
  }
  let cleanEmail: string | undefined;
  if (email !== undefined && email !== null && email !== "") {
    if (typeof email !== "string") return { ok: false, field: "email", message: "That email address doesn't look right." };
    const e = email.trim().toLowerCase();
    if (e.length > EMAIL_MAX || !EMAIL_RE.test(e)) return { ok: false, field: "email", message: "That email address doesn't look right." };
    cleanEmail = e;
  }
  return { ok: true, review: { rating, text: cleanText, name: cleanName, ...(cleanEmail ? { email: cleanEmail } : {}) } };
}

/** The longest private note a reviewer can add after a low rating (siteReviews.addNote). */
export const NOTE_MAX = 2000;

/**
 * A private note on how PERM Tracker could do better, added after a rating of 3 or less. Only the owner reads it,
 * as plain text, so a link in it does no harm and isn't refused; it's tidied like a review.
 */
export function checkNote(note: unknown): { ok: true; note: string } | { ok: false; message: string } {
  if (typeof note !== "string") return { ok: false, message: "That note couldn't be read. Please try again." };
  if (note.length > NOTE_MAX * 2) return { ok: false, message: `Keep the note under ${NOTE_MAX.toLocaleString("en-US")} characters.` };
  const clean = tidyText(note);
  if (clean.length === 0) return { ok: false, message: "Write a few words first." };
  if (clean.length > NOTE_MAX) return { ok: false, message: `Keep the note under ${NOTE_MAX.toLocaleString("en-US")} characters.` };
  return { ok: true, note: clean };
}
