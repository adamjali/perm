/**
 * API Usage Tracking Tests
 *
 * Tests for the API usage tracking module that enforces daily rate limits
 * for external search providers (Tavily, Brave).
 *
 * Tests cover:
 * - trackUsage: Creates new records and increments existing ones
 * - getUsageInternal: Internal query for rate limit checks
 * - getUsage: Public query for UI display
 * - getDailyLimits: Returns configured limits for all providers
 *
 * @see /convex/apiUsage.ts - API usage tracking implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import { DAILY_LIMITS } from "../apiUsage";

// ============================================================================
// API USAGE TESTS
// ============================================================================

describe("apiUsage", () => {
  // Use fake timers to control date
  beforeEach(() => {
    vi.useFakeTimers();
    // Set a fixed date for consistent testing
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // trackUsage TESTS
  // ============================================================================

  describe("trackUsage", () => {
    it("creates new record for first usage of provider on date", async () => {
      const t = createTestContext();

      // Track usage for tavily
      const count = await t.mutation(internal.apiUsage.trackUsage, {
        provider: "tavily",
      });

      expect(count).toBe(1);

      // Verify via public query
      const usage = await t.query(api.apiUsage.getUsage, {
        provider: "tavily",
      });
      expect(usage).toBe(1);
    });

    it("increments existing record on subsequent calls", async () => {
      const t = createTestContext();

      // First call
      const count1 = await t.mutation(internal.apiUsage.trackUsage, {
        provider: "tavily",
      });
      expect(count1).toBe(1);

      // Second call
      const count2 = await t.mutation(internal.apiUsage.trackUsage, {
        provider: "tavily",
      });
      expect(count2).toBe(2);

      // Third call
      const count3 = await t.mutation(internal.apiUsage.trackUsage, {
        provider: "tavily",
      });
      expect(count3).toBe(3);

      // Verify final count
      const usage = await t.query(api.apiUsage.getUsage, {
        provider: "tavily",
      });
      expect(usage).toBe(3);
    });

    it("tracks different providers independently", async () => {
      const t = createTestContext();

      // Track tavily usage
      await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });

      // Track brave usage
      await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });

      // Verify independent counts
      const tavilyUsage = await t.query(api.apiUsage.getUsage, {
        provider: "tavily",
      });
      const braveUsage = await t.query(api.apiUsage.getUsage, {
        provider: "brave",
      });

      expect(tavilyUsage).toBe(2);
      expect(braveUsage).toBe(1);
    });

    it("creates separate records for different dates", async () => {
      const t = createTestContext();

      // Track usage on first day
      await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });

      const day1Usage = await t.query(api.apiUsage.getUsage, {
        provider: "tavily",
      });
      expect(day1Usage).toBe(2);

      // Advance to next day
      vi.setSystemTime(new Date("2024-06-16T12:00:00Z"));

      // Track usage on second day
      await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });

      // New day should have fresh count
      const day2Usage = await t.query(api.apiUsage.getUsage, {
        provider: "tavily",
      });
      expect(day2Usage).toBe(1);
    });
  });

  // ============================================================================
  // getUsageInternal TESTS
  // ============================================================================

  describe("getUsageInternal", () => {
    it("returns 0 for new provider with no usage", async () => {
      const t = createTestContext();

      const usage = await t.query(internal.apiUsage.getUsageInternal, {
        provider: "tavily",
      });

      expect(usage).toBe(0);
    });

    it("returns correct count after tracking", async () => {
      const t = createTestContext();

      // Track some usage
      await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });
      await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });
      await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });

      const usage = await t.query(internal.apiUsage.getUsageInternal, {
        provider: "brave",
      });

      expect(usage).toBe(3);
    });

    it("returns 0 for provider on a new date", async () => {
      const t = createTestContext();

      // Track usage today
      await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });

      // Advance to next day
      vi.setSystemTime(new Date("2024-06-16T12:00:00Z"));

      // Should return 0 for new day
      const usage = await t.query(internal.apiUsage.getUsageInternal, {
        provider: "tavily",
      });

      expect(usage).toBe(0);
    });
  });

  // ============================================================================
  // getUsage TESTS (public query)
  // ============================================================================

  describe("getUsage", () => {
    it("returns 0 for new provider with no usage", async () => {
      const t = createTestContext();

      const usage = await t.query(api.apiUsage.getUsage, {
        provider: "tavily",
      });

      expect(usage).toBe(0);
    });

    it("returns correct count for existing usage", async () => {
      const t = createTestContext();

      // Track usage
      await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });

      const usage = await t.query(api.apiUsage.getUsage, {
        provider: "tavily",
      });

      expect(usage).toBe(2);
    });

    it("returns count for specific provider only", async () => {
      const t = createTestContext();

      // Track different amounts for different providers
      await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });
      await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });
      await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });

      // Each provider should return its own count
      const tavilyUsage = await t.query(api.apiUsage.getUsage, {
        provider: "tavily",
      });
      const braveUsage = await t.query(api.apiUsage.getUsage, {
        provider: "brave",
      });

      expect(tavilyUsage).toBe(1);
      expect(braveUsage).toBe(3);
    });
  });

  // ============================================================================
  // getDailyLimits TESTS
  // ============================================================================

  describe("getDailyLimits", () => {
    it("returns configured limits for all providers", async () => {
      const t = createTestContext();

      const limits = await t.query(api.apiUsage.getDailyLimits, {});

      expect(limits).toHaveProperty("tavily");
      expect(limits).toHaveProperty("brave");
    });

    it("returns correct limit values", async () => {
      const t = createTestContext();

      const limits = await t.query(api.apiUsage.getDailyLimits, {});

      // Verify limits match the constant
      expect(limits.tavily).toBe(DAILY_LIMITS.tavily);
      expect(limits.brave).toBe(DAILY_LIMITS.brave);

      // Verify specific values (as documented in apiUsage.ts)
      expect(limits.tavily).toBe(30);
      expect(limits.brave).toBe(60);
    });

    it("returns a copy (not the original object)", async () => {
      const t = createTestContext();

      const limits1 = await t.query(api.apiUsage.getDailyLimits, {});
      const limits2 = await t.query(api.apiUsage.getDailyLimits, {});

      // Should be equal but not the same object
      expect(limits1).toEqual(limits2);
      // Modifying one shouldn't affect the other (defensive copy)
      limits1.tavily = 999;
      expect(limits2.tavily).toBe(30);
    });
  });

  // ============================================================================
  // RATE LIMIT INTEGRATION TESTS
  // ============================================================================

  describe("rate limit checks", () => {
    it("usage can be checked against limits", async () => {
      const t = createTestContext();

      // Simulate usage up to limit
      for (let i = 0; i < 30; i++) {
        await t.mutation(internal.apiUsage.trackUsage, { provider: "tavily" });
      }

      const usage = await t.query(api.apiUsage.getUsage, { provider: "tavily" });
      const limits = await t.query(api.apiUsage.getDailyLimits, {});

      // Usage should equal limit
      expect(usage).toBe(limits.tavily);
      expect(usage >= limits.tavily).toBe(true);
    });

    it("can determine when provider is under limit", async () => {
      const t = createTestContext();

      // Track a few usages
      await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });
      await t.mutation(internal.apiUsage.trackUsage, { provider: "brave" });

      const usage = await t.query(internal.apiUsage.getUsageInternal, {
        provider: "brave",
      });
      const limits = await t.query(api.apiUsage.getDailyLimits, {});

      // Should be well under the limit
      expect(usage < limits.brave).toBe(true);
      expect(usage).toBe(2);
      expect(limits.brave - usage).toBe(58); // Remaining quota
    });
  });
});
