/**
 * Field-level validation helpers for auth forms.
 *
 * Pure functions — no side effects, no state. Each returns a FieldValidation
 * describing the current state for UI rendering + a `reason` code for
 * telemetry (so the field's error can be reported to PostHog without leaking
 * the field's contents).
 *
 * Name validation delegates to the shared `checkUserName` so client UX and
 * server-side rejection stay in sync.
 */

import { checkUserName } from "@/lib/nameValidation";
import type { NameValidationFailure } from "@/lib/nameValidation";

export type FieldState = "pristine" | "valid" | "invalid";

/**
 * Machine-readable reason code reported to analytics. Never contains user
 * input. Union of the field-level codes plus every `checkUserName` failure.
 */
export type FieldReason =
  | "EMPTY"
  | "INVALID_FORMAT"
  | "TOO_SHORT"
  | "MISMATCH"
  | NameValidationFailure;

/**
 * Discriminated union on `state` — `message`/`reason` exist iff the field is
 * `invalid`, so meaningless shapes (e.g. `{ state: "valid", reason }`) are
 * unrepresentable at compile time.
 */
export type FieldValidation =
  | { state: "pristine" }
  | { state: "valid" }
  | {
      state: "invalid";
      /** Human-readable message shown inline. */
      message: string;
      /** Machine-readable code reported to analytics. Never contains user input. */
      reason: FieldReason;
    };

/**
 * Inline error message for a field, or `undefined` when not invalid.
 *
 * Bridges the discriminated union to the `error?: string` prop on `AuthField`
 * without forcing every call site to narrow on `state` first.
 */
export function fieldMessage(v: FieldValidation): string | undefined {
  return v.state === "invalid" ? v.message : undefined;
}

// Permissive RFC-5322-compatible pattern. Good enough for UX feedback —
// the server is still authoritative.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email: required; must look like an email. */
export function validateEmailValue(value: string, touched: boolean): FieldValidation {
  const trimmed = value.trim();
  if (!trimmed) {
    return touched
      ? { state: "invalid", message: "Email is required", reason: "EMPTY" }
      : { state: "pristine" };
  }
  if (!EMAIL_RE.test(trimmed)) {
    return { state: "invalid", message: "Enter a valid email address", reason: "INVALID_FORMAT" };
  }
  return { state: "valid" };
}

/** Name: optional; when present, must pass the shared rules. */
export function validateNameValue(value: string, touched: boolean): FieldValidation {
  const trimmed = value.trim();
  if (!trimmed) return { state: touched ? "valid" : "pristine" };
  const result = checkUserName(trimmed);
  if (!result.valid) {
    return {
      state: "invalid",
      // `checkUserName` always sets both when `valid` is false; fall back
      // defensively to keep the discriminated union's required fields honest.
      message: result.message || "Your name contains invalid characters.",
      reason: result.reason || "INVALID_FORMAT",
    };
  }
  return { state: "valid" };
}

/** Password: required; ≥ 8 chars. */
export function validatePasswordValue(value: string, touched: boolean): FieldValidation {
  if (!value) {
    return touched
      ? { state: "invalid", message: "Password is required", reason: "EMPTY" }
      : { state: "pristine" };
  }
  if (value.length < 8) {
    return { state: "invalid", message: "Password must be at least 8 characters", reason: "TOO_SHORT" };
  }
  return { state: "valid" };
}

/** Confirm password: must match `password`. */
export function validateConfirmPassword(
  value: string,
  password: string,
  touched: boolean,
): FieldValidation {
  if (!value) {
    return touched
      ? { state: "invalid", message: "Confirm your password", reason: "EMPTY" }
      : { state: "pristine" };
  }
  // Not a timing-sensitive comparison — both strings are the user's own input
  // in the same form; no secret is being protected against an external caller.
  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (value !== password) {
    return { state: "invalid", message: "Passwords don't match", reason: "MISMATCH" };
  }
  return { state: "valid" };
}
