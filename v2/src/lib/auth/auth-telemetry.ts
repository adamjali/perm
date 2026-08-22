/**
 * Auth-flow telemetry helpers.
 *
 * Consolidates PostHog + Sentry instrumentation for signup, login, and
 * password-reset. Two principles:
 *
 * 1. Field/validation events → PostHog only, never Sentry. Those are user
 *    behavior signals, not application bugs. Sending them to Sentry would
 *    be noise that obscures real errors.
 * 2. Service-level failures (network, 5xx from Cloudflare siteverify,
 *    unexpected Convex Auth errors) → Sentry (via captureError) + breadcrumb.
 *
 * Payloads never contain user input (email, name, password), only
 * structural reasons ("INVALID_FORMAT", "TOO_SHORT", etc.).
 */

import { analytics } from "@/lib/analytics";
import { captureError, addBreadcrumb } from "@/lib/sentry";

export type AuthSurface = "signup" | "login" | "reset_password";

export type TurnstileFailReason =
  | "missing_token"
  | "expired"
  | "siteverify_rejected"
  | "service_error";

/** Track a failed Turnstile verification (PostHog only). */
export function trackTurnstileFail(surface: AuthSurface, reason: TurnstileFailReason): void {
  analytics.capture("turnstile_verify_failed", { surface, reason });
}

/** Track a field validation failure on signup (PostHog only). */
export function trackSignupFieldInvalid(field: string, reason: string): void {
  analytics.capture("signup_field_invalid", { field, reason });
}

/** Track an attempted submit that was blocked client-side (PostHog only). */
export function trackSubmitBlocked(surface: AuthSurface, firstMissing: string): void {
  analytics.capture("auth_submit_blocked", { surface, first_missing: firstMissing });
}

/** Track a successful signup (PostHog). */
export function trackSignupSucceeded(method: "email_password" | "google"): void {
  analytics.capture("user_signed_up", { method });
}

/** Track a successful login (PostHog). */
export function trackLoginSucceeded(method: "email_password" | "google"): void {
  analytics.capture("login_succeeded", { method });
}

/** Track a failed login with a structural reason (PostHog). */
export function trackLoginFailed(reason: string): void {
  analytics.capture("login_failed", { reason });
}

/** Track a password-reset request initiated (PostHog). */
export function trackPasswordResetRequested(): void {
  analytics.capture("password_reset_requested");
}

/** Track a password-reset flow completion (PostHog). */
export function trackPasswordResetCompleted(): void {
  analytics.capture("password_reset_completed");
}

/**
 * Track an abuse-related event (rate limit trip, account suspension, blocklist
 * add, etc). PostHog only, NOT Sentry, to avoid alert fatigue from normal
 * user errors. Use for product-abuse-pattern observability.
 */
export function trackAbuseEvent(
  kind:
    | "rate_limit_429"
    | "account_suspended"
    | "ip_blocked"
    | "suspended_login_blocked",
  props?: Record<string, string | number>,
): void {
  analytics.capture("abuse_event", { kind, ...props });
}

/**
 * Add a breadcrumb in the "auth" category so Sentry events that DO get
 * reported have context on the full auth journey.
 */
export function authBreadcrumb(message: string, data?: Record<string, unknown>): void {
  addBreadcrumb({ category: "auth", message, ...(data && { data }) });
}

/**
 * Capture a real infrastructure-level failure in the Turnstile path
 * (network, 5xx, unreachable). User-facing errors like "token expired" or
 * "siteverify rejected" go through `trackTurnstileFail` instead.
 */
export function captureTurnstileServiceError(
  error: unknown,
  surface: AuthSurface,
): void {
  captureError(error, {
    operation: `verifyTurnstile:${surface}`,
    tags: { auth_surface: surface },
  });
}
