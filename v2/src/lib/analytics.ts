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
 * Idempotent — safe to call multiple times.
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
 * anonymous session being attributed to the previous user.
 */
function reset(): void {
  try {
    posthog.reset();
  } catch (error) {
    console.warn("[Analytics] Failed to reset:", error);
  }
}

export const analytics = { capture, identify, reset };
