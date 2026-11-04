"use node";

import * as webpush from "web-push";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import { parseSubscription } from "./casePushAlerts";
import { lineSlug } from "./lib/bulletinLineNames";
import { bulletinPushMessage } from "./lib/bulletinPushWords";
import { recordError } from "./lib/errorRecording";
import { SITE_URL } from "./lib/links";
import { createLogger } from "./lib/logging";
import type { CountryKey } from "./lib/perm/calculators/priorityDate";
import { one } from "./lib/publicMirror";

/**
 * The bulletin's browser-push sweep, in its own file because `web-push` needs the Node runtime and a Node file
 * holds only actions (bulletinPushAlerts.ts holds the table's functions and the design). Scheduled by the
 * bulletin email sweep, which reads the same newest bulletin every hour; each row is claimed before it's sent,
 * so overlapping runs send once.
 */

const log = createLogger("BulletinPushAlertsSweep");
const SEND_CAP = 500;
const MAX_PAGES = 20;

function readPage(ctx: ActionCtx, cursor: string | null) {
  return ctx.runQuery(internal.bulletinPushAlerts.activeRows, { cursor });
}

function vapidReady(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:support@permtracker.app", pub, priv);
  return true;
}

const out = v.object({ checked: v.number(), seeded: v.number(), sent: v.number(), closed: v.number(), failed: v.number() });

export const sweep = internalAction({
  args: {},
  returns: out,
  handler: async (ctx): Promise<{ checked: number; seeded: number; sent: number; closed: number; failed: number }> => {
    const res = { checked: 0, seeded: 0, sent: 0, closed: 0, failed: 0 };
    const row = await one("SELECT bulletin_month, final_action FROM visa_bulletins ORDER BY bulletin_month DESC LIMIT 1");
    if (!row) return res;
    const month = String(row.bulletin_month);
    const finalAction = JSON.parse(String(row.final_action)) as Record<string, Record<string, string>>;

    const rows: Awaited<ReturnType<typeof readPage>>["rows"] = [];
    let cursor: string | null = null;
    for (let pages = 0; pages < MAX_PAGES; pages++) {
      const page = await readPage(ctx, cursor);
      rows.push(...page.rows);
      if (page.isDone) break;
      cursor = page.cursor;
      if (pages === MAX_PAGES - 1) log.error("bulletin push sweep read its page limit; the rest wait for the next run", { read: rows.length });
    }
    res.checked = rows.length;
    if (rows.length === 0) return res;
    if (!vapidReady()) {
      log.error("VAPID keys not configured; bulletin push sweep sent nothing", { rows: rows.length });
      return res;
    }

    for (const r of rows) {
      const cutoff = finalAction[r.category]?.[r.country];
      if (cutoff === undefined) continue; // the line isn't in this bulletin
      if (r.lastSeenBulletin === undefined || r.lastSeenCutoff === undefined) {
        await ctx.runMutation(internal.bulletinPushAlerts.seed, { id: r._id, month, cutoff });
        res.seeded++;
        continue;
      }
      if (month <= r.lastSeenBulletin) continue;
      if (res.sent >= SEND_CAP) break;
      if (!parseSubscription(r.subscription)) {
        await ctx.runMutation(internal.bulletinPushAlerts.close, { id: r._id });
        res.closed++;
        continue;
      }
      if (!(await ctx.runMutation(internal.bulletinPushAlerts.claim, { id: r._id, month, cutoff }))) continue;
      const country = r.country as CountryKey;
      const words = bulletinPushMessage({ month, category: r.category, country, from: r.lastSeenCutoff, to: cutoff });
      const payload = JSON.stringify({
        ...words,
        tag: `bulletin-${r.category}-${r.country}`,
        url: `${SITE_URL}/visa-bulletin/categories/${lineSlug(r.category, country)}`,
      });
      try {
        await webpush.sendNotification(JSON.parse(r.subscription), payload, { TTL: 3 * 24 * 60 * 60 });
        res.sent++;
        await ctx.runMutation(internal.bulletinPushAlerts.delivered, { id: r._id });
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await ctx.runMutation(internal.bulletinPushAlerts.close, { id: r._id });
          res.closed++;
        } else {
          res.failed++;
          await ctx.runMutation(internal.bulletinPushAlerts.unclaim, { id: r._id, claimed: month, month: r.lastSeenBulletin, cutoff: r.lastSeenCutoff });
          await ctx.runMutation(internal.bulletinPushAlerts.bumpFailure, { id: r._id });
          await recordError(ctx, "action", "bulletinPushAlerts.sweep.delivery", e).catch(() => undefined);
        }
      }
    }
    log.info("bulletin push sweep", res);
    return res;
  },
});
