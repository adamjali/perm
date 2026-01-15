/**
 * Tool Result Caching Helper for Chat API
 *
 * Provides a wrapper function to execute tool calls with caching.
 * Uses Convex toolCache table for storage.
 *
 * @module cache
 */

import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { api } from '@/../convex/_generated/api';
import type { Id } from '@/../convex/_generated/dataModel';
import { hashParams } from '@/../convex/toolCache';

// =============================================================================
// SERIALIZATION HELPERS
// =============================================================================

/**
 * Custom JSON replacer that handles BigInt values (Convex timestamps)
 * Converts BigInt to number for JSON serialization
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    // Convert to number - safe for timestamps which are within Number.MAX_SAFE_INTEGER
    return Number(value);
  }
  return value;
}

/**
 * Safely stringify a value, handling BigInt from Convex
 */
function safeStringify(value: unknown): string {
  return JSON.stringify(value, bigIntReplacer);
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Tool names that can be cached
 */
export type CacheableToolName = 'query_cases' | 'search_knowledge' | 'search_web';

/**
 * Cache statistics for logging
 */
export interface CacheStats {
  hits: number;
  misses: number;
}

/**
 * Options for executeWithCache
 */
export interface ExecuteWithCacheOptions<T> {
  /** Conversation ID for scoping cache */
  conversationId: Id<'conversations'> | null;
  /** Tool name for cache key */
  toolName: CacheableToolName;
  /** Query parameters (will be hashed for cache key) */
  params: Record<string, unknown>;
  /** Function to execute if cache miss */
  execute: () => Promise<T>;
  /** Convex auth token */
  token: string;
  /** Optional: Whether to skip caching (useful for debugging) */
  skipCache?: boolean;
}

// =============================================================================
// CACHE HELPER
// =============================================================================

/**
 * Execute a tool call with caching
 *
 * This wrapper:
 * 1. Checks cache for existing result
 * 2. If hit: returns cached result, logs "Cache HIT"
 * 3. If miss: executes function, stores result, logs "Cache MISS"
 *
 * Handles missing conversationId gracefully by skipping cache.
 * Does not cache errors - only successful results.
 *
 * @param options - Execution options
 * @returns Tool result (cached or fresh)
 */
export async function executeWithCache<T>(
  options: ExecuteWithCacheOptions<T>
): Promise<T> {
  const { conversationId, toolName, params, execute, token, skipCache } = options;

  // Skip cache if no conversationId (fire-and-forget queries)
  if (!conversationId || skipCache) {
    console.log(`[Cache] Skipping cache for ${toolName} (no conversationId)`);
    return await execute();
  }

  const queryHash = hashParams(params);
  const queryParams = safeStringify(params);

  try {
    // Check cache
    const cached = await fetchQuery(
      api.toolCache.get,
      { conversationId, toolName, queryHash },
      { token }
    );

    if (cached) {
      console.log(`[Cache] HIT for ${toolName} (hash: ${queryHash})`);
      return JSON.parse(cached) as T;
    }

    console.log(`[Cache] MISS for ${toolName} (hash: ${queryHash})`);
  } catch (error) {
    // If cache check fails, continue with execution
    console.warn(`[Cache] Error checking cache for ${toolName}:`, error);
  }

  // Cache miss - execute the function
  const result = await execute();

  // Store result in cache (fire-and-forget, don't block response)
  try {
    // Only cache successful results (not errors)
    const isError = result && typeof result === 'object' && 'error' in result;
    if (!isError) {
      await fetchMutation(
        api.toolCache.set,
        {
          conversationId,
          toolName,
          queryHash,
          queryParams,
          result: safeStringify(result), // Use safe stringify for BigInt handling
        },
        { token }
      );
      console.log(`[Cache] Stored result for ${toolName} (hash: ${queryHash})`);
    } else {
      console.log(`[Cache] Skipping cache for ${toolName} (error result)`);
    }
  } catch (error) {
    // If cache store fails, log but don't throw
    console.warn(`[Cache] Error storing result for ${toolName}:`, error);
  }

  return result;
}

/**
 * Create a cache stats tracker for a request
 *
 * @returns Cache stats object with tracking methods
 */
export function createCacheStats(): CacheStats & {
  recordHit: () => void;
  recordMiss: () => void;
  log: (sessionId: string) => void;
} {
  const stats: CacheStats = { hits: 0, misses: 0 };

  return {
    ...stats,
    get hits() {
      return stats.hits;
    },
    get misses() {
      return stats.misses;
    },
    recordHit() {
      stats.hits++;
    },
    recordMiss() {
      stats.misses++;
    },
    log(sessionId: string) {
      const total = stats.hits + stats.misses;
      if (total > 0) {
        const hitRate = ((stats.hits / total) * 100).toFixed(1);
        console.log(
          `[Cache] [${sessionId}] Stats: ${stats.hits} hits, ${stats.misses} misses (${hitRate}% hit rate)`
        );
      }
    },
  };
}

/**
 * Invalidate case caches for a conversation
 *
 * Call this when case data changes within a conversation.
 *
 * @param conversationId - The conversation to invalidate caches for
 * @param token - Convex auth token
 * @returns Number of entries invalidated
 */
export async function invalidateCaseCaches(
  conversationId: Id<'conversations'>,
  token: string
): Promise<number> {
  try {
    const count = await fetchMutation(
      api.toolCache.invalidateCaseCaches,
      { conversationId },
      { token }
    );
    console.log(`[Cache] Invalidated ${count} case cache entries`);
    return count;
  } catch (error) {
    console.warn('[Cache] Error invalidating case caches:', error);
    return 0;
  }
}
