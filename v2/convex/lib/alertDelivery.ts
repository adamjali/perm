/**
 * One way out for every alert email, so a person hears from us at most once a day.
 *
 * Adam, Sep 25 2026: "i feel like we already have too much emails as it is ...
 * just merge everything in somewhere". Each alert kind (case status, queue
 * month, visa bulletin, employer follow) still decides WHAT to say and builds
 * its own complete email; this decides WHEN it leaves.
 *
 * - An address that follows exactly one thing, has not been sent an alert
 *   today (Eastern), and has nothing waiting gets the email now. That is
 *   almost everyone, and for them nothing changes.
 * - Anyone else's email waits in `alertOutbox`. `alertOutbox.sendBundles`
 *   runs half an hour after each sweep and sends each waiting address ONE
 *   email: the stored email itself when one item waits, one "Your PERM
 *   Tracker updates" email when several do. An address already mailed today
 *   waits for tomorrow's first run.
 *
 * A queued item counts as delivered for the producer's own change detector,
 * so the producer never re-queues it; the outbox owns retries from then on.
 * A failed direct send returns `failed` and the producer does NOT advance,
 * exactly as before, so the next sweep tries again.
 *
 * Budgets are unchanged: every item still claims its unit from its own
 * kind's global budget before it is built, and a bundle of several items
 * sends one email against several claimed units, which only ever errs low.
 */

import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { FROM_EMAIL, getResend, sendEmailWithRetry } from "./email";

export type AlertKind = "case" | "queue" | "bulletin" | "employer";

export interface AlertSummary {
  /** What it is about: "G-100-26125-868956", "Adobe Inc.", "EB2 India". */
  title: string;
  /** What happened, in one line. */
  line: string;
  /** Where to look. Absolute. */
  url: string;
  tone?: "good" | "bad" | "neutral";
}

export interface AlertItem {
  email: string;
  kind: AlertKind;
  /** `<kind>:<row id>`, so an opt-out drops anything still waiting for it. */
  ref: string;
  subject: string;
  html?: string;
  text: string;
  /** The kind's own one-click opt-out, for the `List-Unsubscribe` header. */
  listUnsubscribe: string;
  summary: AlertSummary;
}

export type DeliveryResult =
  | { status: "sent" }
  | { status: "queued" }
  | { status: "failed"; error: string };

/** YYYY-MM-DD on Adam's and DOL's clock, never UTC's. */
export function etDay(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** RFC 8058 one-click headers for a single opt-out URL. */
export function oneClickHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function deliverAlert(ctx: ActionCtx, item: AlertItem): Promise<DeliveryResult> {
  const now = Date.now();
  const day = etDay(now);
  const state = await ctx.runQuery(internal.alertOutbox.deliveryState, {
    email: item.email,
    day,
  });

  if (!state.sendNow) {
    await ctx.runMutation(internal.alertOutbox.enqueue, {
      email: item.email,
      kind: item.kind,
      ref: item.ref,
      subject: item.subject,
      html: item.html,
      text: item.text,
      listUnsubscribe: item.listUnsubscribe,
      summary: item.summary,
    });
    return { status: "queued" };
  }

  const result = await sendEmailWithRetry(getResend(), {
    from: FROM_EMAIL,
    to: item.email,
    subject: item.subject,
    html: item.html,
    text: item.text,
    headers: oneClickHeaders(item.listUnsubscribe),
  });
  if (result.error) {
    return { status: "failed", error: `${result.error.name}: ${result.error.message}` };
  }
  await ctx.runMutation(internal.alertOutbox.recordDirect, {
    email: item.email,
    kind: item.kind,
    ref: item.ref,
    subject: item.subject,
    summary: item.summary,
    day,
  });
  return { status: "sent" };
}
