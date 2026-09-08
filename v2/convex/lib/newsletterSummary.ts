/**
 * The digest's flags and its admin summary, as plain helpers.
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

/** The flag. Read at call time so flipping it needs no deploy. */
export function newsletterSendingEnabled(): boolean {
  return process.env.NEWSLETTER_ENABLED === "1";
}

export function newsletterDailyCap(): number {
  const n = Number(process.env.NEWSLETTER_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

/** List size and the latest issue, for the admin panel. */
export async function summarizeNewsletter(ctx: QueryCtx): Promise<NewsletterAdminSummary> {
  const subs = await ctx.db.query("newsletterSubscribers").take(2000);
  const confirmed = subs.filter((s) => s.confirmedAt !== undefined && s.unsubscribedAt === undefined).length;
  const latest = await ctx.db.query("newsletterIssues").withIndex("by_weekOf").order("desc").first();
  return {
    enabled: newsletterSendingEnabled(),
    dailyCap: newsletterDailyCap(),
    staged: subs.length,
    confirmed,
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
