/**
 * Ingestion and read API for DOL's published processing times.
 *
 * Source: https://flag.dol.gov/processingtimes (public, no auth, robots-clean).
 *
 * The whole reason this exists: DOL publishes one snapshot and overwrites it
 * on the next update. There is no archive. Storing each publication turns a
 * single number into a measured series, so the site can state how far the
 * queue actually moved between two real dates. Everything downstream reports
 * DOL's own figures with DOL's own as-of date attached; nothing here predicts.
 *
 * Runtime note: this file stays on Convex's default V8 runtime. It needs
 * `fetch` and Web Crypto, both available there, and no Node builtins, so it
 * deliberately does NOT carry a "use node" directive.
 *
 * @module convex/dolProcessingTimes
 */

import { v, type Infer } from "convex/values";
import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { recordError } from "./lib/errorRecording";
import {
  parseProcessingTimes,
  hashSnapshot,
  analystReviewQueue,
  DOL_PROCESSING_TIMES_URL,
} from "./lib/dolProcessingTimes";
import { createLogger } from "./lib/logging";

const log = createLogger("DolProcessingTimes");

/** Give DOL a generous but bounded window; the page is ~160 KB of plain HTML. */
const FETCH_TIMEOUT_MS = 30_000;

// ============================================================================
// Validators
//
// Defined once and derived, so the table shape, the mutation args and the
// query return type cannot drift apart.
// ============================================================================

const permQueueRow = v.object({
  queue: v.string(),
  priorityDate: v.union(v.string(), v.null()),
  raw: v.string(),
});

const permDeterminationRow = v.object({
  determination: v.string(),
  month: v.union(v.string(), v.null()),
  calendarDays: v.union(v.number(), v.null()),
  raw: v.string(),
});

const pwdQueueRow = v.object({
  program: v.string(),
  oewsReceiptDate: v.union(v.string(), v.null()),
  nonOewsReceiptDate: v.union(v.string(), v.null()),
});

const pwdBacklogRow = v.object({
  receiptMonth: v.string(),
  remainingRequests: v.number(),
});

/** Everything the parser produces, which is everything `store` accepts. */
const snapshotInput = v.object({
  permAsOf: v.string(),
  pwdAsOf: v.optional(v.string()),
  permQueues: v.array(permQueueRow),
  permAverageDays: v.array(permDeterminationRow),
  pwdQueues: v.array(pwdQueueRow),
  pwdPermBacklog: v.array(pwdBacklogRow),
  sourceUrl: v.string(),
  contentHash: v.string(),
});

/** A stored row: the parsed snapshot plus Convex system fields and fetch time. */
const storedSnapshot = snapshotInput.extend({
  _id: v.id("dolProcessingTimes"),
  _creationTime: v.number(),
  fetchedAt: v.number(),
});

/** Outcome of an ingestion run. `stored: false` is the normal monthly result. */
const ingestResult = v.object({
  stored: v.boolean(),
  permAsOf: v.optional(v.string()),
  reason: v.optional(v.string()),
});

// ============================================================================
// Ingestion
// ============================================================================

/**
 * Fetch the live page, parse it, and store it if the content changed.
 *
 * Scheduled WEEKLY (see convex/crons.ts). DOL refreshes PERM in the first work
 * week of each month and prevailing wage on its own cadence, so most runs find
 * no change and report a no-op; polling weekly just means we notice the change
 * within days of it happening rather than on a fixed date DOL does not honour.
 */
export const refresh = internalAction({
  args: {},
  returns: ingestResult,
  handler: async (ctx): Promise<{ stored: boolean; permAsOf?: string; reason?: string }> => {
    let html: string;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(DOL_PROCESSING_TIMES_URL, {
          signal: controller.signal,
          headers: {
            // Identify honestly. DOL serves this page to anyone, and a real
            // contact string is the courteous way to consume a public feed.
            "User-Agent":
              "PERMTrackerBot/1.0 (+https://permtracker.app; support@permtracker.app)",
            Accept: "text/html",
          },
        });

        if (!response.ok) {
          throw new Error(`DOL returned HTTP ${response.status}`);
        }
        html = await response.text();
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      // A failed fetch is worth surfacing: the series quietly going stale is
      // exactly the failure mode this table exists to prevent.
      await recordError(ctx, "action", "dolProcessingTimes.refresh.fetch", error);
      throw error;
    }

    // parseProcessingTimes throws when DOL changes the page shape. That is
    // deliberate: a half-parsed snapshot is indistinguishable from a month
    // where the queue genuinely did not move.
    try {
      const snapshot = parseProcessingTimes(html);
      const contentHash = await hashSnapshot(snapshot);

      const result = await ctx.runMutation(internal.dolProcessingTimes.store, {
        permAsOf: snapshot.permAsOf,
        pwdAsOf: snapshot.pwdAsOf ?? undefined,
        permQueues: snapshot.permQueues,
        permAverageDays: snapshot.permAverageDays,
        pwdQueues: snapshot.pwdQueues,
        pwdPermBacklog: snapshot.pwdPermBacklog,
        sourceUrl: snapshot.sourceUrl,
        contentHash,
      });

      // Only when the published figures actually changed. Firing on every run
      // would re-scan the subscriber list weekly for no reason, and firing
      // before the store would alert people off a snapshot we failed to keep.
      if (result.stored) {
        const analyst = analystReviewQueue(snapshot.permQueues);

        // The parser now guarantees this row exists, so reaching either branch
        // below means something changed upstream that we should hear about.
        // Previously this was a bare `if (analyst?.priorityDate)` with no else:
        // a missing row or a "--" produced a stored snapshot, zero alerts, no
        // log and no error, so the feature could be entirely dead while every
        // dashboard stayed green. Silence is not an acceptable outcome for the
        // one value the whole product depends on.
        if (!analyst) {
          await recordError(
            ctx,
            "action",
            "dolProcessingTimes.refresh.analystRow",
            new Error(
              "Snapshot stored with no Analyst Review row; queue alerts did not run",
            ),
          );
        } else if (!analyst.priorityDate) {
          log.warn("Analyst Review row has no priority date; skipping queue alerts", {
            raw: analyst.raw,
            permAsOf: snapshot.permAsOf,
          });
        } else {
          await ctx.scheduler.runAfter(0, internal.queueAlerts.notifyQueueReached, {
            frontier: analyst.priorityDate,
            asOf: snapshot.permAsOf,
          });
        }
      }

      return result;
    } catch (error) {
      await recordError(ctx, "action", "dolProcessingTimes.refresh.parse", error);
      throw error;
    }
  },
});

/**
 * Compile-time proof that the stored-snapshot validator and the actual table
 * are the same shape, in both directions.
 *
 * `.extend()` and `.fields` bind `storedSnapshot` and `store`'s args to
 * `snapshotInput`, so those three genuinely cannot drift. The table body in
 * convex/schema.ts is derived from NOTHING, and TypeScript does not
 * excess-property-check a spread of a non-fresh variable, so an EXTRA field on
 * the validator type-checks green and fails at runtime — in production, on the
 * cron, once a week, on a page DOL keeps no archive of. This assertion is the
 * only thing that catches that direction.
 */
type StoredMatchesTable =
  Doc<"dolProcessingTimes"> extends Infer<typeof storedSnapshot>
    ? Infer<typeof storedSnapshot> extends Doc<"dolProcessingTimes">
      ? true
      : never
    : never;
const _storedMatchesTable: StoredMatchesTable = true;
void _storedMatchesTable;

/**
 * Insert a snapshot, but only when its content differs from what we hold.
 *
 * Rows are immutable, and one row means one genuine DOL publication.
 */
export const store = internalMutation({
  args: snapshotInput.fields,
  returns: ingestResult,
  handler: async (ctx, args): Promise<{ stored: boolean; permAsOf?: string; reason?: string }> => {
    const existing = await ctx.db
      .query("dolProcessingTimes")
      .withIndex("by_content_hash", (q) => q.eq("contentHash", args.contentHash))
      .first();

    if (existing) {
      return { stored: false, reason: "unchanged since last publication" };
    }

    await ctx.db.insert("dolProcessingTimes", {
      ...args,
      fetchedAt: Date.now(),
    });

    return { stored: true, permAsOf: args.permAsOf };
  },
});

// ============================================================================
// Public read API
//
// These are intentionally public. This is published US government data
// powering public marketing pages: there is no user scoping to apply, and it
// exposes nothing about any case or account.
// ============================================================================

/** The most recent snapshot, or null before the first successful run. */
export const getLatest = query({
  args: {},
  returns: v.union(storedSnapshot, v.null()),
  handler: async (ctx) => {
    return await ctx.db
      .query("dolProcessingTimes")
      .withIndex("by_fetched")
      .order("desc")
      .first();
  },
});

/**
 * The stored series, newest first.
 *
 * This is the part DOL itself does not offer: every publication we have seen,
 * so a reader can watch the queue move rather than take one number on faith.
 */
export const getHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(storedSnapshot),
  handler: async (ctx, args) => {
    // Clamped at BOTH ends. This is a public query, so `limit` is caller-
    // supplied: -1 and NaN both used to reach `.take()` unchallenged.
    const requested = Math.floor(args.limit ?? 24);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 120) : 24;
    return await ctx.db
      .query("dolProcessingTimes")
      .withIndex("by_fetched")
      .order("desc")
      .take(limit);
  },
});
