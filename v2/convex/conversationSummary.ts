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
 * - Context for LLM = summary/facts envelope + the CLIENT-SUPPLIED message
 *   history (compacted in the route, see src/app/api/chat/route.ts). The server
 *   no longer returns a "recent messages" window: getContextMessages exposes
 *   only the summary + facts envelope, and the client message array is the
 *   source of truth for the verbatim tail.
 *
 * @module convex/conversationSummary
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Approximate character-to-token ratio used for token estimation.
 * Matches the pattern used in `src/lib/ai/compaction.ts` for consistency.
 */
const CHARS_PER_TOKEN = 3.5;

/**
 * Token-based summarization trigger.
 * When the total estimated tokens of un-summarized messages exceeds this,
 * a new summarization cycle should run.
 */
export const SUMMARY_TRIGGER_TOKEN_COUNT = 8000;

/**
 * Legacy message-count trigger (kept for backward compatibility in logs/metrics).
 * The token-based trigger above takes precedence. This is a safety floor.
 */
export const SUMMARY_TRIGGER_MESSAGE_COUNT = 12;

/**
 * Number of recent messages to keep verbatim (not summarized).
 * These are the most recent messages that provide immediate context.
 * Increased from 4 → 10: AI SDK research (LangChain, LlamaIndex, Anthropic cookbook)
 * converges on 10–20 as the right verbatim-keep window for preserving immediate context.
 */
export const RECENT_MESSAGES_TO_KEEP = 10;

/**
 * How long a summarization lock remains honored. After this, a stale lock
 * is ignored (we assume the prior attempt crashed).
 */
export const SUMMARIZATION_LOCK_TTL_MS = 60_000;

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
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) return false;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return false;
    if (conversation.userId !== userId) return false;

    // Race protection: if a summarization is in progress (and fresh), skip.
    // Stale locks (>60s) are treated as abandoned and allowed to be claimed.
    const summarizingAt = conversation.summary?.summarizingAt;
    if (
      summarizingAt &&
      Date.now() - summarizingAt < SUMMARIZATION_LOCK_TTL_MS
    ) {
      return false;
    }

    // Get all messages for this conversation
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    // Fast reject: too few messages to bother summarizing.
    // Avoids summarization cycles on short conversations regardless of content size.
    if (messages.length <= SUMMARY_TRIGGER_MESSAGE_COUNT) {
      return false;
    }

    // Token-based trigger: estimate tokens in the un-summarized tail.
    // Use messages AFTER the last summary point (if any).
    const lastSummarizedCount = conversation.summary?.messageCountAtSummary ?? 0;
    const sortedMessages = messages.sort((a, b) => a.createdAt - b.createdAt);
    const unsummarizedTail = sortedMessages.slice(lastSummarizedCount);

    let estimatedTokens = 0;
    for (const m of unsummarizedTail) {
      estimatedTokens += Math.ceil((m.content?.length ?? 0) / CHARS_PER_TOKEN);
      // Tool calls/results also consume tokens
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          estimatedTokens += Math.ceil(
            ((tc.arguments?.length ?? 0) + (tc.result?.length ?? 0)) / CHARS_PER_TOKEN
          );
        }
      }
    }

    return estimatedTokens >= SUMMARY_TRIGGER_TOKEN_COUNT;
  },
});

/**
 * Get the LLM context envelope for a conversation: the prose summary + facts
 * (if any) and message counts used to position the compaction divider.
 *
 * CONTRACT (changed): this NO LONGER returns a server-side "recent messages"
 * window. The chat route compacts the CLIENT-SUPPLIED message history (the
 * untrusted request body) and prepends this summary/facts envelope, so the
 * client array — not the server — is the source of truth for the verbatim tail.
 * Returning a recent window here would be dead, desynced compute.
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
    facts: string | null;
    totalMessageCount: number;
    messageCountAtSummary: number;
  }> => {
    const empty = {
      summary: null,
      facts: null,
      totalMessageCount: 0,
      messageCountAtSummary: 0,
    };
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) return empty;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return empty;
    if (conversation.userId !== userId) return empty;

    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    return {
      summary: conversation.summary?.content ?? null,
      facts: conversation.summary?.facts ?? null,
      totalMessageCount: messages.length,
      messageCountAtSummary: conversation.summary?.messageCountAtSummary ?? 0,
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
    existingFacts: string | null;
    totalMessageCount: number;
  }> => {
    const empty = {
      messages: [],
      existingSummary: null,
      existingFacts: null,
      totalMessageCount: 0,
    };
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) return empty;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return empty;
    if (conversation.userId !== userId) return empty;

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
        existingFacts: conversation.summary?.facts ?? null,
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
      existingFacts: conversation.summary?.facts ?? null,
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
    facts: v.optional(v.string()),
    tokenCount: v.number(),
    messageCountAtSummary: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await getCurrentUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.userId !== userId) {
      throw new Error("Access denied: you do not own this conversation");
    }

    await ctx.db.patch(args.conversationId, {
      summary: {
        content: args.content,
        ...(args.facts !== undefined && { facts: args.facts }),
        tokenCount: args.tokenCount,
        messageCountAtSummary: args.messageCountAtSummary,
        lastSummarizedAt: Date.now(),
        // Clear any in-progress lock on successful save.
        // summarizingAt deliberately omitted to clear via patch semantics.
      },
    });
  },
});

/**
 * Atomically claim a summarization lock on a conversation.
 *
 * Returns true if the lock was acquired (caller should proceed to summarize).
 * Returns false if another process already holds a fresh lock.
 *
 * The lock stores a timestamp. Stale locks (>60s) are considered abandoned
 * and can be claimed — this protects against crashed processes.
 *
 * On success, the caller MUST call `finishSummarizing` (or `saveSummary`,
 * which clears the lock) to release the lock.
 */
export const beginSummarizing = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await getCurrentUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return false;
    if (conversation.userId !== userId) return false;

    const currentLock = conversation.summary?.summarizingAt;
    const now = Date.now();
    const isLocked =
      currentLock !== undefined &&
      now - currentLock < SUMMARIZATION_LOCK_TTL_MS;

    if (isLocked) return false;

    // Acquire the lock by preserving existing summary fields and setting summarizingAt.
    const prevSummary = conversation.summary;
    await ctx.db.patch(args.conversationId, {
      summary: {
        content: prevSummary?.content ?? "",
        ...(prevSummary?.facts !== undefined && { facts: prevSummary.facts }),
        tokenCount: prevSummary?.tokenCount ?? 0,
        messageCountAtSummary: prevSummary?.messageCountAtSummary ?? 0,
        lastSummarizedAt: prevSummary?.lastSummarizedAt ?? 0,
        summarizingAt: now,
      },
    });
    return true;
  },
});

/**
 * Release the summarization lock without updating the summary content.
 * Called when summarization fails or is aborted — ensures the lock doesn't
 * linger until the 60s TTL expires.
 */
export const finishSummarizing = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await getCurrentUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;
    if (conversation.userId !== userId) return;

    const prevSummary = conversation.summary;
    if (!prevSummary) return;

    await ctx.db.patch(args.conversationId, {
      summary: {
        content: prevSummary.content,
        ...(prevSummary.facts !== undefined && { facts: prevSummary.facts }),
        tokenCount: prevSummary.tokenCount,
        messageCountAtSummary: prevSummary.messageCountAtSummary,
        lastSummarizedAt: prevSummary.lastSummarizedAt,
        // summarizingAt omitted — cleared via patch
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
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) return null;

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
