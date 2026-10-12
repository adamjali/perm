/**
 * Confirmation cards the chat shows, and the one approval each allows.
 *
 * The chat proposes a change (a case update, a close, a delete) as a card. The
 * server records the card here with the exact arguments that will run, and the
 * approval route claims the card by its id and runs those stored arguments.
 * Before Oct 12 2026 the approval route ran whatever tool name and arguments the
 * browser sent, kept no record of which cards it had issued, and ran the same
 * approval as often as it was sent: one user got two cards for one change, both
 * ran, and a second tab could approve a card again.
 *
 * Rules a claim enforces:
 * - the card was issued to this user and is still waiting (or failed, which may
 *   be retried); a running, done, cancelled or expired card is refused;
 * - an identical card shown while another was waiting (`sameAs`) runs the
 *   change once, whichever of the two is approved;
 * - an identical change already made in the last 10 minutes isn't made again;
 * - a single-case card is refused once the case has changed since it was shown,
 *   because the values on it were chosen against the old case.
 */
import { v, ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUserId } from "./lib/auth";
import { rateLimiter } from "./rateLimitConfig";
import { MS_PER_DAY, MS_PER_MINUTE } from "./lib/time";

/** How long a card can be approved after it's shown. */
export const CONFIRMATION_TTL_MS = MS_PER_DAY;
/** A card claimed this long ago and never finished counts as failed. */
export const STUCK_RUN_MS = 5 * MS_PER_MINUTE;
/** An identical change made this recently isn't made again by a new card. */
export const REPEAT_WINDOW_MS = 10 * MS_PER_MINUTE;

const MAX_ARGS_CHARS = 120_000;
const MAX_DESCRIPTION_CHARS = 4_000;
const MAX_RESULT_CHARS = 2_000;

const refusal = v.object({
  ok: v.literal(false),
  reason: v.union(
    v.literal("not_found"),
    v.literal("expired"),
    v.literal("cancelled"),
    v.literal("in_progress"),
    v.literal("already_done"),
    v.literal("case_changed"),
    v.literal("case_gone"),
  ),
  message: v.string(),
  result: v.optional(v.string()),
});

async function byToolCall(
  ctx: MutationCtx,
  userId: Id<"users">,
  toolCallId: string,
): Promise<Doc<"chatConfirmations"> | null> {
  return await ctx.db
    .query("chatConfirmations")
    .withIndex("by_user_tool_call", (q) => q.eq("userId", userId).eq("toolCallId", toolCallId))
    .first();
}

/** Record a card the chat is about to show. Idempotent per toolCallId. */
export const issue = mutation({
  args: {
    toolCallId: v.string(),
    toolName: v.string(),
    args: v.string(),
    argsHash: v.string(),
    description: v.string(),
    caseId: v.optional(v.id("cases")),
    caseUpdatedAt: v.optional(v.number()),
  },
  returns: v.object({ sameAs: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (args.toolCallId.length === 0 || args.toolCallId.length > 200) throw new ConvexError("Bad card id.");
    if (args.toolName.length > 80 || args.argsHash.length > 128) throw new ConvexError("Bad card.");
    if (args.args.length > MAX_ARGS_CHARS) throw new ConvexError("That change is too large for one card.");
    const existing = await byToolCall(ctx, userId, args.toolCallId);
    if (existing) return { sameAs: existing.sameAs };
    await rateLimiter.limit(ctx, "chatConfirmationIssue", { key: userId, throws: true });

    const now = Date.now();
    let sameAs: string | undefined;
    for await (const row of ctx.db
      .query("chatConfirmations")
      .withIndex("by_user_hash", (q) => q.eq("userId", userId).eq("argsHash", args.argsHash))
      .order("desc")) {
      if (row.status === "pending" && row.expiresAt > now) {
        sameAs = row.sameAs ?? row.toolCallId;
        break;
      }
    }
    await ctx.db.insert("chatConfirmations", {
      userId,
      toolCallId: args.toolCallId,
      toolName: args.toolName,
      args: args.args,
      argsHash: args.argsHash,
      description: args.description.slice(0, MAX_DESCRIPTION_CHARS),
      caseId: args.caseId,
      caseUpdatedAt: args.caseUpdatedAt,
      status: "pending",
      sameAs,
      createdAt: now,
      expiresAt: now + CONFIRMATION_TTL_MS,
    });
    return { sameAs };
  },
});

/**
 * Claim a card for running. Returns the stored tool name and arguments, or why
 * it can't run. The caller must call `finish` afterwards.
 */
export const claim = mutation({
  args: { toolCallId: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), toolName: v.string(), args: v.string() }),
    refusal,
  ),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();
    const row = await byToolCall(ctx, userId, args.toolCallId);
    if (!row) {
      return {
        ok: false as const,
        reason: "not_found" as const,
        message: "This card isn't on record, so it can't be approved. Ask again and I'll show a new one.",
      };
    }

    const refuseFor = (r: Doc<"chatConfirmations">) => {
      if (r.status === "done") {
        return { ok: false as const, reason: "already_done" as const, message: "This change was already made.", result: r.result };
      }
      if (r.status === "cancelled") {
        return { ok: false as const, reason: "cancelled" as const, message: "This card was cancelled." };
      }
      if (r.status === "running" && r.claimedAt !== undefined && now - r.claimedAt < STUCK_RUN_MS) {
        return { ok: false as const, reason: "in_progress" as const, message: "This change is already running." };
      }
      return null;
    };

    const own = refuseFor(row);
    if (own) return own;
    if (row.expiresAt <= now) {
      await ctx.db.patch(row._id, { status: "cancelled", result: "Expired before it was approved.", finishedAt: now });
      return {
        ok: false as const,
        reason: "expired" as const,
        message: "This card expired. Ask again and I'll check the case and show a new one.",
      };
    }

    // An identical card was waiting when this one was shown: one approval only.
    if (row.sameAs) {
      const first = await byToolCall(ctx, userId, row.sameAs);
      if (first && first._id !== row._id) {
        if (first.status === "done") {
          await ctx.db.patch(row._id, { status: "done", result: first.result, finishedAt: now });
          return { ok: false as const, reason: "already_done" as const, message: "This change was already made.", result: first.result };
        }
        const firstBusy = refuseFor(first);
        if (firstBusy && firstBusy.reason === "in_progress") return firstBusy;
        if (first.status !== "cancelled") {
          await ctx.db.patch(first._id, {
            status: "cancelled",
            result: "Replaced by an identical card that was approved.",
            finishedAt: now,
          });
        }
      }
    }
    return await claimRow();

    async function claimRow() {
      // The same change made moments ago by another card isn't made again.
      for await (const other of ctx.db
        .query("chatConfirmations")
        .withIndex("by_user_hash", (q) => q.eq("userId", userId).eq("argsHash", row!.argsHash))
        .order("desc")) {
        if (other._id === row!._id) continue;
        if (other.status === "done" && other.finishedAt !== undefined && now - other.finishedAt < REPEAT_WINDOW_MS) {
          await ctx.db.patch(row!._id, { status: "done", result: other.result, finishedAt: now });
          return {
            ok: false as const,
            reason: "already_done" as const,
            message: "The same change was made a few minutes ago, so it wasn't made again.",
            result: other.result,
          };
        }
        if ((other.finishedAt ?? other.createdAt) < now - REPEAT_WINDOW_MS) break;
      }

      if (row!.caseId !== undefined) {
        const caseDoc = await ctx.db.get(row!.caseId);
        if (!caseDoc || caseDoc.userId !== userId || caseDoc.deletedAt !== undefined) {
          await ctx.db.patch(row!._id, { status: "cancelled", result: "The case no longer exists.", finishedAt: now });
          return { ok: false as const, reason: "case_gone" as const, message: "That case no longer exists." };
        }
        if (row!.caseUpdatedAt !== undefined && caseDoc.updatedAt !== row!.caseUpdatedAt) {
          await ctx.db.patch(row!._id, {
            status: "cancelled",
            result: "The case changed after the card was shown.",
            finishedAt: now,
          });
          return {
            ok: false as const,
            reason: "case_changed" as const,
            message: "The case changed after this card was shown. Ask again and I'll check the new values first.",
          };
        }
      }

      await ctx.db.patch(row!._id, { status: "running", claimedAt: now });
      return { ok: true as const, toolName: row!.toolName, args: row!.args };
    }
  },
});

/** Record how a claimed card ended. A failed card can be approved again. */
export const finish = mutation({
  args: { toolCallId: v.string(), ok: v.boolean(), result: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = await byToolCall(ctx, userId, args.toolCallId);
    if (!row || row.status !== "running") return null;
    await ctx.db.patch(row._id, {
      status: args.ok ? "done" : "failed",
      result: args.result.slice(0, MAX_RESULT_CHARS),
      finishedAt: Date.now(),
    });
    return null;
  },
});

/** The person cancelled the card. Only a waiting or failed card can be cancelled. */
export const cancel = mutation({
  args: { toolCallId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const row = await byToolCall(ctx, userId, args.toolCallId);
    if (!row || (row.status !== "pending" && row.status !== "failed")) return null;
    await ctx.db.patch(row._id, { status: "cancelled", result: "Cancelled.", finishedAt: Date.now() });
    return null;
  },
});
