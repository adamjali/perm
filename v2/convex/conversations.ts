/**
 * Conversation CRUD Operations
 *
 * This module provides mutations and queries for managing chatbot conversations.
 * All operations verify user ownership to ensure data isolation.
 *
 * @module convex/conversations
 */

import { internalMutation, query, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { CHAT_LIMITS, MESSAGE_READ_CAP } from "./lib/chatLimits";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { logDelete } from "./lib/audit";
import { validateStringLength, INPUT_LIMITS } from "./lib/validation";
import { rateLimiter } from "./rateLimitConfig";

/**
 * Create a new conversation
 *
 * @param title - Optional conversation title (defaults to 'New Conversation')
 * @param metadata - Optional metadata object with relatedCaseId, conversationType, tags
 * @returns The ID of the newly created conversation
 *
 * @example
 * ```typescript
 * const conversationId = await ctx.runMutation(api.conversations.create, {
 *   title: 'Case Question',
 *   metadata: { conversationType: 'case_inquiry', relatedCaseId: caseId }
 * });
 * ```
 */
export const create = mutation({
  args: {
    title: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        relatedCaseId: v.optional(v.id("cases")),
        conversationType: v.optional(
          v.union(
            v.literal("general"),
            v.literal("case_inquiry"),
            v.literal("deadline_help"),
            v.literal("document_help")
          )
        ),
        lastActiveAt: v.optional(v.number()),
        tags: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    await rateLimiter.limit(ctx, "conversationCreate", { key: userId, throws: true });
    const now = Date.now();

    // Input validation
    validateStringLength(args.title, "Conversation title", INPUT_LIMITS.SHORT);

    // Build metadata with defaults
    const metadata = {
      conversationType: args.metadata?.conversationType ?? ("general" as const),
      lastActiveAt: args.metadata?.lastActiveAt ?? now,
      tags: args.metadata?.tags ?? [],
      relatedCaseId: args.metadata?.relatedCaseId,
    };

    const conversationId = await ctx.db.insert("conversations", {
      userId: userId,
      title: args.title ?? "New Conversation",
      isArchived: false,
      metadata,
      createdAt: now,
      updatedAt: now,
    });

    return conversationId;
  },
});

/**
 * Get a single conversation by ID
 *
 * Returns null if conversation is not found or user doesn't own it.
 * This prevents information leakage about other users' conversations.
 *
 * @param id - The conversation ID to retrieve
 * @returns The conversation document or null
 *
 * @example
 * ```typescript
 * const conversation = await ctx.runQuery(api.conversations.get, { id: conversationId });
 * if (conversation) {
 *   console.log(conversation.title);
 * }
 * ```
 */
export const get = query({
  args: {
    id: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) return null;

    const conversation = await ctx.db.get(args.id);

    // Return null if not found or not owned (security: don't reveal existence)
    if (!conversation) {
      return null;
    }

    if (conversation.userId !== userId) {
      return null;
    }

    return conversation;
  },
});

/**
 * List user's conversations
 *
 * Returns conversations sorted by updatedAt descending (most recent first).
 *
 * @returns Array of conversation documents
 *
 * @example
 * ```typescript
 * const conversations = await ctx.runQuery(api.conversations.list, {});
 * ```
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) return [];

    // The newest CHAT_LIMITS.conversationsListed, newest first (the panel says
    // when it shows only these). Each conversation's
    // summary (up to ~1,000 tokens, written by compaction) stays out: the
    // history panel shows the title and the time, and this list grows with
    // every conversation the person starts. The chat reads the summary through
    // conversationSummary.getContextMessages.
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_and_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(CHAT_LIMITS.conversationsListed);
    return conversations.map(({ summary: _summary, ...rest }) => rest);
  },
});

/**
 * Delete one conversation's messages and cached tool answers, then the
 * conversation. Returns how many messages it held.
 */
async function purgeConversation(ctx: MutationCtx, conversation: Doc<"conversations">): Promise<number> {
  const messages = await ctx.db
    .query("conversationMessages")
    .withIndex("by_conversation_id", (q) => q.eq("conversationId", conversation._id))
    .take(MESSAGE_READ_CAP);
  for (const message of messages) {
    await ctx.db.delete(message._id);
  }
  // Cached tool answers (case lists, searches) hold the conversation's data too.
  const cached = await ctx.db
    .query("toolCache")
    .withIndex("by_conversation_tool_hash", (q) => q.eq("conversationId", conversation._id))
    // Bounded; anything past it expires on its own (toolCache by_expires).
    .take(2_000);
  for (const row of cached) {
    await ctx.db.delete(row._id);
  }
  await ctx.db.delete(conversation._id);
  return messages.length;
}

/**
 * Permanently delete a conversation and all its messages
 *
 * This is a destructive operation that cannot be undone.
 * All messages in the conversation will also be deleted.
 *
 * @param id - The conversation ID to delete
 * @throws Error if user doesn't own the conversation
 *
 * @example
 * ```typescript
 * await ctx.runMutation(api.conversations.deleteConversation, { id: conversationId });
 * ```
 */
export const deleteConversation = mutation({
  args: {
    id: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const conversation = await ctx.db.get(args.id);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.userId !== userId) {
      throw new Error("Access denied: you do not own this conversation");
    }

    const messageCount = await purgeConversation(ctx, conversation);

    // Audit: that it was deleted and how big it was. Never its title (the
    // first words of the first message) or its summary: audit logs are kept
    // indefinitely, and a delete must not leave the words behind.
    await logDelete(ctx, "conversations", args.id, {
      messageCount,
      hadSummary: conversation.summary !== undefined,
      createdAt: conversation.createdAt,
    });
  },
});

/** Conversations deleted per transaction by deleteAll; the rest follow. */
const DELETE_ALL_BATCH = 10;

async function deleteAllBatch(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ deleted: number; more: boolean; firstId?: Id<"conversations"> }> {
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(DELETE_ALL_BATCH + 1);
  const batch = conversations.slice(0, DELETE_ALL_BATCH);
  for (const conversation of batch) {
    await purgeConversation(ctx, conversation);
  }
  const more = conversations.length > DELETE_ALL_BATCH;
  if (more) {
    await ctx.scheduler.runAfter(0, internal.conversations.deleteAllRest, { userId });
  }
  return { deleted: batch.length, more, firstId: batch[0]?._id };
}

/**
 * Permanently delete all conversations and their messages for the current user
 *
 * This is a destructive operation that cannot be undone. The first
 * DELETE_ALL_BATCH go in this call; the rest follow in scheduled batches, so a
 * long history can't run past one transaction's limits.
 *
 * @returns Number of conversations deleted in this call
 */
export const deleteAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const { deleted, more, firstId } = await deleteAllBatch(ctx, userId);

    // Audit: one summarized entry, counts only.
    if (firstId) {
      await logDelete(ctx, "conversations", firstId, {
        batchDelete: true,
        deletedNow: deleted,
        more,
      });
    }

    return deleted;
  },
});

/** The rest of a deleteAll, one batch at a time. */
export const deleteAllRest = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await deleteAllBatch(ctx, args.userId);
  },
});
