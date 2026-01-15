/**
 * Conversation Summarization Module
 *
 * Provides functions for managing conversation context compression through summarization.
 * When conversations exceed a message threshold, older messages are summarized to reduce
 * token usage while preserving important context.
 *
 * Architecture:
 * - Messages 1 to N-RECENT_MESSAGES_TO_KEEP are summarized
 * - Most recent RECENT_MESSAGES_TO_KEEP messages are kept verbatim
 * - Summary is stored on the conversation record
 * - Context for LLM = summary + recent messages
 *
 * @module convex/conversationSummary
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId } from "./lib/auth";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Number of messages that triggers summarization.
 * When message count exceeds this, summarization is triggered.
 */
export const SUMMARY_TRIGGER_MESSAGE_COUNT = 12;

/**
 * Number of recent messages to keep verbatim (not summarized).
 * These are the most recent messages that provide immediate context.
 */
export const RECENT_MESSAGES_TO_KEEP = 6;

/**
 * System prompt for the summarization LLM.
 * Instructs the model to create a concise, context-preserving summary.
 */
export const SUMMARIZATION_PROMPT = `You are a conversation summarizer for a PERM immigration case tracking assistant.

Summarize the following conversation history, preserving:
1. Key questions the user asked and their answers
2. Important case details mentioned (employer names, beneficiary names, dates, statuses)
3. Any action items or decisions made
4. Tool calls and their results (what data was queried/found)

Format: Write a brief narrative summary (2-4 paragraphs) that captures the essential context.
Focus on information that would be relevant for continuing the conversation.

Do NOT include:
- Pleasantries or greetings
- Redundant information
- Verbatim quotes unless critical

Keep the summary under 500 words.`;

// =============================================================================
// PUBLIC QUERIES (with auth)
// =============================================================================

/**
 * Check if a conversation needs summarization
 *
 * Returns true if:
 * 1. Message count > SUMMARY_TRIGGER_MESSAGE_COUNT
 * 2. Messages since last summary > SUMMARY_TRIGGER_MESSAGE_COUNT
 *
 * Verifies the user owns the conversation before checking.
 */
export const needsSummarization = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await getCurrentUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return false;
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      return false;
    }

    // Get total message count
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const messageCount = messages.length;

    // If we haven't hit the threshold, no summarization needed
    if (messageCount <= SUMMARY_TRIGGER_MESSAGE_COUNT) {
      return false;
    }

    // If no summary exists yet, we need one
    if (!conversation.summary) {
      return true;
    }

    // Check if enough new messages have accumulated since last summary
    const messagesSinceSummary =
      messageCount - conversation.summary.messageCountAtSummary;

    return messagesSinceSummary >= SUMMARY_TRIGGER_MESSAGE_COUNT;
  },
});

/**
 * Get optimized context for the LLM
 *
 * Returns the summary (if exists) plus the most recent messages.
 * This is what gets sent to the LLM instead of full message history.
 *
 * Verifies the user owns the conversation before returning data.
 */
export const getContextMessages = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    summary: string | null;
    recentMessages: Array<{
      role: "user" | "assistant" | "system";
      content: string;
    }>;
    totalMessageCount: number;
  }> => {
    const userId = await getCurrentUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return { summary: null, recentMessages: [], totalMessageCount: 0 };
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      return { summary: null, recentMessages: [], totalMessageCount: 0 };
    }

    // Get all messages sorted by creation time
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const sortedMessages = messages.sort((a, b) => a.createdAt - b.createdAt);
    const totalMessageCount = sortedMessages.length;

    // Get the most recent messages
    const recentMessages = sortedMessages
      .slice(-RECENT_MESSAGES_TO_KEEP)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    return {
      summary: conversation.summary?.content ?? null,
      recentMessages,
      totalMessageCount,
    };
  },
});

/**
 * Get messages that need to be summarized
 *
 * Returns messages from the last summary point to current - RECENT_MESSAGES_TO_KEEP.
 * These messages will be compressed into the summary.
 *
 * Verifies the user owns the conversation before returning data.
 */
export const getMessagesToSummarize = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    messages: Array<{
      role: "user" | "assistant" | "system";
      content: string;
      toolCalls?: Array<{
        tool: string;
        arguments: string;
        result?: string;
      }>;
    }>;
    existingSummary: string | null;
    totalMessageCount: number;
  }> => {
    const userId = await getCurrentUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return { messages: [], existingSummary: null, totalMessageCount: 0 };
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      return { messages: [], existingSummary: null, totalMessageCount: 0 };
    }

    // Get all messages sorted by creation time
    const allMessages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const sortedMessages = allMessages.sort((a, b) => a.createdAt - b.createdAt);
    const totalMessageCount = sortedMessages.length;

    // Determine the starting point for summarization
    const lastSummarizedCount = conversation.summary?.messageCountAtSummary ?? 0;

    // Get messages from lastSummarizedCount to totalMessageCount - RECENT_MESSAGES_TO_KEEP
    // These are the new messages that need to be added to the summary
    const endIndex = totalMessageCount - RECENT_MESSAGES_TO_KEEP;
    const startIndex = lastSummarizedCount;

    if (endIndex <= startIndex) {
      // Not enough new messages to summarize
      return {
        messages: [],
        existingSummary: conversation.summary?.content ?? null,
        totalMessageCount,
      };
    }

    const messagesToSummarize = sortedMessages.slice(startIndex, endIndex).map((m) => ({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls?.map((tc) => ({
        tool: tc.tool,
        arguments: tc.arguments,
        result: tc.result,
      })),
    }));

    return {
      messages: messagesToSummarize,
      existingSummary: conversation.summary?.content ?? null,
      totalMessageCount,
    };
  },
});

// =============================================================================
// PUBLIC MUTATIONS (with auth)
// =============================================================================

/**
 * Save a summary to a conversation
 *
 * Updates the conversation record with the new summary.
 * Verifies the user owns the conversation before updating.
 */
export const saveSummary = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    tokenCount: v.number(),
    messageCountAtSummary: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await getCurrentUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      throw new Error("Access denied: you do not own this conversation");
    }

    await ctx.db.patch(args.conversationId, {
      summary: {
        content: args.content,
        tokenCount: args.tokenCount,
        messageCountAtSummary: args.messageCountAtSummary,
        lastSummarizedAt: Date.now(),
      },
    });
  },
});

/**
 * Get conversation with summary info
 *
 * Returns the conversation's summary metadata.
 * Verifies the user owns the conversation before returning data.
 */
export const getConversationSummary = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    // Verify ownership
    if (conversation.userId !== userId) {
      return null;
    }

    const messageCount = await ctx.db
      .query("conversationMessages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect()
      .then((msgs) => msgs.length);

    return {
      id: conversation._id,
      summary: conversation.summary,
      messageCount,
    };
  },
});
