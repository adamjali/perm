import { analytics } from "@/lib/analytics";

/**
 * One event per alert form submit, so the funnel from a case lookup to an
 * email alert can be counted. The address never goes with it: only which
 * kind of alert, how it went, and (where the form knows it) which page asked.
 */
export type AlertSignupKind = "case" | "queue" | "bulletin" | "employer";
export type AlertSignupOutcome = "accepted" | "refused" | "error";

export function trackAlertSignup(
  kind: AlertSignupKind,
  outcome: AlertSignupOutcome,
  extra: Record<string, string | number | boolean | undefined> = {},
): void {
  analytics.capture("alert_signup", { kind, outcome, ...extra });
}
