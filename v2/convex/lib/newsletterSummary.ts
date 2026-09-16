/**
 * The digest's flags, its health line and its admin summary, as plain helpers.
 *
 * `adminSignals.getSignals` reads the summary through this module rather
 * than through `ctx.runQuery(internal.newsletter.adminSummary)`: a query that
 * calls another function through `internal` takes a type dependency on the
 * generated API, which depends on the query itself, and TypeScript resolves
 * that cycle by typing the query `any`. A plain function has no such edge.
 */
import type { Infer } from "convex/values";

import type { QueryCtx } from "../_generated/server";
import type { adminSummaryValidator } from "./newsletterValidators";

export type NewsletterAdminSummary = Infer<typeof adminSummaryValidator>;
export type NewsletterHealth = NewsletterAdminSummary["health"];

/** The flag. Read at call time so flipping it needs no deploy. */
export function newsletterSendingEnabled(): boolean {
  return process.env.NEWSLETTER_ENABLED === "1";
}

export function newsletterDailyCap(): number {
  const n = Number(process.env.NEWSLETTER_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Tuesday build is weekly, so an issue older than this means the cron stopped. */
export const STALE_AFTER_DAYS = 8;

/**
 * One line the admin panel can read at a glance.
 *
 * Off is not a warning: with the flag off, a stale preview is the designed
 * state, and a red light for it would be the alarm nobody acts on. With the
 * flag on, an issue older than the weekly cadence (or no issue at all) is the
 * cron having stopped, and that IS actionable.
 */
export function newsletterHealth(args: {
  enabled: boolean;
  latestBuiltAt: number | null;
  previewCount: number;
  now: number;
}): NewsletterHealth {
  if (!args.enabled) {
    return {
      level: "off",
      message: `flag off, ${args.previewCount} preview ${args.previewCount === 1 ? "issue" : "issues"}`,
    };
  }
  if (args.latestBuiltAt === null) {
    return { level: "warn", message: "flag on and no issue has ever been built" };
  }
  const ageDays = Math.floor((args.now - args.latestBuiltAt) / DAY_MS);
  if (args.now - args.latestBuiltAt > STALE_AFTER_DAYS * DAY_MS) {
    return { level: "warn", message: `flag on, newest issue built ${ageDays} days ago; the Tuesday build has stopped` };
  }
  return { level: "ok", message: `flag on, newest issue built ${ageDays} ${ageDays === 1 ? "day" : "days"} ago` };
}

/** List size, the latest issue and the health line, for the admin panel. */
export async function summarizeNewsletter(ctx: QueryCtx): Promise<NewsletterAdminSummary> {
  const subs = await ctx.db.query("newsletterSubscribers").take(2000);
  const confirmed = subs.filter((s) => s.confirmedAt !== undefined && s.unsubscribedAt === undefined).length;
  const latest = await ctx.db.query("newsletterIssues").withIndex("by_weekOf").order("desc").first();
  // Bounded: the digest is weekly, so 500 issues is roughly a decade.
  const issues = await ctx.db.query("newsletterIssues").take(500);
  const previewCount = issues.filter((i) => i.status === "preview").length;
  return {
    enabled: newsletterSendingEnabled(),
    dailyCap: newsletterDailyCap(),
    staged: subs.length,
    confirmed,
    health: newsletterHealth({
      enabled: newsletterSendingEnabled(),
      latestBuiltAt: latest?.builtAt ?? null,
      previewCount,
      now: Date.now(),
    }),
    latest: latest
      ? {
          weekOf: latest.weekOf,
          subject: latest.subject,
          status: latest.status,
          sentCount: latest.sentCount,
          builtAt: latest.builtAt,
          text: latest.text,
        }
      : null,
  };
}
