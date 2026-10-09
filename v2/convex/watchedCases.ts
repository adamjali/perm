import { v } from "convex/values";

import { internalQuery } from "./_generated/server";
import { entitlement } from "./lib/apiPlans";

/**
 * Every case number someone is waiting to hear about, for the hourly check.
 *
 * WHY THIS EXISTS. The full sweep asks DOL about every case twice a day, so
 * without this a watched case could change status and the subscriber not hear
 * about it for up to twelve hours. Since Oct 7 2026 the server asks DOL about
 * these numbers every 5 minutes on weekdays from 7 AM to 9 PM Eastern, and
 * every 30 minutes otherwise (`permtracker-watched.timer`, running
 * `scripts/check_watched_cases.py --from-convex`). It reads this list through
 * `GET /watched-cases`, writes any change through the same Python writer the
 * daily sweeps use, and then asks for the alert sweeps through
 * `POST /watched-cases/sweep`. Both routes need `WATCHED_CASES_SECRET`.
 * Nothing about who is watching leaves Convex: the server receives case
 * numbers only, never an address or an endpoint. `watched-cases.yml` stays as
 * a hand-run fallback.
 *
 * Email alerts count once confirmed and until unsubscribed or closed; browser
 * push alerts until closed; webhook watches until removed. Numbers are uppercased and deduplicated, and the
 * list is capped so a flood of sign-ups cannot turn an hourly job into a
 * full sweep.
 */
export const WATCHED_CAP = 2_000;

export const watchedCaseNumbers = internalQuery({
  args: {},
  returns: v.object({
    caseNumbers: v.array(v.string()),
    capped: v.boolean(),
  }),
  handler: async (ctx) => {
    const out = new Set<string>();

    const email = ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_alert_sweep", (q) =>
        q.eq("unsubscribedAt", undefined).eq("caseClosedAt", undefined),
      );
    for await (const row of email) {
      if (row.confirmedAt === undefined) continue;
      out.add(row.caseNumber.trim().toUpperCase());
      if (out.size >= WATCHED_CAP) return { caseNumbers: [...out].sort(), capped: true };
    }

    const push = ctx.db
      .query("caseStatusPushAlerts")
      .withIndex("by_closed", (q) => q.eq("closedAt", undefined));
    for await (const row of push) {
      out.add(row.caseNumber.trim().toUpperCase());
      if (out.size >= WATCHED_CAP) return { caseNumbers: [...out].sort(), capped: true };
    }

    // Case numbers API accounts' webhooks watch (convex/webhooks.ts), so a
    // case.status_changed event reaches them as fast as an alert email does.
    // Only accounts whose plan, as it applies now, carries webhooks: once the
    // paywall is on, a Free account's watches cost no DOL request.
    const allowed = new Map<string, boolean>();
    const hooks = ctx.db.query("webhookWatches").withIndex("by_kind_and_checked", (q) => q.eq("kind", "case"));
    for await (const row of hooks) {
      let ok = allowed.get(row.account);
      if (ok === undefined) {
        const acct = await ctx.db
          .query("apiAccounts")
          .withIndex("by_account", (q) => q.eq("account", row.account))
          .unique();
        ok = entitlement(acct?.plan).plan.webhookWatches > 0;
        allowed.set(row.account, ok);
      }
      if (!ok) continue;
      out.add(row.target);
      if (out.size >= WATCHED_CAP) return { caseNumbers: [...out].sort(), capped: true };
    }

    return { caseNumbers: [...out].sort(), capped: false };
  },
});

/**
 * The shared secret on the two server routes, compared as SHA-256 digests so
 * neither its length nor a matching prefix shows in the timing. Unset means
 * the routes are off, never open.
 */
export async function watchedSecretOk(given: string | null): Promise<"ok" | "denied" | "off"> {
  const want = process.env.WATCHED_CASES_SECRET;
  if (!want) return "off";
  if (!given) return "denied";
  const digest = async (x: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x)));
  const [a, b] = await Promise.all([digest(given), digest(want)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0 ? "ok" : "denied";
}
