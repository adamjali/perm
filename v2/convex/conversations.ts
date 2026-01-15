/**
 * Conversation CRUD Operations
 *
 * This module provides mutations and queries for managing chatbot conversations.
 * All operations verify user ownership to ensure data isolation.
 *
 * @module convex/conversations
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getCurrentUserId } from "./lib/auth";

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
    const now = Date.now();

    // Build metadata with defaults
    const metadata = {
      conversationType: args.metadata?.conversationType ?? ("general" as const),
      lastActiveAt: args.metadata?.lastActiveAt ?? now,
      tags: args.metadata?.tags ?? [],
      relatedCaseId: args.metadata?.relatedCaseId,
    };

    const conversationId = await ctx.db.insert("conversations", {
      userId: userId as Id<"users">,
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
    const userId = await getCurrentUserId(ctx);

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
    const userId = await getCurrentUserId(ctx);

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .collect();

    // Sort by updatedAt descending (most recent first)
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Update conversation title
 *
 * @param id - The conversation ID to update
 * @param title - The new title
 * @throws Error if user doesn't own the conversation
 *
 * @example
 * ```typescript
 * await ctx.runMutation(api.conversations.updateTitle, {
 *   id: conversationId,
 *   title: 'PWD Deadline Question'
 * });
 * ```
 */
export const updateTitle = mutation({
  args: {
    id: v.id("conversations"),
    title: v.string(),
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

    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

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

    // Delete all messages in this conversation
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_conversation_id", (q) => q.eq("conversationId", args.id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the conversation itself
    await ctx.db.delete(args.id);
  },
});

/**
 * Permanently delete all conversations and their messages for the current user
 *
 * This is a destructive operation that cannot be undone.
 *
 * @returns Number of conversations deleted
 *
 * @example
 * ```typescript
 * const count = await ctx.runMutation(api.conversations.deleteAll, {});
 * console.log(`Deleted ${count} conversations`);
 * ```
 */
export const deleteAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    // Get all conversations for user
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .collect();

    // Delete each conversation and its messages
    for (const conversation of conversations) {
      // Delete all messages in this conversation
      const messages = await ctx.db
        .query("conversationMessages")
        .withIndex("by_conversation_id", (q) =>
          q.eq("conversationId", conversation._id)
        )
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // Delete the conversation itself
      await ctx.db.delete(conversation._id);
    }

    return conversations.length;
  },
});
