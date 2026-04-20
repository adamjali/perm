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

export type FieldState = "pristine" | "valid" | "invalid";

export interface FieldValidation {
  state: FieldState;
  /** Human-readable message shown inline when state === "invalid". */
  message?: string;
  /** Machine-readable code reported to analytics. Never contains user input. */
  reason?: string;
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
    return { state: "invalid", message: result.message, reason: result.reason };
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
  if (value !== password) {
    return { state: "invalid", message: "Passwords don't match", reason: "MISMATCH" };
  }
  return { state: "valid" };
}
