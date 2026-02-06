/**
 * Conversation Messages CRUD Operations
 *
 * This module provides mutations and queries for managing chatbot conversation messages.
 * All operations verify user ownership of the parent conversation to ensure data isolation.
 *
 * Key features:
 * - Message creation for user and assistant roles
 * - Auto-title generation from first user message
 * - Message listing with proper sort order (oldest first for chat display)
 * - Conversation resumption support (getMostRecent)
 *
 * @module convex/conversationMessages
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId } from "./lib/auth";

/**
 * Truncate a string to a maximum length, adding ellipsis if truncated.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation (default: 50)
 * @returns The truncated string with '...' if it was too long
 */
function truncateTitle(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + "...";
}

/**
 * Create a user message in a conversation
 *
 * Creates a message with role='user' and updates the conversation's
 * updatedAt and metadata.lastActiveAt timestamps.
 *
 * @param conversationId - The conversation to add the message to
 * @param content - The message content
 * @returns The ID of the newly created message
 * @throws Error if user doesn't own the conversation
 *
 * @example
 * ```typescript
 * const messageId = await ctx.runMutation(api.conversationMessages.createUserMessage, {
 *   conversationId,
 *   content: "What are my upcoming deadlines?"
 * });
 * ```
 */
export const createUserMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    // Verify conversation ownership
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.userId !== userId) {
      throw new Error("Access denied: you do not own this conversation");
    }

    // Create the message
    const messageId = await ctx.db.insert("conversationMessages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      createdAt: now,
    });

    // Update conversation timestamps
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      metadata: {
        ...conversation.metadata,
        lastActiveAt: now,
      },
    });

    return messageId;
  },
});

/**
 * Create an assistant message in a conversation
 *
 * Creates a message with role='assistant' and updates the conversation's
 * updatedAt timestamp. Auto-generates a title from the first user message
 * if the conversation still has the default "New Conversation" title after
 * the second message (first AI response).
 *
 * @param conversationId - The conversation to add the message to
 * @param content - The message content
 * @param toolCalls - Optional array of tool calls made by the assistant
 * @param metadata - Optional metadata (model, processingTimeMs, tokenCount, citations)
 * @returns The ID of the newly created message
 * @throws Error if user doesn't own the conversation
 *
 * @example
 * ```typescript
 * const messageId = await ctx.runMutation(api.conversationMessages.createAssistantMessage, {
 *   conversationId,
 *   content: "You have 3 upcoming deadlines...",
 *   metadata: {
 *     model: "gemini-2.0-flash",
 *     processingTimeMs: 1234,
 *     tokenCount: 456
 *   }
 * });
 * ```
 */
export const createAssistantMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    toolCalls: v.optional(
      v.array(
        v.object({
          tool: v.string(),
          arguments: v.string(),
          result: v.optional(v.string()),
          status: v.optional(
            v.union(
              v.literal("pending"),
              v.literal("success"),
              v.literal("error")
            )
          ),
          executedAt: v.optional(v.number()),
        })
      )
    ),
    metadata: v.optional(
      v.object({
        citations: v.optional(
          v.array(
            v.object({
              caseId: v.optional(v.id("cases")),
              field: v.optional(v.string()),
              value: v.optional(v.string()),
            })
          )
        ),
        processingTimeMs: v.optional(v.number()),
        model: v.optional(v.string()),
        tokenCount: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    // Verify conversation ownership
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.userId !== userId) {
      throw new Error("Access denied: you do not own this conversation");
    }

    // Create the message
    const messageId = await ctx.db.insert("conversationMessages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: args.content,
      toolCalls: args.toolCalls,
      metadata: args.metadata,
      createdAt: now,
    });

    // Update conversation timestamp
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
    });

    // Auto-title generation logic:
    // If this is the second message (first AI response after user message)
    // and title is still "New Conversation", generate title from first user message
    if (conversation.title === "New Conversation") {
      const messages = await ctx.db
        .query("conversationMessages")
        .withIndex("by_conversation_id", (q) =>
          q.eq("conversationId", args.conversationId)
        )
        .collect();

      // Count is now 2 (including the message we just created)
      // Note: We count after insert, so the new message is already in the count
      if (messages.length === 2) {
        // Find the first user message
        const firstUserMessage = messages
          .sort((a, b) => a.createdAt - b.createdAt)
          .find((m) => m.role === "user");

        if (firstUserMessage) {
          const newTitle = truncateTitle(firstUserMessage.content, 50);
          await ctx.db.patch(args.conversationId, {
            title: newTitle,
          });
        }
      }
    }

    return messageId;
  },
});

/**
 * List all messages in a conversation
 *
 * Returns messages sorted by createdAt ascending (oldest first) for
 * proper chat display order. Returns an empty array if the conversation
 * doesn't exist or the user doesn't own it (security: don't reveal existence).
 *
 * @param conversationId - The conversation to list messages for
 * @returns Array of message documents sorted oldest-first
 *
 * @example
 * ```typescript
 * const messages = await ctx.runQuery(api.conversationMessages.list, {
 *   conversationId
 * });
 *
 * for (const message of messages) {
 *   console.log(`${message.role}: ${message.content}`);
 * }
 * ```
 */
export const list = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Verify conversation ownership
    const conversation = await ctx.db.get(args.conversationId);

    // Return empty array if not found or not owned (security: don't reveal existence)
    if (!conversation) {
      return [];
    }

    if (conversation.userId !== userId) {
      return [];
    }

    // Get all messages for this conversation
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    // Sort by createdAt ascending (oldest first for chat display)
    return messages.sort((a, b) => a.createdAt - b.createdAt);
  },
});

/**
 * Count messages in a conversation
 *
 * Returns the total number of messages in a conversation.
 * Returns 0 if the conversation doesn't exist or the user doesn't own it.
 *
 * @param conversationId - The conversation to count messages for
 * @returns The number of messages
 *
 * @example
 * ```typescript
 * const messageCount = await ctx.runQuery(api.conversationMessages.count, {
 *   conversationId
 * });
 *
 * console.log(`Conversation has ${messageCount} messages`);
 * ```
 */
export const count = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Verify conversation ownership
    const conversation = await ctx.db.get(args.conversationId);

    // Return 0 if not found or not owned (security: don't reveal existence)
    if (!conversation) {
      return 0;
    }

    if (conversation.userId !== userId) {
      return 0;
    }

    // Count messages
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    return messages.length;
  },
});

/**
 * Get the most recently updated non-archived conversation
 *
 * Used for "resume conversation" UX - allows users to continue
 * their most recent conversation. Returns null if no non-archived
 * conversations exist.
 *
 * @returns The most recently updated non-archived conversation or null
 *
 * @example
 * ```typescript
 * const lastConversation = await ctx.runQuery(api.conversationMessages.getMostRecent, {});
 *
 * if (lastConversation) {
 *   // Resume this conversation
 *   navigateTo(`/chat/${lastConversation._id}`);
 * } else {
 *   // No recent conversations, start fresh
 *   const newId = await createConversation();
 *   navigateTo(`/chat/${newId}`);
 * }
 * ```
 */
export const getMostRecent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    if (conversations.length === 0) {
      return null;
    }

    // Find the most recently updated
    return conversations.reduce((mostRecent, current) =>
      current.updatedAt > mostRecent.updatedAt ? current : mostRecent
    );
  },
});

/**
 * Update a tool call's result and status after execution
 *
 * This is called after a user approves/denies a tool confirmation to persist
 * the execution result back to the database. This ensures that on page refresh,
 * the tool shows as executed rather than asking for confirmation again.
 *
 * The tool call is identified by matching the toolCallId embedded in the
 * original permission request result.
 *
 * @param conversationId - The conversation containing the message
 * @param toolCallId - The unique tool call ID from the AI SDK
 * @param result - The new result JSON string (execution result or denial marker)
 * @param status - The new status ('success', 'error', or 'pending' for denied)
 * @returns true if updated successfully, false if tool call not found
 *
 * @example
 * ```typescript
 * // After tool execution succeeds
 * await ctx.runMutation(api.conversationMessages.updateToolCallResult, {
 *   conversationId,
 *   toolCallId: "call_abc123",
 *   result: JSON.stringify({ success: true, caseId: "xyz" }),
 *   status: "success"
 * });
 *
 * // After user denies a tool
 * await ctx.runMutation(api.conversationMessages.updateToolCallResult, {
 *   conversationId,
 *   toolCallId: "call_abc123",
 *   result: JSON.stringify({ denied: true, deniedAt: Date.now() }),
 *   status: "error"
 * });
 * ```
 */
export const updateToolCallResult = mutation({
  args: {
    conversationId: v.id("conversations"),
    toolCallId: v.string(),
    result: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("error")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Verify conversation ownership
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.userId !== userId) {
      throw new Error("Access denied: you do not own this conversation");
    }

    // Find the message containing this tool call
    // We search for messages with toolCalls that contain the toolCallId in their result
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    console.log(
      `[updateToolCallResult] Searching for toolCallId: ${args.toolCallId} in ${messages.length} messages`
    );

    // Track what we find for debugging
    const foundToolCallIds: string[] = [];

    // Find the message and tool call index
    for (const message of messages) {
      if (!message.toolCalls) continue;

      for (let i = 0; i < message.toolCalls.length; i++) {
        const toolCall = message.toolCalls[i];
        if (!toolCall || !toolCall.result) continue;

        // Check if this tool call's result contains the toolCallId
        // The permission request is stored as JSON: { requiresPermission: true, toolCallId: "...", ... }
        try {
          const parsedResult = JSON.parse(toolCall.result);
          if (parsedResult.requiresPermission === true && parsedResult.toolCallId) {
            foundToolCallIds.push(parsedResult.toolCallId);
          }
          if (
            parsedResult.requiresPermission === true &&
            parsedResult.toolCallId === args.toolCallId
          ) {
            // Found the tool call - update it
            console.log(
              `[updateToolCallResult] Found match! Updating tool call ${toolCall.tool} in message ${message._id}`
            );
            const updatedToolCalls = [...message.toolCalls];
            updatedToolCalls[i] = {
              tool: toolCall.tool,
              arguments: toolCall.arguments,
              result: args.result,
              status: args.status,
              executedAt: Date.now(),
            };

            await ctx.db.patch(message._id, {
              toolCalls: updatedToolCalls,
            });

            console.log(
              `[updateToolCallResult] Successfully updated to status: ${args.status}`
            );
            return true;
          }
        } catch {
          // Not valid JSON, skip
          continue;
        }
      }
    }

    // Tool call not found - log diagnostic info
    console.warn(
      `[updateToolCallResult] Tool call NOT found. Looking for: ${args.toolCallId}, found these toolCallIds: ${JSON.stringify(foundToolCallIds)}`
    );

    // Tool call not found - this can happen if the message hasn't been persisted yet
    // or if the toolCallId doesn't match. Return false rather than throwing.
    return false;
  },
});
