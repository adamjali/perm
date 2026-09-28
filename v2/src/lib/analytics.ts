/**
 * Client-Side Analytics Wrapper
 *
 * Thin wrapper over posthog-js that:
 * - Centralizes event capture (single import for all components)
 * - Prevents analytics failures from breaking user flows (try/catch)
 * - Provides a guard for sign-out suppression (matches @/lib/toast pattern)
 * - Makes it trivial to add consent checks or environment guards later
 *
 * Usage:
 *   import { analytics } from "@/lib/analytics";
 *   analytics.capture("case_created", { case_id: id });
 */

import posthog from "posthog-js";

/**
 * COOKIE-FREE UNLESS SIGNED IN (Sep 27 2026).
 *
 * PostHog starts with `cookieless_mode: "on_reject"` and
 * `opt_out_capturing_by_default: true` (src/instrumentation-client.ts), so a
 * visitor who isn't signed in is counted with PostHog's server-side hash of
 * (project, daily salt, IP, user agent, host) and nothing is stored in the
 * browser. The salt changes daily and PostHog deletes it once that day is
 * processed, so today's visit can't be tied to tomorrow's. A signed-in account
 * is switched to normal persistence by `consentForAccount()`, which is what
 * lets its events be linked to the account.
 *
 * In "on_reject" mode `opt_out_capturing()` does NOT stop capture; it only
 * falls back to cookie-free counting. The two cases that must send nothing at
 * all, Global Privacy Control and staff accounts in POSTHOG_EXCLUDED_EMAILS,
 * are dropped in before_send instead (isGpcEnabled, isAnalyticsOff).
 */

/**
 * localStorage key that turns PostHog off completely on this browser. Set only
 * by `optOut()`, which runs only for a signed-in staff account, so a visitor
 * who never signs in never gets it.
 */
export const ANALYTICS_OFF_KEY = "pt_analytics_off";

/** Fired on window once a signed-in account has switched to persistence. */
export const ANALYTICS_CONSENT_EVENT = "pt:analytics-consent";

/** True when this browser has been switched off (a staff account). */
export function isAnalyticsOff(): boolean {
  try {
    return window.localStorage.getItem(ANALYTICS_OFF_KEY) === "1";
  } catch {
    return false;
  }
}

/** True when the browser sends a Global Privacy Control signal. */
export function isGpcEnabled(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}

/**
 * Safely capture a PostHog event. Never throws.
 */
function capture(
  event: string,
  properties?: Record<string, unknown>
): void {
  try {
    posthog.capture(event, properties);
  } catch (error) {
    console.warn(`[Analytics] Failed to capture "${event}":`, error);
  }
}

/**
 * Safely identify a user in PostHog. Never throws.
 * Idempotent, safe to call multiple times.
 */
function identify(
  distinctId: string,
  properties?: Record<string, unknown>
): void {
  try {
    posthog.identify(distinctId, properties);
  } catch (error) {
    console.warn("[Analytics] Failed to identify user:", error);
  }
}

/**
 * Reset PostHog identity on logout. Prevents events from a new
 * anonymous session being attributed to the previous user. PostHog's reset()
 * also clears the stored consent, so the browser goes back to cookie-free
 * counting until someone signs in again.
 */
function reset(): void {
  try {
    posthog.reset();
  } catch (error) {
    console.warn("[Analytics] Failed to reset:", error);
  }
}

/**
 * Move a signed-in account from cookie-free counting to normal persistence so
 * its events can be linked to the account. Skipped for GPC and for a switched-
 * off staff browser. opt_in_capturing() sends an "$opt_in" event and a
 * pageview, so it runs only while consent is still pending: once per account
 * per browser, not on every render.
 */
function consentForAccount(): void {
  try {
    if (isGpcEnabled() || isAnalyticsOff()) return;
    if (!posthog.has_opted_in_capturing()) posthog.opt_in_capturing();
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
  } catch {
    // PostHog not initialized — safe to ignore
  }
}

/**
 * Turn PostHog off completely on this browser (staff accounts). The flag is
 * what before_send checks; opt_out_capturing() alone would only fall back to
 * cookie-free counting in "on_reject" mode.
 */
function optOut(): void {
  try {
    window.localStorage.setItem(ANALYTICS_OFF_KEY, "1");
  } catch {
    // Storage blocked — before_send can't see the flag, nothing else to do
  }
  try {
    posthog.opt_out_capturing();
  } catch {
    // PostHog not initialized — safe to ignore
  }
}

/**
 * Reverse a previous optOut (an account that is no longer excluded). Leaves
 * consent pending; the next consentForAccount() switches persistence back on.
 */
function optIn(): void {
  try {
    window.localStorage.removeItem(ANALYTICS_OFF_KEY);
  } catch {
    // Storage blocked — safe to ignore
  }
}

/** True when this browser has been switched off by optOut(). */
function hasOptedOut(): boolean {
  return isAnalyticsOff();
}

export const analytics = {
  capture,
  identify,
  reset,
  consentForAccount,
  optOut,
  optIn,
  hasOptedOut,
};
