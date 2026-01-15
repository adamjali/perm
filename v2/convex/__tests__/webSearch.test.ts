/**
 * Web Search Action Tests
 *
 * Tests for the web search functionality with multi-provider fallback.
 * All tests use mocks to avoid actual API calls.
 *
 * Tests cover:
 * - searchWeb returns correct result structure
 * - Rate limit checking and enforcement
 * - Fallback from Tavily to Brave when Tavily is at limit
 * - Graceful degradation when all providers are at limit
 *
 * NOTE: These tests mock fetch() and internal Convex functions to avoid
 * actual API calls. The action is tested through the convex-test framework.
 *
 * @see /convex/webSearch.ts - Web search action implementation
 * @see /convex/apiUsage.ts - Rate limit tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
const originalEnv = process.env;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a mock Tavily API response
 */
function createTavilyResponse(results: number = 3, includeAnswer: boolean = true) {
  return {
    ok: true,
    json: async () => ({
      answer: includeAnswer ? "This is a generated answer from Tavily." : undefined,
      results: Array.from({ length: results }, (_, i) => ({
        title: `Tavily Result ${i + 1}`,
        url: `https://example.com/tavily/${i + 1}`,
        content: `Content for Tavily result ${i + 1}`,
      })),
    }),
    text: async () => "{}",
  };
}

/**
 * Create a mock Brave API response
 */
function createBraveResponse(results: number = 3) {
  return {
    ok: true,
    json: async () => ({
      web: {
        results: Array.from({ length: results }, (_, i) => ({
          title: `Brave Result ${i + 1}`,
          url: `https://example.com/brave/${i + 1}`,
          description: `Description for Brave result ${i + 1}`,
        })),
      },
    }),
    text: async () => "{}",
  };
}

/**
 * Create a mock error response
 */
function createErrorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    text: async () => message,
  };
}

// ============================================================================
// WEB SEARCH TESTS
// ============================================================================

describe("webSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    mockFetch.mockReset();

    // Set up environment variables for API keys
    process.env = {
      ...originalEnv,
      TAVILY_API_KEY: "test-tavily-key",
      BRAVE_API_KEY: "test-brave-key",
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
  });

  // ============================================================================
  // RESULT STRUCTURE TESTS
  // ============================================================================

  describe("result structure", () => {
    it("returns correct structure from Tavily (primary provider)", async () => {
      const t = createTestContext();

      // Mock Tavily response
      mockFetch.mockResolvedValueOnce(createTavilyResponse(3, true));

      const result = await t.action(api.webSearch.searchWeb, {
        query: "PERM labor certification requirements",
      });

      // Verify structure
      expect(result).toHaveProperty("source");
      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("answer");

      // Verify source
      expect(result.source).toBe("tavily");

      // Verify results array
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBe(3);

      // Verify result item structure
      for (const item of result.results) {
        expect(item).toHaveProperty("title");
        expect(item).toHaveProperty("url");
        expect(item).toHaveProperty("content");
        expect(typeof item.title).toBe("string");
        expect(typeof item.url).toBe("string");
        expect(typeof item.content).toBe("string");
      }

      // Verify answer
      expect(result.answer).toBe("This is a generated answer from Tavily.");
    });

    it("returns correct structure from Brave (fallback provider)", async () => {
      const t = createTestContext();

      // Fill Tavily quota to force Brave fallback
      for (let i = 0; i < 30; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      }

      // Mock Brave response
      mockFetch.mockResolvedValueOnce(createBraveResponse(3));

      const result = await t.action(api.webSearch.searchWeb, {
        query: "PERM labor certification requirements",
      });

      // Verify source is Brave
      expect(result.source).toBe("brave");

      // Verify results array
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBe(3);

      // Verify result item structure
      for (const item of result.results) {
        expect(item).toHaveProperty("title");
        expect(item).toHaveProperty("url");
        expect(item).toHaveProperty("content");
      }

      // Brave doesn't provide answer
      expect(result.answer).toBeNull();
    });

    it("returns empty results structure when all providers unavailable", async () => {
      const t = createTestContext();

      // Fill both quotas
      for (let i = 0; i < 30; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      }
      for (let i = 0; i < 60; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });
      }

      const result = await t.action(api.webSearch.searchWeb, {
        query: "PERM labor certification requirements",
      });

      // Verify empty structure
      expect(result.source).toBe("none");
      expect(result.results).toEqual([]);
      expect(result.answer).toBeNull();

      // Fetch should not have been called
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // RATE LIMIT TESTS
  // ============================================================================

  describe("rate limit enforcement", () => {
    it("uses Tavily when under limit", async () => {
      const t = createTestContext();

      // Track some usage but stay under limit
      for (let i = 0; i < 10; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      }

      mockFetch.mockResolvedValueOnce(createTavilyResponse());

      const result = await t.action(api.webSearch.searchWeb, {
        query: "test query",
      });

      expect(result.source).toBe("tavily");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tavily.com/search",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("falls back to Brave when Tavily is at limit", async () => {
      const t = createTestContext();

      // Fill Tavily quota exactly to limit
      for (let i = 0; i < 30; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      }

      mockFetch.mockResolvedValueOnce(createBraveResponse());

      const result = await t.action(api.webSearch.searchWeb, {
        query: "test query",
      });

      expect(result.source).toBe("brave");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("api.search.brave.com"),
        expect.objectContaining({
          method: "GET",
        })
      );
    });

    it("returns empty when both providers are at limit", async () => {
      const t = createTestContext();

      // Fill both quotas
      for (let i = 0; i < 30; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      }
      for (let i = 0; i < 60; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });
      }

      const result = await t.action(api.webSearch.searchWeb, {
        query: "test query",
      });

      expect(result.source).toBe("none");
      expect(result.results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("tracks usage after successful Tavily search", async () => {
      const t = createTestContext();

      // Verify initial count
      const initialUsage = await t.query(api.apiUsage.getUsage, {
        provider: "tavily",
      });
      expect(initialUsage).toBe(0);

      mockFetch.mockResolvedValueOnce(createTavilyResponse());

      await t.action(api.webSearch.searchWeb, {
        query: "test query",
      });

      // Verify usage was incremented
      const finalUsage = await t.query(api.apiUsage.getUsage, {
        provider: "tavily",
      });
      expect(finalUsage).toBe(1);
    });

    it("tracks usage after successful Brave search", async () => {
      const t = createTestContext();

      // Force Brave fallback
      for (let i = 0; i < 30; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      }

      // Verify initial Brave count
      const initialUsage = await t.query(api.apiUsage.getUsage, {
        provider: "brave",
      });
      expect(initialUsage).toBe(0);

      mockFetch.mockResolvedValueOnce(createBraveResponse());

      await t.action(api.webSearch.searchWeb, {
        query: "test query",
      });

      // Verify Brave usage was incremented
      const finalUsage = await t.query(api.apiUsage.getUsage, {
        provider: "brave",
      });
      expect(finalUsage).toBe(1);
    });
  });

  // ============================================================================
  // FALLBACK BEHAVIOR TESTS
  // ============================================================================

  describe("fallback behavior", () => {
    it("falls back to Brave when Tavily API fails", async () => {
      const t = createTestContext();

      // Mock Tavily failure
      mockFetch.mockResolvedValueOnce(createErrorResponse(500, "Internal Server Error"));
      // Mock Brave success
      mockFetch.mockResolvedValueOnce(createBraveResponse());

      const result = await t.action(api.webSearch.searchWeb, {
        query: "test query",
      });

      // Should fall back to Brave
      expect(result.source).toBe("brave");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("returns empty when both providers fail", async () => {
      const t = createTestContext();

      // Mock both failures
      mockFetch.mockResolvedValueOnce(createErrorResponse(500, "Tavily Error"));
      mockFetch.mockResolvedValueOnce(createErrorResponse(500, "Brave Error"));

      const result = await t.action(api.webSearch.searchWeb, {
        query: "test query",
      });

      // Should return empty
      expect(result.source).toBe("none");
      expect(result.results).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does not fall back to Brave when Tavily succeeds", async () => {
      const t = createTestContext();

      mockFetch.mockResolvedValueOnce(createTavilyResponse());

      const result = await t.action(api.webSearch.searchWeb, {
        query: "test query",
      });

      expect(result.source).toBe("tavily");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("skips Brave if also at limit after Tavily failure", async () => {
      const t = createTestContext();

      // Fill Brave quota but leave Tavily available
      for (let i = 0; i < 60; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });
      }

      // Mock Tavily failure
      mockFetch.mockResolvedValueOnce(createErrorResponse(500, "Tavily Error"));

      const result = await t.action(api.webSearch.searchWeb, {
        query: "test query",
      });

      // Should return empty since Brave is also at limit
      expect(result.source).toBe("none");
      expect(result.results).toEqual([]);
      // Only one call (Tavily), Brave wasn't even attempted
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // API REQUEST TESTS
  // ============================================================================

  describe("API request formatting", () => {
    it("sends correct request to Tavily API", async () => {
      const t = createTestContext();

      mockFetch.mockResolvedValueOnce(createTavilyResponse());

      await t.action(api.webSearch.searchWeb, {
        query: "PERM deadline rules",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.tavily.com/search",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: expect.stringContaining("PERM deadline rules"),
        })
      );

      // Verify body structure
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).toHaveProperty("api_key", "test-tavily-key");
      expect(body).toHaveProperty("query", "PERM deadline rules");
      expect(body).toHaveProperty("search_depth", "basic");
      expect(body).toHaveProperty("include_answer", true);
      expect(body).toHaveProperty("max_results", 5);
    });

    it("sends correct request to Brave API", async () => {
      const t = createTestContext();

      // Force Brave fallback
      for (let i = 0; i < 30; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      }

      mockFetch.mockResolvedValueOnce(createBraveResponse());

      await t.action(api.webSearch.searchWeb, {
        query: "PERM deadline rules",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("api.search.brave.com/res/v1/web/search"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Accept: "application/json",
            "X-Subscription-Token": "test-brave-key",
          }),
        })
      );

      // Verify URL contains query
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("q=PERM+deadline+rules");
      expect(url).toContain("count=5");
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("edge cases", () => {
    it("handles empty results from Tavily", async () => {
      const t = createTestContext();

      mockFetch.mockResolvedValueOnce(createTavilyResponse(0, false));

      const result = await t.action(api.webSearch.searchWeb, {
        query: "very obscure query",
      });

      expect(result.source).toBe("tavily");
      expect(result.results).toEqual([]);
      expect(result.answer).toBeNull();
    });

    it("handles empty results from Brave", async () => {
      const t = createTestContext();

      // Force Brave
      for (let i = 0; i < 30; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: { results: [] },
        }),
      });

      const result = await t.action(api.webSearch.searchWeb, {
        query: "very obscure query",
      });

      expect(result.source).toBe("brave");
      expect(result.results).toEqual([]);
    });

    it("handles missing web property in Brave response", async () => {
      const t = createTestContext();

      // Force Brave
      for (let i = 0; i < 30; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // No web property
      });

      const result = await t.action(api.webSearch.searchWeb, {
        query: "test query",
      });

      expect(result.source).toBe("brave");
      expect(result.results).toEqual([]);
    });

    it("handles usage exactly at limit boundary", async () => {
      const t = createTestContext();

      // Track usage to exactly one below limit
      for (let i = 0; i < 29; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      }

      mockFetch.mockResolvedValueOnce(createTavilyResponse());

      // Should still use Tavily (29 < 30)
      const result = await t.action(api.webSearch.searchWeb, {
        query: "test query",
      });

      expect(result.source).toBe("tavily");

      // Usage should now be at 30
      const usage = await t.query(api.apiUsage.getUsage, { provider: "tavily" });
      expect(usage).toBe(30);
    });
  });
});
