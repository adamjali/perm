/**
 * Per-case status alerts.
 *
 * `dolQueueAlerts` answers a COHORT question, "has DOL reached my filing
 * month", and fires once. This answers the question a waiting applicant
 * actually asks, "did anything happen to MINE", and it can answer it because
 * `perm_case_status` holds 412,865 cases including the 97,657 that are still
 * pending, which DOL's own disclosure files cannot express at all.
 *
 * ## Three programs, one machine
 *
 * DOL's batch status endpoint serves every FLAG program from one serial
 * counter, so the same subscription works for a PERM (`G-`, `A-`), the
 * prevailing wage request that precedes it (`P-`) and a labor condition
 * application (`I-200-`, `I-203-`). Each lives in its OWN table, because the
 * PERM tables feed the queue census, the review stages and the RFI funnel and
 * every one of those assumes a PERM status vocabulary.
 *
 * Nothing here duplicates a status vocabulary to cope with that. The program
 * comes from the case number (`src/lib/flagCaseNumber.ts`), the table comes
 * from the program, and whether a case is CLOSED comes from that table's own
 * `is_final` column, so a status word this file has never heard of still
 * retires the subscription correctly. What IS program-aware is the copy: the
 * noun in the subject line, the plain-English gloss (PERM-only, because those
 * sentences cite PERM regulations and one of them would be actively wrong on
 * an LCA), the RFI funnel (measured over PERM cases) and which status counts
 * as landing well.
 *
 * ## The change detector
 *
 * Two halves, and they do different jobs.
 *
 * `scripts/mirror_case_status.py` writes `perm_case_events` on every refresh by
 * comparing the incoming page against the rows it is about to overwrite. That
 * is the durable, public record of transitions, and it exists because
 * `INSERT OR REPLACE` destroys the previous status; without it "what did this
 * status resolve to" is unanswerable from our own data forever.
 *
 * `caseStatusAlerts.lastSeenStatus` is the PER-SUBSCRIBER detector, and it is
 * the one this module reads. The question here is not "has the case moved" but
 * "has it moved since THIS subscriber last heard from us", and only a stamp on
 * their own row can answer that. Someone who subscribes the day after a
 * transition must not be mailed about it.
 *
 * The comparison is an explicit inequality between two DEFINED values. A
 * truthiness check would fire on every row on every sweep, which is the exact
 * bug `confirmByToken` in the sibling module already shipped once.
 *
 * ## The first observation is silent, on purpose
 *
 * When a subscription has no `lastSeenStatus` (the case was not in the mirror
 * when they confirmed), the first sighting SETS the stamp and sends nothing.
 * Our first sight of a case cannot distinguish "it just arrived" from "it has
 * been in this status for eight months and we only started watching now", and
 * mailing the second as though it were the first is a false alarm. A false
 * alarm is how an alert product loses somebody permanently.
 *
 * ## Sending discipline
 *
 * Every send goes through `sendEmailWithRetry`, never `resend.emails.send()`.
 * The SDK returns `{ data: null, error }` for a 429, a 422 and a network
 * failure alike, so a bare try/catch has a catch block that is dead code for
 * every realistic failure, and the line after the send runs as though it
 * worked. Here that would stamp `lastSeenStatus` forward and destroy the alert
 * permanently, because the transition would then look like old news. The
 * blocklist is also enforced inside that helper and nowhere else.
 *
 * ## The budget, with its arithmetic
 *
 * Resend's account cap is 100/day and it is SHARED with password resets, OTP
 * codes, deadline digests and the queue alerts. Exhausting it has already
 * caused one real outage on this product.
 *
 *   queue-alert confirmations      18/day   (convex/queueAlerts.ts)
 *   case-alert confirmations       15/day   (below, ALL THREE programs)
 *   case alerts                    18/day   (below, ALL THREE programs)
 *   bulletin-alert confirmations    6/day   (convex/bulletinAlerts.ts)
 *   bulletin alerts                12/day   (convex/bulletinAlerts.ts)
 *   preference-center links         6/day   (convex/emailPrefs.ts)
 *   ---------------------------------------
 *   worst case from list mail      75/day, leaving 25 for mail people depend on.
 *
 * That 25/day is the entire remaining headroom for AUTH mail - password
 * resets and OTP codes - and it is the number to check before adding any
 * sending path, because those are the emails whose absence locks somebody out
 * of their own account. Every list-mail budget is enumerated here, so any new
 * sending path must claim a line in this table before it ships.
 *
 * Rebalanced 2026-08-28 when the bulletin alerts and the preference center
 * joined the pool. The arithmetic in this table drifted from the constants
 * afterwards (it read 10/day for case confirmations against a real 15, and
 * summed to 70) and was corrected 2026-08-29; the CONSTANTS are authoritative
 * and were not touched, because lowering one throttles real signups.
 *
 * The queue-alert SEND sweep is not in that column because it is driven by a
 * monthly DOL publication rather than a daily one, so it and the case alerts
 * cannot both be at their ceiling on an ordinary day. The bulletin sweep is
 * counted because a new bulletin can land on any day the case alerts are
 * also busy.
 *
 * Both of the budgets below are GLOBAL, keyed on the literal string "all". That
 * is the only kind of limit that cannot be rotated around: a per-address
 * cooldown does nothing against an attacker cycling fresh addresses, and a
 * per-IP limit does nothing against a proxy pool. Whatever anyone does,
 * confirmations stop at 15 and alerts stop at 18 in a rolling day.
 *
 * Adding the prevailing wage and LCA programs added NO sending path and
 * claimed no new line: all three share the two budgets above, so the worst
 * case is unchanged. A P- subscription and a G- subscription compete for the
 * same 18 alerts, which is the correct shape - the scarce thing is Resend's
 * shared 100/day, and it does not care which program an email is about.
 *
 * @module convex/caseAlerts
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ReactElement } from "react";
import { FROM_EMAIL, getResend, sendEmailWithRetry } from "./lib/email";
import { formatAsOf } from "../src/lib/dolFormat";
import {
  canonicalStatus,
  showsRfiFunnel,
  statusMeaning,
} from "../src/lib/caseStatusVocabulary";
import {
  freshnessDatasetFor,
  isProgramApproval,
  normaliseFlagCaseNumber,
  programNoun,
  programNounWithArticle,
  programOf,
  statusTableFor,
  type FlagProgram,
} from "../src/lib/flagCaseNumber";
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  type TokenPurpose,
} from "./lib/unsubscribeToken";
import {
  one,
  placeholders,
  query,
  type Row,
  type Statement,
} from "./lib/publicMirror";
import { recordError } from "./lib/errorRecording";
import {
  checkAndRecordRateLimit,
  checkRateLimit,
  recordRateLimitAttempt,
} from "./lib/rateLimit";
import { stageNewsFor } from "./lib/newsConsent";
import { createLogger } from "./lib/logging";

const log = createLogger("CaseAlerts");

/**
 * How many subscriptions one sweep READS from the mirror.
 *
 * Much larger than the send limit because reading is one bounded SQL query and
 * sending is a scarce shared resource. A sweep that read only as many rows as
 * it could mail would take a week to notice a change on the 200th subscriber.
 */
const CHECK_BATCH_LIMIT = 300;

/** How many alerts one sweep may send. See the budget arithmetic above. */
const ALERT_BATCH_LIMIT = 18;

/** Global ceiling on alerts, across every subscriber, per rolling day. */
const ALERT_GLOBAL_BUDGET = { limit: 18, windowMs: 24 * 60 * 60 * 1000 };

/** Global ceiling on confirmation emails, across every caller. */
const CONFIRMATION_GLOBAL_BUDGET = { limit: 15, windowMs: 24 * 60 * 60 * 1000 };

/** Minimum gap between confirmation emails to one address. */
const CONFIRMATION_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Minimum gap between ALERTS to one subscription.
 *
 * A status change is rare and each one matters, so this is a safety valve
 * against upstream churn rather than a throttle on real news: if the mirror
 * ever flaps a case between two statuses, six hours caps the damage at four
 * emails a day instead of one per sweep.
 */
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Per-caller ceiling on subscribe attempts. */
const SUBSCRIBE_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

/**
 * How many cases one address may watch.
 *
 * A product limit AND a read bound, and the second is why it is not merely
 * generous. Both the cooldown check in `subscribe` and `forEmail` read every
 * row for an address through `by_email`; without a ceiling those are unbounded
 * `.collect()`s that one attacker can grow without limit by subscribing a
 * single address to arbitrarily many case numbers. Twenty-five is far more than
 * a person waiting on their own case and their spouse's, and an attorney
 * tracking a book of cases belongs in the app, which has auth in front of it.
 */
const MAX_CASES_PER_ADDRESS = 25;

/** Shown when either limit trips. Says nothing about the address. */
const THROTTLED_REPLY =
  "We can't send confirmation emails right now. Please try again in a little while.";

/**
 * One reply for every outcome on an existing address.
 *
 * Saying "you're already subscribed to that case" would turn this into an
 * oracle for checking whether a given person is waiting on a given case.
 */
const NEUTRAL_REPLY = "Check your inbox to confirm.";

/** The public marketing site, for human-facing links in email copy. */
const SITE_URL = "https://permtracker.app";

/**
 * Conservative address check. Rejects the obvious, defers the rest to Resend.
 *
 * The length cap runs FIRST and the ordering is load-bearing. `[^\s@]` matches
 * `.`, so `[^\s@]+\.[^\s@]{2,}$` backtracks quadratically on a long failing
 * input: measured in V8, `"a@" + ".".repeat(80000) + "@"` took 8.2 seconds.
 * `v.string()` accepts about a megabyte, so testing before the length check
 * hands any anonymous caller seconds of server compute per request.
 */
function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * The Convex HTTP domain, which is where confirm and unsubscribe actually run.
 * A different host from the marketing site; conflating them produces 404s.
 */
function actionUrl(path: string, token: string): string {
  const base = process.env.CONVEX_SITE_URL;
  if (!base) throw new Error("CONVEX_SITE_URL is not configured");
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not configured");
  return secret;
}

/** Public link to one case on the lookup page. */
function casePageUrl(caseNumber: string): string {
  return `${SITE_URL}/perm-case-status?case=${encodeURIComponent(caseNumber)}`;
}

/**
 * The upstream's per-case check stamp, formatted, or null.
 *
 * `perm_case_status.last_checked_at` is an ISO-8601 STRING like
 * "2026-08-05T22:31:24", written straight from the upstream tracker's own
 * field. Two things follow and both have bitten someone already:
 *
 * 1. **It is THEIR check time, not ours.** We mirror a tracker that reads DOL.
 *    No email may say "we checked" or "we verified" on the strength of it.
 * 2. **Never compare it numerically.** SQLite sorts any string above any
 *    number, so `last_checked_at >= 1787000000` is TRUE for every non-null row
 *    and yields a clean-looking result that is entirely artefact. Compare as
 *    text, or do what this does and only ever format it.
 *
 * Returns null for a missing or unparseable stamp so the caller must render
 * something rather than silently omitting it. A missing check date dropped
 * from the copy reads as a fresh observation.
 */
function observedLabel(raw: string | number | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length < 10) return null;
  return formatAsOf(raw.slice(0, 10));
}

/** Thousands separators, so 94435 reads as 94,435 in a mono column. */
function count(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * The live status table holding one case number.
 *
 * Every read in this file goes through here rather than naming a table, so
 * there is one decision rather than eight, and a program added later cannot
 * be half-wired. The value is interpolated into SQL and is safe to be: it is
 * one of three literals from a closed map, never anything a caller typed.
 * See `src/lib/flagCaseNumber.ts`.
 */
function tableForCase(caseNumber: string): string {
  return statusTableFor(programOf(caseNumber));
}

/** Case numbers bucketed by the program table that holds them. */
function groupByProgram(caseNumbers: string[]): Map<FlagProgram, string[]> {
  const out = new Map<FlagProgram, string[]>();
  for (const caseNumber of caseNumbers) {
    const program = programOf(caseNumber);
    const held = out.get(program);
    if (held) held.push(caseNumber);
    else out.set(program, [caseNumber]);
  }
  return out;
}

/**
 * Read the `is_final` column as a boolean.
 *
 * `Number(x) === 1`, not a truthiness test and not `num()`. libSQL can hand
 * an integer column back as the STRING "0" or "1" depending on the driver
 * path, and both of the obvious readings are wrong on one of those:
 * `Boolean("0")` is TRUE, so every case would retire the moment it was seen,
 * and `num("1")` is 0, so no case would ever retire and a decided case would
 * be read forever. `Number` handles the string and the integer identically,
 * and `Number(null)` is 0 rather than NaN-with-a-surprise. The read layer on
 * the web side carries the same guard, for the same reason.
 */
function isFinalFlag(value: string | number | null | undefined): boolean {
  return Number(value) === 1;
}

// ============================================================================
// Subscribe
// ============================================================================

/**
 * Register interest in one case number.
 *
 * Internal, not public. Its only caller is the HTTP action in convex/http.ts,
 * which owns the CORS allowlist and the field narrowing. As a public mutation
 * this would be a second entry point that skips both, and CORS is browser-side
 * only, so the Convex API stays callable directly.
 */
export const subscribe = internalMutation({
  args: {
    email: v.string(),
    caseNumber: v.string(),
    source: v.optional(v.string()),
    /**
     * The product-news checkbox on the form. Staged here rather than by a
     * follow-up mutation from the HTTP layer, and passed on to the
     * confirmation so the email can say so. See convex/emailPrefs.ts.
     */
    news: v.optional(v.boolean()),
    /** Caller IP from the HTTP layer, or "unknown" when none is resolvable. */
    ip: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    message: v.string(),
    /** True only when a rate limit refused it, so the HTTP layer can answer
     *  429 for throttling and 400 for a malformed field. */
    throttled: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    // Shape checks first: they are free, and rejecting here costs an attacker a
    // request without costing us a rate-limit row.
    if (!isPlausibleEmail(email)) {
      return { ok: false, message: "That email address does not look right." };
    }
    // Shape-gated and classified in one step. The gate is the same
    // `normaliseCaseNumber` as before, so what may be stored as a key has not
    // widened; what is new is that the number now says which program's table
    // the sweep should read it out of.
    const parsed = normaliseFlagCaseNumber(args.caseNumber);
    if (!parsed) {
      return {
        ok: false,
        message:
          "That does not look like a DOL case number (G-, A-, P- or I-).",
      };
    }
    const caseNumber = parsed.caseNumber;

    // Per-caller limit. Skipped for "unknown" rather than bucketing every
    // unresolvable caller together, which would let one script lock out all of
    // them at once.
    const ip = args.ip?.trim();
    if (ip && ip !== "unknown") {
      const perIp = await checkAndRecordRateLimit(
        ctx,
        ip,
        "case_subscribe_ip",
        SUBSCRIBE_IP_LIMIT,
      );
      if (!perIp.allowed) {
        return { ok: false, message: THROTTLED_REPLY, throttled: true };
      }
    }

    const existing = await ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_email_case", (q) =>
        q.eq("email", email).eq("caseNumber", caseNumber),
      )
      .first();

    const now = Date.now();

    // The cooldown is per ADDRESS, not per (address, case): the thing it
    // protects is the recipient's inbox and the shared Resend quota, and both
    // are per address. Keyed per case, ten case numbers would buy ten
    // confirmation emails in the same minute to one person.
    // Bounded by MAX_CASES_PER_ADDRESS + 1: at the ceiling this sees every row
    // for the address, so the max below is exact rather than a sample, and one
    // extra row is what detects that the ceiling has been reached.
    const forThisAddress = await ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(MAX_CASES_PER_ADDRESS + 1);
    const lastSent = forThisAddress.reduce<number>(
      (acc, r) => Math.max(acc, r.lastConfirmationSentAt ?? 0),
      0,
    );
    if (lastSent > 0 && now - lastSent < CONFIRMATION_COOLDOWN_MS) {
      // Silently skip the send. Same reply either way, so the response can
      // never be used to probe whether an address is on the list.
      return { ok: true, message: NEUTRAL_REPLY };
    }

    // Only a NEW row can push past the ceiling; re-staging an existing one
    // cannot. Same neutral reply as every other outcome on an existing address,
    // so the response is never an oracle for what an address is watching.
    if (!existing && forThisAddress.length >= MAX_CASES_PER_ADDRESS) {
      log.warn("address at the case ceiling; refusing a new subscription", {
        held: forThisAddress.length,
      });
      return { ok: true, message: NEUTRAL_REPLY };
    }

    if (existing) {
      // This endpoint is unauthenticated, so the caller has proved nothing
      // except that they can type an address. The request is STAGED and applied
      // only when someone with access to the inbox clicks confirm; writing
      // straight through would let anyone who knows an address resurrect an
      // opt-out they are entitled to keep.
      await ctx.db.patch(existing._id, {
        pendingCaseNumber: caseNumber,
        lastConfirmationSentAt: now,
      });
    } else {
      await ctx.db.insert("caseStatusAlerts", {
        email,
        caseNumber,
        createdAt: now,
        source: args.source,
        lastConfirmationSentAt: now,
        // Staged too, so confirming is what makes the row live. Without this an
        // unconfirmed row would already carry its final caseNumber and a
        // replayed confirm token could activate it.
        pendingCaseNumber: caseNumber,
      });
    }

    // Charged here, not at the top, so requests absorbed by the cooldown (which
    // send nothing) do not consume the budget.
    const budget = await checkAndRecordRateLimit(
      ctx,
      "all",
      "case_subscribe_global",
      CONFIRMATION_GLOBAL_BUDGET,
    );
    if (!budget.allowed) {
      log.error("confirmation budget exhausted; refusing to send", {
        limit: CONFIRMATION_GLOBAL_BUDGET.limit,
      });
      return { ok: false, message: THROTTLED_REPLY, throttled: true };
    }

    // Stage the product-news opt-in in THIS transaction, next to the schedule
    // call, so the row and the email that names it are one write. Doing it
    // from the HTTP layer after this mutation returned raced the send action,
    // which is why the flag is threaded rather than looked up. Reached only on
    // the accepted path, so neither a cooldown-absorbed request nor one
    // refused at the per-address case ceiling (both send nothing) can stage
    // news nobody was told about.
    const includesNews = args.news === true;
    if (includesNews) {
      await stageNewsFor(ctx, email, args.source);
    }

    await ctx.scheduler.runAfter(0, internal.caseAlerts.sendConfirmation, {
      email,
      caseNumber,
      includesNews,
    });

    return { ok: true, message: NEUTRAL_REPLY };
  },
});

/**
 * Clear the cooldown stamp after a send that did not go out.
 *
 * `lastConfirmationSentAt` is written before the send because it has to be: it
 * is what stops a repeat request mailing the same address again. So it records
 * INTENT. Without this, a Resend outage leaves a real person looking at "check
 * your inbox", holding no email, and silently no-op'd for ten minutes.
 */
export const clearConfirmationCooldown = internalMutation({
  args: { email: v.string(), caseNumber: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_email_case", (q) =>
        q.eq("email", args.email).eq("caseNumber", args.caseNumber),
      )
      .first();
    if (row) await ctx.db.patch(row._id, { lastConfirmationSentAt: undefined });
    return null;
  },
});

/**
 * Render a template to HTML, or return undefined and send text only.
 *
 * The renderer and the templates are imported DYNAMICALLY and that is
 * load-bearing. Convex loads a whole module for any function in it, and this
 * file also holds `subscribe`, the mutation behind an unauthenticated HTTP
 * route. A static `@react-email/render` import makes every cold subscribe pay
 * for a React renderer it never uses.
 *
 * `render` is async and can throw. Inside the sweep a throw is caught by the
 * per-subscriber handler, which correctly does NOT stamp the row, so a template
 * fault would leave every subscriber permanently due and silently unmailed.
 * Degrading to the text part delivers the alert.
 */
async function renderOrTextOnly(
  ctx: Parameters<typeof recordError>[0],
  where: string,
  build: () => Promise<ReactElement>,
): Promise<string | undefined> {
  try {
    const { render } = await import("@react-email/render");
    return await render(await build());
  } catch (error) {
    log.error("email render failed, sending text only", { where });
    await recordError(ctx, "action", where, error);
    return undefined;
  }
}

/**
 * The mirror's own as-of date for ONE program's corpus, formatted, or null.
 *
 * Per program, because each ingest stamps its own `data_freshness` row and
 * they refresh on different schedules. Dating a prevailing wage alert with
 * the PERM sweep's timestamp would be a false provenance on the one line
 * whose entire job is provenance.
 */
async function mirrorAsOf(program: FlagProgram): Promise<string | null> {
  const row = await one(
    "SELECT as_of FROM data_freshness WHERE dataset = ?",
    [freshnessDatasetFor(program)],
  );
  const raw = row?.as_of;
  return typeof raw === "string" ? (formatAsOf(raw) ?? raw) : null;
}

/** Send the double opt-in confirmation. */
export const sendConfirmation = internalAction({
  args: {
    email: v.string(),
    caseNumber: v.string(),
    /**
     * Whether `subscribe` also staged a product-news opt-in for this address.
     *
     * Passed in rather than queried: `subscribe` schedules this action from
     * inside its own transaction, so a lookup here could run before the
     * staging commits and send an email that names nothing while the row
     * exists. Optional so anything already in flight when this shipped still
     * renders, and absent means "say nothing", which is the safe direction.
     */
    includesNews: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const includesNews = args.includesNews === true;
      const program = programOf(args.caseNumber);
      const noun = programNoun(program);
      const token = await makeUnsubscribeToken(
        args.email,
        unsubscribeSecret(),
        "case-confirm",
      );
      const confirmUrl = actionUrl("/case-alert/confirm", token);

      // Echo the case back so a typo is caught here rather than a year later.
      // A mirror outage must not block the confirmation, so this degrades to
      // the "we do not hold it yet" copy rather than throwing: a person who
      // cannot confirm has no subscription at all.
      let current: Row | null = null;
      let asOf: string | null = null;
      try {
        current = await one(
          `SELECT current_status, employer_name, last_checked_at
             FROM ${tableForCase(args.caseNumber)} WHERE case_number = ?`,
          [args.caseNumber],
        );
        // This case's own check date, not the corpus-wide freshness stamp. The
        // corpus figure would say "August 26" for a case nobody has looked at
        // since May, which is the precise claim this product must not make.
        asOf = observedLabel(current?.last_checked_at);
      } catch (error) {
        log.error("mirror unreadable during confirmation", {
          caseNumber: args.caseNumber,
        });
        await recordError(ctx, "action", "caseAlerts.sendConfirmation.mirror", error);
      }

      const status =
        typeof current?.current_status === "string"
          ? current.current_status
          : null;
      const employer =
        typeof current?.employer_name === "string"
          ? current.employer_name
          : null;

      const html = await renderOrTextOnly(
        ctx,
        "caseAlerts.sendConfirmation.render",
        async () => {
          const { CaseAlertConfirm } = await import(
            "../src/emails/CaseAlertConfirm"
          );
          return CaseAlertConfirm({
            caseNumber: args.caseNumber,
            currentStatus: status,
            employerName: employer,
            asOf,
            confirmUrl,
            includesNews,
            nounWithArticle: programNounWithArticle(program),
          });
        },
      );

      const result = await sendEmailWithRetry(getResend(), {
        from: FROM_EMAIL,
        to: args.email,
        subject: `Confirm alerts for ${noun} ${args.caseNumber}`,
        html,
        text: [
          `You asked to be told when the Department of Labor's status for ${programNounWithArticle(program)} changes.`,
          "",
          `Case number: ${args.caseNumber}`,
          ...(status
            ? [
                `DOL showed: ${status}${employer ? ` at ${employer}` : ""}`,
                asOf ? `Last checked: ${asOf}` : "We don't have a check date for this case.",
              ]
            : [
                "We don't hold this case number yet, which is normal for a recent",
                "filing and is also what a typo looks like. Check it against your receipt.",
              ]),
          "",
          "Confirm here and we'll email you when its status changes:",
          confirmUrl,
          "",
          // The text part must not disagree with the HTML: both name the news
          // opt-in or neither does. One click confirming two things is only
          // consent for the second if the email said so.
          ...(includesNews
            ? [
                "You also asked for occasional product news. The same click confirms that.",
                "",
              ]
            : []),
          "If you didn't ask for this, ignore this message. Nothing further will be sent.",
          "",
          "PERM Tracker",
          `${SITE_URL}/perm-case-status`,
        ].join("\n"),
      });

      // The SDK reports failure by RETURNING an error, not by throwing, so this
      // check is the only thing between a failed send and a silent one.
      if (result.error) {
        log.error("confirmation send failed", {
          caseNumber: args.caseNumber,
          error: result.error.message,
        });
        await recordError(
          ctx,
          "action",
          "caseAlerts.sendConfirmation",
          new Error(`Resend: ${result.error.name}: ${result.error.message}`),
        );
        await ctx.runMutation(internal.caseAlerts.clearConfirmationCooldown, {
          email: args.email,
          caseNumber: args.caseNumber,
        });
      }
    } catch (error) {
      await recordError(ctx, "action", "caseAlerts.sendConfirmation", error);
      await ctx.runMutation(internal.caseAlerts.clearConfirmationCooldown, {
        email: args.email,
        caseNumber: args.caseNumber,
      });
    }
    return null;
  },
});

// ============================================================================
// Confirm / unsubscribe (driven by the HTTP routes)
// ============================================================================

/**
 * Every subscription row for the address a token names.
 *
 * The token signs `<purpose>:<email>` and carries no case number, so both
 * actions are address-scoped. That is the correct shape for each of them for a
 * different reason. Unsubscribe MUST be address-scoped: `List-Unsubscribe` in
 * Gmail means "stop mailing me", and a one-click that silenced one of a
 * person's three cases would be a broken promise. Confirm is address-scoped
 * because the click proves control of the inbox, which is the same proof for
 * every case staged from it.
 */
async function rowsForToken(
  ctx: MutationCtx,
  token: string,
  purpose: TokenPurpose,
): Promise<Doc<"caseStatusAlerts">[]> {
  const email = await verifyUnsubscribeToken(token, unsubscribeSecret(), purpose);
  if (!email) return [];
  return await ctx.db
    .query("caseStatusAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .take(MAX_CASES_PER_ADDRESS);
}

export const confirmByToken = internalMutation({
  args: { token: v.string() },
  returns: v.union(
    v.object({ email: v.string(), caseNumbers: v.array(v.string()) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const all = await rowsForToken(ctx, args.token, "case-confirm");
    if (all.length === 0) return null;

    const now = Date.now();
    const confirmed: string[] = [];

    for (const row of all) {
      // A confirm token never expires and is replayable by anyone who can read
      // the original email, including a corporate link scanner. So it is not a
      // fresh act of consent: only a NEW subscribe request, which is what
      // stages `pendingCaseNumber`, may put someone back on the list.
      if (row.pendingCaseNumber === undefined) continue;
      if (row.unsubscribedAt !== undefined && row.pendingCaseNumber === undefined) {
        continue;
      }

      const caseNumber = row.pendingCaseNumber;
      await ctx.db.patch(row._id, {
        confirmedAt: row.confirmedAt ?? now,
        caseNumber,
        pendingCaseNumber: undefined,
        unsubscribedAt: undefined,
        // Reopen a retired subscription only when the case number actually
        // MOVED. An explicit comparison, not a truthiness check: `subscribe`
        // stages a pending value on every request including a resubmit of the
        // number already on file, and the sibling module shipped exactly this
        // bug once, mailing a second "one alert, ever".
        ...(row.caseNumber !== caseNumber
          ? { caseClosedAt: undefined, lastSeenStatus: undefined }
          : {}),
      });
      confirmed.push(caseNumber);
    }

    if (confirmed.length === 0) return null;

    // Seed `lastSeenStatus` from the mirror right now, so the first alert is a
    // genuine transition rather than a restatement of what was already true
    // when they signed up. Runs in an action because a mutation cannot fetch.
    await ctx.scheduler.runAfter(0, internal.caseAlerts.seedLastSeen, {
      email: all[0]!.email,
    });

    // Confirming the alert also confirms a pending product-news opt-in for
    // the address: the confirmation email named both, and the click proves
    // the same inbox for both. No staged news row means a no-op.
    await ctx.runMutation(internal.emailPrefs.confirmNewsForEmail, {
      email: all[0]!.email,
    });

    return { email: all[0]!.email, caseNumbers: confirmed };
  },
});

export const unsubscribeByToken = internalMutation({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const all = await rowsForToken(ctx, args.token, "case-unsubscribe");
    if (all.length === 0) return false;
    const now = Date.now();
    for (const row of all) {
      // Also drop any staged case number. Leaving one would mean a replayed
      // confirm link could resurrect them through the pending path.
      await ctx.db.patch(row._id, {
        unsubscribedAt: now,
        pendingCaseNumber: undefined,
      });
    }
    return true;
  },
});

// ============================================================================
// The sweep
// ============================================================================

/** Rows the sweep is allowed to look at, least recently checked first. */
export const dueForCheck = internalQuery({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("caseStatusAlerts"),
      email: v.string(),
      caseNumber: v.string(),
      lastSeenStatus: v.optional(v.string()),
      lastAlertSentAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const out: {
      _id: Id<"caseStatusAlerts">;
      email: string;
      caseNumber: string;
      lastSeenStatus?: string;
      lastAlertSentAt?: number;
    }[] = [];

    for await (const row of ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_alert_sweep", (q) =>
        q.eq("unsubscribedAt", undefined).eq("caseClosedAt", undefined),
      )) {
      // Double opt-in: an unconfirmed row is inert. Filtered here rather than
      // indexed because the index has already cut the read down to live rows
      // and `lastCheckedAt` must hold the range position.
      if (!row.confirmedAt) continue;
      out.push({
        _id: row._id,
        email: row.email,
        caseNumber: row.caseNumber,
        lastSeenStatus: row.lastSeenStatus,
        lastAlertSentAt: row.lastAlertSentAt,
      });
      if (out.length >= args.limit) break;
    }

    return out;
  },
});

/** Bump the cursor for every row this sweep looked at, changed or not. */
export const markChecked = internalMutation({
  args: { ids: v.array(v.id("caseStatusAlerts")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) await ctx.db.patch(id, { lastCheckedAt: now });
    return null;
  },
});

/**
 * Record the status a sweep observed WITHOUT sending anything.
 *
 * Used for the first sighting of a case we did not hold at confirm time. See
 * the module docstring: our first sight cannot tell an arrival from a
 * long-standing status, so it establishes the baseline instead of claiming
 * news.
 */
export const seedObserved = internalMutation({
  args: {
    id: v.id("caseStatusAlerts"),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastSeenStatus: args.status,
      lastCheckedAt: Date.now(),
    });
    return null;
  },
});

/** Stamp a subscription AFTER an alert has genuinely been delivered. */
export const recordAlert = internalMutation({
  args: {
    id: v.id("caseStatusAlerts"),
    status: v.string(),
    isFinal: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    const now = Date.now();
    await ctx.db.patch(args.id, {
      lastSeenStatus: args.status,
      lastAlertSentAt: now,
      lastCheckedAt: now,
      alertCount: (row.alertCount ?? 0) + 1,
      // A final status cannot move again, so the subscription retires itself
      // rather than being read forever for a case that will never change.
      ...(args.isFinal ? { caseClosedAt: now } : {}),
    });
    return null;
  },
});

/**
 * Claim up to `want` sends against the global daily alert budget.
 *
 * One window read plus at most `granted` inserts, rather than `want` separate
 * check-and-record calls, each of which re-reads the window.
 */
export const claimAlertBudget = internalMutation({
  args: { want: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    if (args.want <= 0) return 0;
    const state = await checkRateLimit(ctx, "all", "case_alert_global", ALERT_GLOBAL_BUDGET);
    if (!state.allowed) return 0;
    // `remaining` already accounts for the notional attempt this call
    // represents, so the grant is that plus the one it was counted against.
    const granted = Math.min(args.want, state.remaining + 1);
    for (let i = 0; i < granted; i++) {
      await recordRateLimitAttempt(ctx, "all", "case_alert_global");
    }
    return granted;
  },
});

/** Seed `lastSeenStatus` for every confirmed row on one address. */
export const seedLastSeen = internalAction({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const subs = await ctx.runQuery(internal.caseAlerts.forEmail, {
        email: args.email,
      });
      const pending = subs.filter((s) => s.lastSeenStatus === undefined);
      if (pending.length === 0) return null;

      // One statement per program table, one round trip for all of them. An
      // address can hold a PERM and a wage request at once and they live in
      // different tables, so a single IN list cannot serve both.
      const statements: Statement[] = [];
      for (const [program, numbers] of groupByProgram(
        pending.map((s) => s.caseNumber),
      )) {
        const marks = placeholders(numbers.length);
        if (!marks) continue;
        statements.push({
          sql: `SELECT case_number, current_status FROM ${statusTableFor(program)}
                 WHERE case_number IN (${marks})`,
          args: numbers,
        });
      }
      if (statements.length === 0) return null;
      const current = (await query(statements)).flat();

      for (const row of current) {
        const num = typeof row.case_number === "string" ? row.case_number : null;
        const status =
          typeof row.current_status === "string" ? row.current_status : null;
        if (!num || !status) continue;
        const sub = pending.find((s) => s.caseNumber === num);
        if (!sub) continue;
        await ctx.runMutation(internal.caseAlerts.seedObserved, {
          id: sub._id,
          status: canonicalStatus(status),
        });
      }
    } catch (error) {
      // A seeding failure is recoverable: the sweep's own first-sighting path
      // does the same job. Recorded rather than thrown so a mirror outage does
      // not turn a successful confirmation into an error page.
      await recordError(ctx, "action", "caseAlerts.seedLastSeen", error);
    }
    return null;
  },
});

/** Confirmed subscriptions for one address. Used by the seeding action. */
export const forEmail = internalQuery({
  args: { email: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("caseStatusAlerts"),
      caseNumber: v.string(),
      lastSeenStatus: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .take(MAX_CASES_PER_ADDRESS);
    return all
      .filter((r) => r.confirmedAt !== undefined && r.unsubscribedAt === undefined)
      .map((r) => ({
        _id: r._id,
        caseNumber: r.caseNumber,
        lastSeenStatus: r.lastSeenStatus,
      }));
  },
});

/** Everything the alert email needs about one case, beyond the transition. */
interface CaseContext {
  filingMonth: string | null;
  employerName: string | null;
  jobTitle: string | null;
  nowInStatus: number;
  cohortTotal: number;
  cohortPending: number;
  pendingAhead: number;
  employer: {
    name: string;
    slug: string;
    total: number;
    certified: number;
    denied: number;
    medianDays: number | null;
  } | null;
}

function num(v: string | number | null | undefined): number {
  return typeof v === "number" ? v : 0;
}

function str(v: string | number | null | undefined): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Context for one case, in ONE round trip.
 *
 * Five statements in a single Hrana pipeline rather than five fetches. They are
 * positional, so the destructure below must stay in the same order as the array
 * above it.
 */
async function caseContext(
  caseNumber: string,
  program: FlagProgram,
  status: string,
  employerSlug: string | null,
): Promise<CaseContext | null> {
  // Every count below is scoped to the case's OWN program, so "cases now at
  // this status" and "filed the same month as yours" compare a wage request
  // against wage requests. Counting a PWD against the PERM corpus would put a
  // large, confident and meaningless number in front of the reader.
  const table = statusTableFor(program);

  const base = await one(
    `SELECT filing_date, employer_name, job_title FROM ${table}
      WHERE case_number = ?`,
    [caseNumber],
  );
  if (!base) return null;

  const filingDate = str(base.filing_date);
  const month = filingDate ? filingDate.slice(0, 7) : null;

  const statements = [
    {
      sql: `SELECT count(*) AS n FROM ${table} WHERE current_status = ?`,
      args: [status] as (string | number | null)[],
    },
    {
      sql: `SELECT count(*) AS total, coalesce(sum(is_final), 0) AS decided
              FROM ${table} WHERE substr(filing_date, 1, 7) = ?`,
      args: [month ?? ""] as (string | number | null)[],
    },
    {
      sql: `SELECT count(*) AS n FROM ${table}
             WHERE is_final = 0 AND substr(filing_date, 1, 7) < ?`,
      args: [month ?? ""] as (string | number | null)[],
    },
    ...(employerSlug
      ? [
          {
            sql: `SELECT name, slug, total, certified, denied, median_days
                    FROM perm_entities WHERE kind = 'employer' AND slug = ?`,
            args: [employerSlug] as (string | number | null)[],
          },
        ]
      : []),
  ];

  const results = await query(statements);
  const censusRow = results[0]?.[0];
  const cohortRow = results[1]?.[0];
  const aheadRow = results[2]?.[0];
  const employerRow = employerSlug ? results[3]?.[0] : undefined;

  const cohortTotal = num(cohortRow?.total);
  const cohortDecided = num(cohortRow?.decided);

  return {
    filingMonth: month,
    employerName: str(base.employer_name),
    jobTitle: str(base.job_title),
    nowInStatus: num(censusRow?.n),
    cohortTotal,
    cohortPending: cohortTotal - cohortDecided,
    pendingAhead: num(aheadRow?.n),
    employer: employerRow
      ? {
          name: String(employerRow.name),
          slug: String(employerRow.slug),
          total: num(employerRow.total),
          certified: num(employerRow.certified),
          denied: num(employerRow.denied),
          medianDays:
            employerRow.median_days === null ? null : num(employerRow.median_days),
        }
      : null,
  };
}

/** The RFI funnel, on RFI alerts only. Null when the table is empty. */
async function rfiFunnel(): Promise<{
  resolved: number;
  certified: number;
  denied: number;
  withdrawn: number;
  tracked: number;
  observedAt: number;
} | null> {
  const row = await one(
    `SELECT total_tracked, rfi_resolved, rfi_certified, rfi_denied,
            rfi_withdrawn, observed_at
       FROM rfi_funnel ORDER BY observed_at DESC LIMIT 1`,
  );
  if (!row) return null;
  const resolved = num(row.rfi_resolved);
  if (resolved <= 0) return null;
  return {
    resolved,
    certified: num(row.rfi_certified),
    denied: num(row.rfi_denied),
    withdrawn: num(row.rfi_withdrawn),
    tracked: num(row.total_tracked),
    observedAt: num(row.observed_at),
  };
}

/**
 * Look at every live subscription, and mail the ones whose case has moved.
 *
 * Reads up to CHECK_BATCH_LIMIT rows in ascending `lastCheckedAt` order, which
 * is a round-robin over the whole table, and bumps that stamp for every row it
 * looked at whether or not anything changed. Sending is separately bounded by
 * ALERT_BATCH_LIMIT and by the global daily budget.
 *
 * It RESCHEDULES ITSELF when work remains, guarded on having made progress.
 * `ctx.scheduler.runAfter` discards return values, so a function that hands
 * back `{ remaining }` and expects the scheduler to act on it resumes nothing:
 * the sibling module shipped that, and 60 of 100 due subscribers waited a month.
 * The guard is what stops a total outage spinning a timer against a service
 * that is already down.
 */
export const sweepCaseChanges = internalAction({
  args: {},
  returns: v.object({
    checked: v.number(),
    sent: v.number(),
    failed: v.number(),
    seeded: v.number(),
    remaining: v.boolean(),
  }),
  handler: async (
    ctx,
  ): Promise<{
    checked: number;
    sent: number;
    failed: number;
    seeded: number;
    remaining: boolean;
  }> => {
    const due = await ctx.runQuery(internal.caseAlerts.dueForCheck, {
      limit: CHECK_BATCH_LIMIT + 1,
    });
    const batch = due.slice(0, CHECK_BATCH_LIMIT);
    let remaining = due.length > CHECK_BATCH_LIMIT;
    let sent = 0;
    let failed = 0;
    let seeded = 0;

    if (batch.length === 0) {
      return { checked: 0, sent: 0, failed: 0, seeded: 0, remaining: false };
    }

    // One round trip for the whole batch, one statement per program table.
    // De-duplicated because several subscribers routinely watch the same case
    // (an employer and a beneficiary), and the IN lists are what bound this
    // read. Keying the result by case number alone is safe because a serial is
    // claimed by exactly one prefix, so the same number cannot exist in two
    // programs' tables.
    const uniqueCases = Array.from(new Set(batch.map((r) => r.caseNumber)));
    const statements: Statement[] = [];
    for (const [program, numbers] of groupByProgram(uniqueCases)) {
      const marks = placeholders(numbers.length);
      if (!marks) continue;
      statements.push({
        sql: `SELECT case_number, current_status, is_final, last_checked_at
                FROM ${statusTableFor(program)} WHERE case_number IN (${marks})`,
        args: numbers,
      });
    }
    if (statements.length === 0) {
      return { checked: 0, sent: 0, failed: 0, seeded: 0, remaining: false };
    }

    const mirror = (await query(statements)).flat();
    const nowByCase = new Map<
      string,
      { status: string; isFinal: boolean; observedAt: string | null }
    >();
    for (const row of mirror) {
      const numKey = str(row.case_number);
      const status = str(row.current_status);
      if (!numKey || !status) continue;
      nowByCase.set(numKey, {
        status: canonicalStatus(status),
        isFinal: isFinalFlag(row.is_final),
        // May legitimately be null: 11,955 pending rows carry no check date.
        // Passed through as null rather than defaulted, so the template says
        // so instead of implying a fresh observation.
        observedAt: observedLabel(row.last_checked_at),
      });
    }

    const now = Date.now();
    const changed: {
      sub: (typeof batch)[number];
      program: FlagProgram;
      status: string;
      isFinal: boolean;
      observedAt: string | null;
    }[] = [];

    for (const sub of batch) {
      const current = nowByCase.get(sub.caseNumber);
      // A case the mirror does not hold. Not an error and not a change: a
      // recent filing legitimately sits outside it for weeks.
      if (!current) continue;

      // First sighting. Establish the baseline, send nothing. See the module
      // docstring for why this is not a missed alert.
      if (sub.lastSeenStatus === undefined) {
        await ctx.runMutation(internal.caseAlerts.seedObserved, {
          id: sub._id,
          status: current.status,
        });
        seeded += 1;
        continue;
      }

      // THE CHANGE DETECTOR. Both sides are defined strings, canonicalised the
      // same way, compared with an explicit inequality.
      if (sub.lastSeenStatus === current.status) continue;

      // Safety valve against upstream churn. A real status change is rare, so
      // this only ever bites when the mirror is flapping.
      if (
        sub.lastAlertSentAt !== undefined &&
        now - sub.lastAlertSentAt < ALERT_COOLDOWN_MS
      ) {
        continue;
      }

      changed.push({
        sub,
        program: programOf(sub.caseNumber),
        status: current.status,
        isFinal: current.isFinal,
        observedAt: current.observedAt,
      });
    }

    // Bump the cursor for everything looked at. Rows that produced an alert are
    // stamped again by `recordAlert`, which is harmless; the point is that a
    // row which did NOT change still advances, so the sweep round-robins.
    await ctx.runMutation(internal.caseAlerts.markChecked, {
      ids: batch.map((r) => r._id),
    });

    if (changed.length === 0) {
      return { checked: batch.length, sent: 0, failed: 0, seeded, remaining };
    }

    // Claim the budget BEFORE rendering anything. A send that the budget will
    // refuse is a React render nobody reads.
    const want = Math.min(changed.length, ALERT_BATCH_LIMIT);
    const granted = await ctx.runMutation(internal.caseAlerts.claimAlertBudget, {
      want,
    });
    if (granted < changed.length) remaining = true;
    if (granted === 0) {
      log.error("alert budget exhausted; nothing sent this sweep", {
        due: changed.length,
        limit: ALERT_GLOBAL_BUDGET.limit,
      });
      return { checked: batch.length, sent: 0, failed: 0, seeded, remaining };
    }

    const sending = changed.slice(0, granted);

    // One as-of per program present in this batch, at most three reads. Says
    // COUNTED, not checked: the counting is genuinely ours, the statuses being
    // counted are not, and this is the corpus-wide refresh stamp rather than
    // any one case's check date, which is why the per-case date is carried
    // separately in `observedAt`.
    const provenanceByProgram = new Map<FlagProgram, string>();
    for (const program of new Set(sending.map((c) => c.program))) {
      const asOf = await mirrorAsOf(program);
      provenanceByProgram.set(
        program,
        `Counted across our mirror of DOL case status${asOf ? `, as of ${asOf}` : ""}.`,
      );
    }

    // PERM ONLY. `rfi_funnel` is measured over PERM cases, so pasting it into
    // an alert about a wage request would be a rate from one population
    // presented beside a case in another.
    const funnel = sending.some(
      (c) => c.program === "perm" && showsRfiFunnel(c.status),
    )
      ? await rfiFunnel()
      : null;

    for (const { sub, program, status, isFinal, observedAt } of sending) {
      try {
        const { slugify } = await import("../src/lib/entitySlug");
        const base = await one(
          `SELECT employer_name FROM ${statusTableFor(program)}
             WHERE case_number = ?`,
          [sub.caseNumber],
        );
        const employerRaw = str(base?.employer_name);
        const context = await caseContext(
          sub.caseNumber,
          program,
          status,
          employerRaw ? slugify(employerRaw) : null,
        );
        if (!context) {
          log.error("case vanished from the mirror mid-sweep", {
            caseNumber: sub.caseNumber,
          });
          continue;
        }

        const token = await makeUnsubscribeToken(
          sub.email,
          unsubscribeSecret(),
          "case-unsubscribe",
        );
        const unsubUrl = actionUrl("/case-alert/unsubscribe", token);
        const caseUrl = casePageUrl(sub.caseNumber);
        const noun = programNoun(program);
        // The map is keyed off this same list, so the fallback is unreachable.
        // It says the sentence WITHOUT a date rather than an empty string, so
        // an impossible miss degrades to honest copy instead of a blank line
        // where the provenance should be.
        const contextProvenance =
          provenanceByProgram.get(program) ??
          "Counted across our mirror of DOL case status.";
        // PERM ONLY, and this is a correctness floor rather than a style
        // choice. Every gloss in `statusMeaning` cites PERM regulation - the
        // CERTIFIED one promises a 180-day window to file the I-140, which is
        // simply untrue of a certified LCA. A plausible wrong explanation of a
        // government status is worse than none, because the reader cannot tell
        // them apart and will act on it. Non-PERM programs get no sentence
        // until one can be sourced; the template already renders nothing.
        const meaning = program === "perm" ? statusMeaning(status) : null;
        const tone =
          !isFinal || isProgramApproval(program, status) ? "live" : "closed";

        const contextRows = [
          { label: "Cases now at this status", value: count(context.nowInStatus) },
          ...(context.cohortTotal > 0
            ? [
                {
                  label: "Filed the same month as yours",
                  value: count(context.cohortTotal),
                },
                {
                  label: "Of those, still pending",
                  value: count(context.cohortPending),
                },
                {
                  label: "Pending cases filed earlier",
                  value: count(context.pendingAhead),
                },
              ]
            : []),
        ];

        const showFunnel =
          program === "perm" && showsRfiFunnel(status) && funnel !== null;
        const rfiRows = showFunnel
          ? [
              { label: "Resolved RFIs observed", value: count(funnel.resolved) },
              {
                label: "Of those, ended certified",
                value: count(funnel.certified),
              },
              { label: "Ended denied", value: count(funnel.denied) },
              { label: "Withdrawn", value: count(funnel.withdrawn) },
            ]
          : null;

        const employerRows =
          context.employer && context.employer.total > 0
            ? [
                {
                  label: "Decisions DOL has published",
                  value: count(context.employer.total),
                },
                {
                  label: "Of those, certified",
                  value: count(context.employer.certified),
                },
                { label: "Denied", value: count(context.employer.denied) },
                ...(context.employer.medianDays !== null
                  ? [
                      {
                        label: "Median days to a decision",
                        value: count(context.employer.medianDays),
                      },
                    ]
                  : []),
              ]
            : null;

        const html = await renderOrTextOnly(
          ctx,
          "caseAlerts.sweepCaseChanges.render",
          async () => {
            const { CaseStatusChanged } = await import(
              "../src/emails/CaseStatusChanged"
            );
            return CaseStatusChanged({
              caseNumber: sub.caseNumber,
              employerName: context.employerName,
              jobTitle: context.jobTitle,
              fromStatus: sub.lastSeenStatus!,
              toStatus: status,
              tone,
              meaning,
              isFinal,
              observedAt,
              contextRows,
              contextProvenance,
              rfiRows,
              rfiProvenance: funnel
                ? `Observed across ${count(funnel.tracked)} tracked cases. Underlying source: DOL case status on flag.dol.gov.`
                : null,
              employerRows,
              employerProvenance:
                "DOL's published PERM disclosure files, FY2024 to FY2026.",
              employerUrl: context.employer
                ? `${SITE_URL}/perm-employers/${context.employer.slug}`
                : null,
              caseUrl,
              unsubscribeUrl: unsubUrl,
            });
          },
        );

        const result = await sendEmailWithRetry(getResend(), {
          from: FROM_EMAIL,
          to: sub.email,
          subject: `Your ${noun} is now ${status}`,
          html,
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          text: [
            `DOL's status for ${noun} ${sub.caseNumber} has changed.`,
            "",
            `Was: ${sub.lastSeenStatus}`,
            `Now: ${status}`,
            ...(context.employerName
              ? ["", `${context.employerName}${context.jobTitle ? `, ${context.jobTitle}` : ""}`]
              : []),
            ...(meaning ? ["", meaning] : []),
            "",
            observedAt
              ? `DOL showed this status when the case was last checked, on ${observedAt}.`
              : "We don't have a check date for this case, so we can't say when DOL showed this.",
            "It isn't a decision on your case and it isn't a prediction of one.",
            "",
            ...(rfiRows
              ? [
                  "RFIs that have since resolved:",
                  ...rfiRows.map((r) => `  ${r.label}: ${r.value}`),
                  "That's a count of other cases. It says nothing about how yours resolves.",
                  "",
                ]
              : []),
            "Where this sits:",
            ...contextRows.map((r) => `  ${r.label}: ${r.value}`),
            contextProvenance,
            "",
            `Open this case: ${caseUrl}`,
            "",
            isFinal
              ? "This case has reached a final status, so this is the last alert for it."
              : "We'll email you again if it moves again, and we stop once it's decided.",
            `Stop these alerts: ${unsubUrl}`,
            "",
            "PERM Tracker",
          ].join("\n"),
        });

        if (result.error) {
          // Do NOT stamp the row. This subscriber stays due so a later sweep
          // retries them; advancing `lastSeenStatus` here would make the
          // transition look like old news and destroy the alert permanently.
          failed += 1;
          log.error("alert send failed", {
            caseNumber: sub.caseNumber,
            error: result.error.message,
          });
          await recordError(
            ctx,
            "action",
            "caseAlerts.sweepCaseChanges",
            new Error(`Resend: ${result.error.name}: ${result.error.message}`),
          );
          continue;
        }

        await ctx.runMutation(internal.caseAlerts.recordAlert, {
          id: sub._id,
          status,
          isFinal,
        });
        sent += 1;
      } catch (error) {
        // One bad case must not stop the sweep for everyone behind it.
        failed += 1;
        log.error("alert send threw", { caseNumber: sub.caseNumber, error });
        await recordError(ctx, "action", "caseAlerts.sweepCaseChanges", error);
      }
    }

    if (failed > 0 && sent > 0) remaining = true;

    if (remaining && sent > 0) {
      await ctx.scheduler.runAfter(
        5 * 60 * 1000,
        internal.caseAlerts.sweepCaseChanges,
        {},
      );
    } else if (remaining) {
      log.error("case sweep stalled: work remains but nothing sent this run", {
        checked: batch.length,
        failed,
      });
    }

    return { checked: batch.length, sent, failed, seeded, remaining };
  },
});
