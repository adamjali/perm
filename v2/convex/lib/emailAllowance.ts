/**
 * How much email the site may send, and the one switch that puts every saving
 * back the day there's more of it.
 *
 * Resend's free plan allows 100 emails a day. Everything below holds mail back
 * to stay inside it. The owner's call (Oct 12 2026): "if we ever pay for
 * unlimited (or just enough) emails these should all go back to the most
 * helpful". So they all read this module, and setting EMAIL_DAILY_LIMIT on the
 * Convex deployment to the paid plan's daily figure (above 100) turns them all
 * back at once. It's read on every call, so no deploy is needed; unset, or 100
 * and below, keeps the free plan's behavior.
 *
 * What the switch changes (free -> paid):
 * - The weekly case summary goes only in a week something changed (a case was
 *   updated, or a deadline passed) -> every week to everyone with an active
 *   case, quiet weeks included ("your cases are on track").
 * - The weekly visa bulletin newsletter skips a week with nothing new -> goes
 *   every week; its daily send cap (NEWSLETTER_DAILY_CAP) is lifted.
 * - The day's ceilings (100 in all, list mail 85, mail anyone can set off 55;
 *   convex/lib/emailLimits.ts) -> the same shares of the new daily figure.
 * - Every per-kind daily pool (convex/lib/alertBudgets.ts: confirmations,
 *   alerts, sign-in codes and the rest) -> scaled by the same factor.
 * - The alerts one sweep may send (case and employer alerts 18, queue alerts
 *   40, bulletin alerts 12; the rest go next run) -> scaled by the same factor.
 *
 * Kept on purpose either way, because they're about what helps people rather
 * than what costs: one alert email per person per day, with a status change
 * always sent at once (convex/lib/alertDelivery.ts); deadline reminders
 * gathered into one email a day; no email for a progress-only or job
 * description change; at most 10 emails from one bulk stage change; the
 * weekly summary paused after 74 days of no sign-in (convex/reengagement.ts,
 * which protects the sender's reputation); no mail for the onboarding sample
 * case or the site's own test accounts; quiet hours.
 *
 * The owner's own mail never spends this allowance: it goes through the free
 * Cloudflare Worker (convex/lib/ownerMail.ts), Resend only as the fallback.
 */

/** Resend's free plan: emails a day, sent and received together. */
export const FREE_DAILY_LIMIT = 100;

/** The daily email allowance in force: EMAIL_DAILY_LIMIT when it's above the free plan's 100. */
export function emailDailyLimit(): number {
  const n = Number(process.env.EMAIL_DAILY_LIMIT);
  return Number.isFinite(n) && n > FREE_DAILY_LIMIT ? Math.floor(n) : FREE_DAILY_LIMIT;
}

/** True while the allowance is the free plan's, so every saving above holds. */
export function savingEmail(): boolean {
  return emailDailyLimit() <= FREE_DAILY_LIMIT;
}

/** How many times the free plan's allowance is in force (1 on the free plan). */
export function emailScale(): number {
  return emailDailyLimit() / FREE_DAILY_LIMIT;
}

/** A count sized for the free plan, grown with the allowance. */
export function scaled(freePlanCount: number): number {
  return Math.max(freePlanCount, Math.round(freePlanCount * emailScale()));
}
