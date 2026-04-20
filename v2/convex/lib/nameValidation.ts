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
 * Mirrored on the client in `src/lib/nameValidation.ts` for inline UX;
 * server-side validation is the authoritative check.
 *
 * @module convex/lib/nameValidation
 */

const URL_PATTERN =
  /https?:\/\/|www\.|\bbit\.ly\b|\btinyurl\b|\bt\.co\/|\bgoo\.gl\b|\btiny\.cc\b|\bshorturl\b|\bowl\.ly\b|\b[a-z0-9-]+\.(com|net|org|io|co|ly|me|tk|ml|ga|cf|xyz|info)\/\w/i;

// Match any emoji. Covers: misc symbols & pictographs, transport, emoticons,
// supplemental symbols, CJK symbols, dingbats, flags, skin tones, etc.
const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]{2}/u;

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;

// Same 10+-char substring repeated (e.g. "SPAM SPAM SPAM SPAM" or "USD USD USD USD ")
const REPEATED_SUBSTRING_PATTERN = /(\S{10,})\s*\1/;

const MAX_NAME_LENGTH = 80;

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
