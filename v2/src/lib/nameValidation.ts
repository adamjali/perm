/**
 * Client-side mirror of server-side name validation.
 *
 * Rules are identical to `convex/lib/nameValidation.ts` — this exists only so
 * the signup form can provide inline feedback before the user submits. Server
 * remains the authoritative check (Convex Auth `profile()` callback).
 *
 * @module src/lib/nameValidation
 */

const URL_PATTERN =
  /https?:\/\/|www\.|\bbit\.ly\b|\btinyurl\b|\bt\.co\b|\bgoo\.gl\b|\btiny\.cc\b|\bshorturl\b|\bowl\.ly\b|\b[a-z0-9][a-z0-9-]{0,62}\.(com|net|org|io|co|ly|me|tk|ml|ga|cf|xyz|info|app|dev|ai|site|online|tech|store|shop|click|link|cc|pro|us|uk|de|fr|jp|cn|ru|br|mx|tv|fm|ca|es|it|nl|au|in|sh|ws|biz|mobi|name|run|page|blog|live|sale|top)\b/i;

const EMOJI_PATTERN =
  /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]{2}/u;

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;

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

export function checkUserName(rawName: string | undefined | null): NameCheckResult {
  if (!rawName) return { valid: true };
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

export { MAX_NAME_LENGTH };
