/**
 * Web Search Action with Multi-Provider Fallback
 *
 * Provides web search functionality for the chatbot with intelligent
 * fallback between providers based on rate limit tracking.
 *
 * Provider priority:
 * 1. Tavily (primary) - AI-optimized search with answer generation
 * 2. Brave (fallback) - Fast web search API
 *
 * Rate limits (enforced via apiUsage):
 * - Tavily: 30/day (90% of 1000/month free tier)
 * - Brave: 60/day (90% of 2000/month free tier)
 *
 * Environment variables required:
 * - TAVILY_API_KEY: Tavily Search API key
 * - BRAVE_API_KEY: Brave Search API key
 *
 * @module webSearch
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { DAILY_LIMITS } from "./apiUsage";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Search result from any provider.
 */
interface SearchResult {
  title: string;
  url: string;
  content: string;
}

/**
 * Unified search response.
 */
interface SearchResponse {
  source: "tavily" | "brave" | "none";
  results: SearchResult[];
  answer: string | null;
}

/**
 * Tavily API response shape.
 */
interface TavilyResponse {
  answer?: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
  }>;
}

/**
 * Brave API response shape.
 */
interface BraveResponse {
  web?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
    }>;
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Search using Tavily API.
 *
 * Tavily is optimized for AI applications and provides:
 * - AI-generated answer summaries
 * - High-quality, relevant results
 * - Built-in content extraction
 *
 * @param query - Search query string
 * @returns Search response with results and optional answer
 * @throws Error if API call fails
 */
async function tavilySearch(query: string): Promise<SearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY not configured");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic", // Faster, conserves quota
      include_answer: true, // AI-generated summary
      max_results: 5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as TavilyResponse;

  return {
    source: "tavily",
    answer: data.answer ?? null,
    results: data.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    })),
  };
}

/**
 * Search using Brave Search API.
 *
 * Brave provides:
 * - Fast, privacy-focused search
 * - High-quality web results
 * - No answer generation (results only)
 *
 * @param query - Search query string
 * @returns Search response with results (no answer)
 * @throws Error if API call fails
 */
async function braveSearch(query: string): Promise<SearchResponse> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new Error("BRAVE_API_KEY not configured");
  }

  const params = new URLSearchParams({
    q: query,
    count: "5",
  });

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brave API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as BraveResponse;

  const results =
    data.web?.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.description,
    })) ?? [];

  return {
    source: "brave",
    answer: null, // Brave doesn't provide AI answers
    results,
  };
}

// =============================================================================
// PUBLIC ACTION
// =============================================================================

/**
 * Perform a web search with multi-provider fallback.
 *
 * This action checks rate limits and falls back between providers:
 * 1. Check Tavily quota -> use if available
 * 2. Check Brave quota -> use if Tavily unavailable/failed
 * 3. Return empty results if all providers exhausted
 *
 * Usage from client:
 * ```typescript
 * const results = await convex.action(api.webSearch.searchWeb, {
 *   query: "PERM labor certification requirements 2024"
 * });
 * ```
 *
 * @param query - Search query string
 * @returns Search response with source, results, and optional answer
 */
export const searchWeb = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, { query }): Promise<SearchResponse> => {
    // Check Tavily quota first
    const tavilyUsage = await ctx.runQuery(internal.apiUsage.getUsageInternal, {
      provider: "tavily",
    });

    if (tavilyUsage < DAILY_LIMITS.tavily) {
      try {
        const result = await tavilySearch(query);
        await ctx.runMutation(internal.apiUsage.trackUsage, {
          provider: "tavily",
        });
        return result;
      } catch (e) {
        console.error("Tavily search failed:", e);
        // Fall through to Brave
      }
    }

    // Fallback to Brave
    const braveUsage = await ctx.runQuery(internal.apiUsage.getUsageInternal, {
      provider: "brave",
    });

    if (braveUsage < DAILY_LIMITS.brave) {
      try {
        const result = await braveSearch(query);
        await ctx.runMutation(internal.apiUsage.trackUsage, {
          provider: "brave",
        });
        return result;
      } catch (e) {
        console.error("Brave search failed:", e);
        // Fall through to graceful degradation
      }
    }

    // Graceful fallback - no web results available
    console.warn(
      `Web search unavailable. Tavily: ${tavilyUsage}/${DAILY_LIMITS.tavily}, Brave: ${braveUsage}/${DAILY_LIMITS.brave}`
    );
    return {
      source: "none",
      results: [],
      answer: null,
    };
  },
});
