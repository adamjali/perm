/**
 * The spam filter for mail to our addresses and the contact form (owner's yes, Oct
 * 25 2026). The rules live in convex/lib/spamCheck.ts; this file holds what needs
 * the database: the owner's word on a sender, whether a message answers one we
 * sent, the held list on the admin page, "Not spam", "Delete", "Spam", the 30-day
 * clean-up and the morning report's line.
 *
 * Nothing here deletes a message the owner hasn't seen listed: held mail stays on
 * the admin page for HELD_KEEP_DAYS, and the morning report counts it every day.
 */

import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query, type DatabaseWriter, type QueryCtx } from "./_generated/server";
import { getSecurityAlertEmail, requireAdmin } from "./lib/admin";
import { getResend } from "./lib/email";
import { recordError } from "./lib/errorRecording";
import { sendOwnerMail } from "./lib/ownerMail";
import { HELD_KEEP_DAYS, senderKey, verdictFor, type AiOpinion, type MailForCheck, type SenderLists } from "./lib/spamCheck";
import { MS_PER_DAY } from "./lib/time";

/** The message ids a thread header names, at most ten. */
function threadIds(thread: string | undefined): string[] {
  return [...new Set((thread ?? "").match(/<[^<>\s]{3,300}>/g) ?? [])].slice(0, 10);
}

/** The owner's word on a sender (address first, then its domain), and whether the mail answers us. */
export async function senderListsFor(ctx: QueryCtx, from: string, thread?: string): Promise<SenderLists> {
  const address = from.trim().toLowerCase();
  const keys = [...new Set([address, senderKey(address)])];
  let allowed = false;
  let blocked = false;
  for (const key of keys) {
    const row = await ctx.db
      .query("mailSenderVerdicts")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (!row) continue;
    if (row.verdict === "allow") allowed = true;
    else blocked = true;
    break; // the address's own word outranks its domain's
  }
  let answersUs = false;
  for (const id of threadIds(thread)) {
    const ours = await ctx.db
      .query("supportEmails")
      .withIndex("by_message_id", (q) => q.eq("messageId", id))
      .first();
    if (ours?.repliedAt) {
      answersUs = true;
      break;
    }
  }
  return { allowed, blocked, answersUs };
}

const mailArgs = {
  from: v.string(),
  fromName: v.optional(v.string()),
  subject: v.string(),
  text: v.optional(v.string()),
  listUnsubscribe: v.optional(v.string()),
  replyTo: v.optional(v.string()),
  spamFlag: v.optional(v.string()),
  thread: v.optional(v.string()),
  extra: v.optional(v.array(v.object({ weight: v.number(), why: v.string() }))),
  ai: v.optional(v.union(v.literal("spam"), v.literal("not_spam"), v.literal("unsure"))),
};

const verdictValidator = v.object({
  action: v.union(v.literal("forward"), v.literal("hold"), v.literal("notice")),
  score: v.number(),
  reasons: v.array(v.string()),
});

/** The verdict for one message: the rules, the owner's word on the sender, and the AI's opinion. */
export const verdict = internalQuery({
  args: mailArgs,
  returns: verdictValidator,
  handler: async (ctx, args) => {
    const { ai, ...fields } = args;
    const mail: MailForCheck = fields;
    const lists = await senderListsFor(ctx, args.from, args.thread);
    return verdictFor(mail, lists, ai as AiOpinion | undefined);
  },
});

/**
 * Ask the mail Worker for Cloudflare's AI opinion of a message (its /classify
 * route, the same key as /owner). Undefined when the Worker isn't set up, is slow
 * or answers anything else: the rules then decide alone.
 */
export async function aiOpinionFromWorker(mail: MailForCheck): Promise<AiOpinion | undefined> {
  const ownerUrl = process.env.OWNER_MAIL_URL;
  const key = process.env.OWNER_MAIL_KEY;
  if (!ownerUrl || !key) return undefined;
  const url = ownerUrl.replace(/\/owner\/?$/, "/classify");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-owner-mail-key": key },
      body: JSON.stringify({ from: mail.from, subject: mail.subject, text: (mail.text ?? "").slice(0, 4_000) }),
      signal: controller.signal,
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { verdict?: unknown };
    return body.verdict === "spam" || body.verdict === "not_spam" || body.verdict === "unsure" ? body.verdict : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// The admin page
// ============================================================================

const snippet = (row: Doc<"supportEmails">): string =>
  (row.bodyText || (row.bodyHtml ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 280);

const listRow = (row: Doc<"supportEmails">) => ({
  id: row._id,
  fromEmail: row.fromEmail,
  fromName: row.fromName,
  toEmail: row.toEmail,
  subject: row.subject,
  snippet: snippet(row),
  receivedAt: row.createdAt,
  heldAt: row.heldAt,
  score: row.spamScore,
  reasons: row.spamReasons ?? [],
  status: row.status,
});

const listRowValidator = v.object({
  id: v.id("supportEmails"),
  fromEmail: v.string(),
  fromName: v.optional(v.string()),
  toEmail: v.string(),
  subject: v.string(),
  snippet: v.string(),
  receivedAt: v.number(),
  heldAt: v.optional(v.number()),
  score: v.optional(v.number()),
  reasons: v.array(v.string()),
  status: v.string(),
});

/** Machine mail the recent list leaves out: DMARC reports and a service's notices. */
const isMachineMail = (row: Doc<"supportEmails">) => row.notice === true || row.toEmail.toLowerCase().startsWith("dmarc");

/**
 * Held mail, newest first, and the mail that got through lately, for the admin
 * page. SECURITY: requireAdmin; rows carry senders' addresses and words.
 */
export const forAdmin = query({
  args: {},
  returns: v.object({ held: v.array(listRowValidator), recent: v.array(listRowValidator) }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const held = await ctx.db
      .query("supportEmails")
      .withIndex("by_status", (q) => q.eq("status", "held"))
      .order("desc")
      .take(100);
    const recent: Doc<"supportEmails">[] = [];
    let scanned = 0;
    for await (const row of ctx.db.query("supportEmails").withIndex("by_created_at").order("desc")) {
      if (++scanned > 400) break;
      if (row.status === "held" || isMachineMail(row)) continue;
      recent.push(row);
      if (recent.length >= 20) break;
    }
    return { held: held.map(listRow), recent: recent.map(listRow) };
  },
});

async function setVerdict(
  ctx: { db: DatabaseWriter },
  key: string,
  verdict: "allow" | "block",
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("mailSenderVerdicts")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (existing) await ctx.db.patch(existing._id, { verdict, at: now });
  else await ctx.db.insert("mailSenderVerdicts", { key, verdict, at: now });
}

/**
 * "Not spam": send the held message to the owner now, and let this sender's mail
 * through from now on. The send runs in an action; the row reads "forwarded" once
 * it went. SECURITY: requireAdmin.
 */
export const release = mutation({
  args: { id: v.id("supportEmails") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.status !== "held") return null;
    await setVerdict(ctx, senderKey(row.fromEmail), "allow");
    await ctx.scheduler.runAfter(0, internal.inboundFilter.sendReleased, { id });
    return null;
  },
});

/** Send a released message to the owner, the reply going to the person who wrote. */
export const sendReleased = internalAction({
  args: { id: v.id("supportEmails") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row: Doc<"supportEmails"> | null = await ctx.runQuery(internal.supportEmail.getEmailById, { id });
    if (!row || row.status !== "held") return null;
    const to = getSecurityAlertEmail();
    if (!to) {
      await recordError(ctx, "action", "inboundFilter.sendReleased", new Error("no owner address configured"));
      return null;
    }
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const who = row.fromName ? `${row.fromName} <${row.fromEmail}>` : row.fromEmail;
    const text = `Let through from the held list. From ${who}, to ${row.toEmail}.\n\n${row.bodyText || "(No text content)"}`;
    const result = await sendOwnerMail(ctx, "spam-release", getResend(), {
      to,
      replyTo: row.fromEmail,
      subject: row.subject,
      text,
      html:
        `<p style="color:#555">Let through from the held list. From ${esc(who)}, to ${esc(row.toEmail)}.</p>` +
        (row.bodyHtml || `<p style="white-space:pre-wrap">${esc(row.bodyText || "(No text content)")}</p>`),
      priority: "public",
    });
    if (result.error) {
      await recordError(ctx, "action", "inboundFilter.sendReleased", new Error(`release send failed: ${JSON.stringify(result.error)}`));
      return null;
    }
    await ctx.runMutation(internal.inboundFilter.markReleased, { id });
    return null;
  },
});

export const markReleased = internalMutation({
  args: { id: v.id("supportEmails") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.status !== "held") return null;
    // heldAt goes, so the 30-day clean-up's index holds only mail still held.
    await ctx.db.patch(id, { status: "forwarded", releasedAt: Date.now(), heldAt: undefined });
    return null;
  },
});

/** "Delete": a held message the owner has read and doesn't want. SECURITY: requireAdmin. */
export const deleteHeld = mutation({
  args: { id: v.id("supportEmails") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (row?.status === "held") await ctx.db.delete(id);
    return null;
  },
});

/**
 * "Spam" on mail that got through: hold this sender's mail from now on (the
 * message itself already reached the owner's inbox). SECURITY: requireAdmin.
 */
export const markSpam = mutation({
  args: { id: v.id("supportEmails") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) return null;
    await setVerdict(ctx, senderKey(row.fromEmail), "block");
    return null;
  },
});

// ============================================================================
// Clean-up and the morning report
// ============================================================================

/** Delete held mail older than HELD_KEEP_DAYS, a bounded batch per run (convex/retention.ts runs it daily). */
export const pruneHeld = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - HELD_KEEP_DAYS * MS_PER_DAY;
    const old = await ctx.db
      .query("supportEmails")
      .withIndex("by_held_at", (q) => q.gt("heldAt", 0).lt("heldAt", cutoff))
      .take(200);
    let removed = 0;
    for (const row of old) {
      if (row.status !== "held") continue;
      await ctx.db.delete(row._id);
      removed += 1;
    }
    return removed;
  },
});

/**
 * Held in the last day, waiting in all, and the newest subjects, for the
 * morning report (convex/dailyReport.ts). A plain helper, so the report's query
 * reads it without a ctx.runQuery round.
 */
export async function heldSummary(
  ctx: QueryCtx,
  since: number,
): Promise<{ heldSince: number; waiting: number; newest: Array<{ subject: string; domain: string }> }> {
  const waitingRows = await ctx.db
    .query("supportEmails")
    .withIndex("by_status", (q) => q.eq("status", "held"))
    .order("desc")
    .take(500);
  const recent = waitingRows.filter((r) => (r.heldAt ?? 0) >= since);
  return {
    heldSince: recent.length,
    waiting: waitingRows.length,
    newest: recent.slice(0, 5).map((r) => ({
      // The report holds no address: one typed into a subject is taken out.
      subject: r.subject.replace(/\S+@\S+/g, "(an address)").slice(0, 120),
      domain: r.fromEmail.split("@")[1] ?? "",
    })),
  };
}
