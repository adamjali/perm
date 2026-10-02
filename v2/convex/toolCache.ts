/**
 * Tool Result Caching for Chat API
 *
 * Provides caching for expensive tool calls (case queries, knowledge search, web search)
 * to avoid redundant API calls within a conversation.
 *
 * TTL values:
 * - query_cases: 5 minutes (case data may change)
 * - search_knowledge: 24 hours (static knowledge base)
 * - search_web: 15 minutes (fresher web results)
 *
 * @module toolCache
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getCurrentUserId } from "./lib/auth";
import { MS_PER_DAY, MS_PER_MINUTE } from "./lib/time";

// =============================================================================
// TTL CONSTANTS (in milliseconds)
// =============================================================================

/**
 * TTL for query_cases tool (5 minutes)
 * Case data may change frequently, so shorter TTL
 */
export const QUERY_CASES_TTL = 5 * MS_PER_MINUTE;

/**
 * TTL for search_knowledge tool (24 hours)
 * Knowledge base is static, so longer TTL
 */
export const SEARCH_KNOWLEDGE_TTL = MS_PER_DAY;

/**
 * TTL for search_web tool (15 minutes)
 * Web search results should be relatively fresh
 */
export const SEARCH_WEB_TTL = 15 * MS_PER_MINUTE;

/**
 * Tool name to TTL mapping
 */
export const TOOL_TTLS: Record<string, number> = {
  query_cases: QUERY_CASES_TTL,
  search_knowledge: SEARCH_KNOWLEDGE_TTL,
  search_web: SEARCH_WEB_TTL,
};

/**
 * Default TTL if tool name not found (5 minutes)
 */
export const DEFAULT_TTL = 5 * MS_PER_MINUTE;

// =============================================================================
// HASH FUNCTION
// =============================================================================

/**
 * Simple hash function for query parameters
 * Uses djb2 algorithm - fast and produces good distribution
 *
 * @param params - Query parameters to hash
 * @returns Hash string for cache lookup
 */
export function hashParams(params: Record<string, unknown>): string {
  const str = JSON.stringify(params, Object.keys(params).sort());
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit integer and then to hex string
  return (hash >>> 0).toString(16);
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get cached result if it exists and hasn't expired
 *
 * @param conversationId - The conversation to look up cache for
 * @param toolName - Name of the tool (query_cases, search_knowledge, search_web)
 * @param queryHash - Hash of the query parameters
 * @returns Cached result string (JSON) or null if not found/expired
 */
export const get = query({
  args: {
    conversationId: v.id("conversations"),
    toolName: v.string(),
    queryHash: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const userId = await getCurrentUserId(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) return null;

    const now = Date.now();

    const cached = await ctx.db
      .query("toolCache")
      .withIndex("by_conversation_tool_hash", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("toolName", args.toolName)
          .eq("queryHash", args.queryHash)
      )
      .first();

    // Return null if not found or expired
    if (!cached || cached.expiresAt < now) {
      return null;
    }

    return cached.result;
  },
});

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Store result in cache (upsert pattern)
 *
 * @param conversationId - The conversation to cache for
 * @param toolName - Name of the tool (query_cases, search_knowledge, search_web)
 * @param queryHash - Hash of the query parameters
 * @param queryParams - JSON string of original params (for debugging)
 * @param result - JSON stringified result to cache
 */
export const set = mutation({
  args: {
    conversationId: v.id("conversations"),
    toolName: v.string(),
    queryHash: v.string(),
    queryParams: v.string(),
    result: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await getCurrentUserId(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Not authorized to access this conversation's cache");
    }

    const now = Date.now();
    const ttl = TOOL_TTLS[args.toolName] || DEFAULT_TTL;
    const expiresAt = now + ttl;

    // Check if entry already exists
    const existing = await ctx.db
      .query("toolCache")
      .withIndex("by_conversation_tool_hash", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("toolName", args.toolName)
          .eq("queryHash", args.queryHash)
      )
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        queryParams: args.queryParams,
        result: args.result,
        createdAt: now,
        expiresAt,
      });
    } else {
      // Insert new entry
      await ctx.db.insert("toolCache", {
        conversationId: args.conversationId,
        toolName: args.toolName,
        queryHash: args.queryHash,
        queryParams: args.queryParams,
        result: args.result,
        createdAt: now,
        expiresAt,
      });
    }
  },
});

/**
 * Invalidate all query_cases caches for a conversation
 * Call this when case data changes within a conversation
 *
 * @param conversationId - The conversation to invalidate caches for
 */
export const invalidateCaseCaches = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<number> => {
    const userId = await getCurrentUserId(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) return 0;

    // Find all query_cases entries for this conversation
    const entries = await ctx.db
      .query("toolCache")
      .withIndex("by_conversation_tool_hash", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("toolName", "query_cases")
      )
      .collect();

    // Delete all matching entries
    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }

    return entries.length;
  },
});

/**
 * Delete expired cache entries.
 *
 * Reads never return an expired entry, but nothing else removes one, so the
 * daily retention run (`retention.pruneOperationalLogs`) starts this. It works
 * in batches and schedules itself again while it keeps finding a full batch.
 *
 * @param batchSize - Maximum number of entries to delete in one call (default: 100)
 * @returns Number of entries deleted by this call
 */
export const cleanExpired = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const now = Date.now();
    const batchSize = args.batchSize ?? 100;

    const expired = await ctx.db
      .query("toolCache")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .take(batchSize);

    for (const entry of expired) {
      await ctx.db.delete(entry._id);
    }

    // A full batch may mean more remain. An empty or partial one ends the run.
    if (expired.length === batchSize) {
      await ctx.scheduler.runAfter(0, internal.toolCache.cleanExpired, { batchSize });
    }

    return expired.length;
  },
});

// =============================================================================
// HELPER TYPES (for external use)
// =============================================================================

/**
 * Tool names that can be cached
 */
export type CacheableToolName = "query_cases" | "search_knowledge" | "search_web";

/**
 * Cache entry metadata
 */
export interface CacheEntry {
  conversationId: Id<"conversations">;
  toolName: CacheableToolName;
  queryHash: string;
  queryParams: string;
  result: string;
  createdAt: number;
  expiresAt: number;
}
