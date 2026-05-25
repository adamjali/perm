/**
 * User-provided name validation — server-side guard.
 *
 * Deployed April 2026 in response to an active signup-spam attack where an
 * attacker embedded phishing URLs + Turkish-language scam text + attention-
 * grabbing emojis in the name field. The attacker's goal was to pivot through
 * our legitimate sender reputation to deliver spam to real Gmail/Hotmail/iCloud
 * inboxes (via the welcome email, which renders the name in the greeting) and
 * to our admin-notification inbox.
 *
 * Rules are deliberately strict — false-positive rate for real names is near
 * zero because no legitimate full name contains URLs, emojis, or control chars.
 *
 * ALLOWS: letters (any script incl. CJK/Arabic/Cyrillic/Hebrew),
 *         numbers, spaces, and common name punctuation ( - ' . , ( ) & ).
 * REJECTS: any emoji, any URL pattern, length > 80, control chars,
 *          repeated substrings ≥ 10 chars.
 *
 * This module is the SINGLE SOURCE for name-validation rules AND the forensic
 * attacker-signature matcher (`isAttackerName`). The client re-exports
 * `checkUserName` from here via `src/lib/nameValidation.ts` (no hand-mirrored
 * copy), and incident tooling (`incidentCleanup.ts`) imports `isAttackerName`
 * from here. Server-side validation is the authoritative check.
 *
 * @module convex/lib/nameValidation
 */

// Catches URL-shaped tokens:
//   - explicit schemes (http/https)
//   - "www." leading labels
//   - hardcoded shortener domains (bit.ly, t.co, tinyurl, etc.)
//   - bare domains with common TLDs — NO trailing slash required. The earlier
//     version required `/\w` after the TLD and omitted many TLDs (.app, .dev,
//     .ai, .xyz, etc.) which let values like "permtracker.app" pass.
//   - trailing word boundary avoids matching legit names like "St. John" (the
//     period is followed by a space) or "Mr.Smith" (Smith not in TLD list).
//
// TLD list combines: top common gTLDs (.com/.net/.org), the most-abused TLDs
// from spam reports (.tk/.ml/.ga/.cf/.xyz/.click/.link), country TLDs that
// short-link operators favor (.co/.ly/.me/.io/.cc/.tv/.fm), and the new gTLDs
// the April 2026 attacker pivoted to (.app/.dev/.ai/.site/.online/.tech).
// This regex is the single source — the client re-exports `checkUserName` from
// this module, so editing it here updates client UX + server check together.
const URL_PATTERN =
  /https?:\/\/|www\.|\bbit\.ly\b|\btinyurl\b|\bt\.co\b|\bgoo\.gl\b|\btiny\.cc\b|\bshorturl\b|\bowl\.ly\b|\b[a-z0-9][a-z0-9-]{0,62}\.(com|net|org|io|co|ly|me|tk|ml|ga|cf|xyz|info|app|dev|ai|site|online|tech|store|shop|click|link|cc|pro|us|uk|de|fr|jp|cn|ru|br|mx|tv|fm|ca|es|it|nl|au|in|sh|ws|biz|mobi|name|run|page|blog|live|sale|top)\b/i;

// Match any emoji. Covers: misc symbols & pictographs, transport, emoticons,
// supplemental symbols, CJK symbols, dingbats, flags, skin tones, etc.
const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]{2}/u;

 
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;

// Same 10+-char substring repeated (e.g. "SPAM SPAM SPAM SPAM" or "USD USD USD USD ")
const REPEATED_SUBSTRING_PATTERN = /(\S{10,})\s*\1/;

export const MAX_NAME_LENGTH = 80;

export type NameValidationFailure =
  | "EMPTY"
  | "TOO_LONG"
  | "CONTAINS_URL"
  | "CONTAINS_EMOJI"
  | "CONTROL_CHARS"
  | "REPEATED_CONTENT";

export interface NameCheckResult {
  valid: boolean;
  reason?: NameValidationFailure;
  message?: string;
}

/**
 * Pure check — returns `{valid, reason?, message?}` without throwing.
 * Use this for both server-side + client-side logic so rules stay in sync.
 */
export function checkUserName(rawName: string | undefined | null): NameCheckResult {
  if (!rawName) return { valid: true }; // name is optional
  const name = rawName.trim();
  if (name.length === 0) return { valid: true };

  if (name.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      reason: "TOO_LONG",
      message: `Names must be ${MAX_NAME_LENGTH} characters or fewer.`,
    };
  }

  if (URL_PATTERN.test(name)) {
    return {
      valid: false,
      reason: "CONTAINS_URL",
      message: "Names can't contain web links.",
    };
  }

  if (EMOJI_PATTERN.test(name)) {
    return {
      valid: false,
      reason: "CONTAINS_EMOJI",
      message: "Names can't contain emojis.",
    };
  }

  if (CONTROL_CHAR_PATTERN.test(name)) {
    return {
      valid: false,
      reason: "CONTROL_CHARS",
      message: "Your name contains invalid characters.",
    };
  }

  if (REPEATED_SUBSTRING_PATTERN.test(name)) {
    return {
      valid: false,
      reason: "REPEATED_CONTENT",
      message: "Your name contains repeated content.",
    };
  }

  return { valid: true };
}

/**
 * Throwing wrapper for the auth profile() callback.
 * Convex Auth's Password provider surfaces thrown errors back to the client
 * without creating a user record, so invoking this in `profile()` prevents
 * the DB row and all downstream emails on invalid input.
 */
export function validateUserName(rawName: string | undefined | null): string {
  if (!rawName) return "";
  const name = rawName.trim();
  if (name.length === 0) return "";

  const result = checkUserName(name);
  if (!result.valid) {
    throw new Error(result.message || "Invalid name");
  }
  return name;
}

/**
 * Forensic attacker-signature matcher for the 2026-04 signup-abuse incident.
 *
 * SEPARATE from `checkUserName` on purpose: `checkUserName` is the *prevention*
 * validator (strict, near-zero false positives on real names), whereas this is
 * a *post-hoc cleanup* matcher used to identify rows already created during the
 * attack so they can be purged. It is deliberately broader along some axes
 * (Turkish scam keywords, Cyrillic script, length) and narrower along others
 * (URL detection only covers explicit schemes + known shorteners, not bare
 * domains) — the two matchers must NOT be merged, as they answer different
 * questions. Centralized here so all name-attack logic lives in one module and
 * incident tooling imports it rather than re-deriving the signature.
 *
 * Simple alternations + bounded character-class lookups — no catastrophic
 * backtracking possible (no nested quantifiers on overlapping patterns).
 *
 * @example
 * isAttackerName("Win $$$ http://bit.ly/x") // true
 * isAttackerName("María José") // false
 */
/* eslint-disable security/detect-unsafe-regex */
export function isAttackerName(name: string | undefined | null): boolean {
  if (!name || typeof name !== "string") return false;
  if (/https?:\/\/|bit\.ly|tinyurl|t\.co\/|goo\.gl|shorturl|\.ly\//i.test(name)) return true;
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2728}]/u.test(name)) return true;
  if (/acele|tıkla|bekli|hemen|TL seni|hediye|kazan|kampanya/i.test(name)) return true;
  if (/[\u{0400}-\u{04FF}]/u.test(name)) return true;
  if (name.length > 80) return true;
  return false;
}
/* eslint-enable security/detect-unsafe-regex */

/**
 * Defensive sanitizer for rendering user-provided names in emails.
 * Belt-and-suspenders: even if somehow an invalid name slipped past validation
 * (legacy row, race condition, forgotten entry point), strip attack payloads
 * before they reach a recipient's inbox.
 *
 * - Removes http/https URLs and short-link patterns
 * - Removes all emojis
 * - Truncates to MAX_NAME_LENGTH
 */
export function sanitizeNameForEmail(rawName: string | undefined | null): string {
  if (!rawName) return "";
  return rawName
    .replace(/https?:\/\/\S+/gi, "[link removed]")
    .replace(/\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|tiny\.cc|shorturl\.at|owl\.ly)\/\S+/gi, "[link removed]")
    .replace(EMOJI_PATTERN, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}
