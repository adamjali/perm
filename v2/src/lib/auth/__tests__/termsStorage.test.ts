/**
 * Tests for Terms Acceptance Storage
 *
 * Tests the localStorage-based persistence for terms acceptance
 * during Google OAuth redirect flows.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  savePendingTermsAcceptance,
  getPendingTermsAcceptance,
  clearPendingTermsAcceptance,
  hasPendingTermsAcceptance,
  PENDING_TERMS_KEY,
} from "../termsStorage";

describe("termsStorage", () => {
  // Mock localStorage
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);

    // Mock localStorage
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("savePendingTermsAcceptance", () => {
    it("saves terms version to localStorage", () => {
      const result = savePendingTermsAcceptance("2026-01-03");

      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        PENDING_TERMS_KEY,
        expect.any(String)
      );

      // Verify stored data structure
      const stored = JSON.parse(mockStorage[PENDING_TERMS_KEY]);
      expect(stored.accepted).toBe(true);
      expect(stored.version).toBe("2026-01-03");
      expect(stored.timestamp).toBeTypeOf("number");
    });

    it("stores timestamp for expiration checking", () => {
      const before = Date.now();
      savePendingTermsAcceptance("2026-01-03");
      const after = Date.now();

      const stored = JSON.parse(mockStorage[PENDING_TERMS_KEY]);
      expect(stored.timestamp).toBeGreaterThanOrEqual(before);
      expect(stored.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("getPendingTermsAcceptance", () => {
    it("returns version when valid data exists", () => {
      // Save valid data
      mockStorage[PENDING_TERMS_KEY] = JSON.stringify({
        accepted: true,
        version: "2026-01-03",
        timestamp: Date.now(),
      });

      const result = getPendingTermsAcceptance();

      expect(result).toBe("2026-01-03");
    });

    it("returns null when no data exists", () => {
      const result = getPendingTermsAcceptance();

      expect(result).toBeNull();
    });

    it("returns null and clears when data is expired (>5 minutes)", () => {
      // Save expired data (6 minutes ago)
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      mockStorage[PENDING_TERMS_KEY] = JSON.stringify({
        accepted: true,
        version: "2026-01-03",
        timestamp: sixMinutesAgo,
      });

      const result = getPendingTermsAcceptance();

      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith(PENDING_TERMS_KEY);
    });

    it("returns version when data is within 5 minutes", () => {
      // Save data from 4 minutes ago (within limit)
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      mockStorage[PENDING_TERMS_KEY] = JSON.stringify({
        accepted: true,
        version: "2026-01-03",
        timestamp: fourMinutesAgo,
      });

      const result = getPendingTermsAcceptance();

      expect(result).toBe("2026-01-03");
    });

    it("returns null and clears when data structure is invalid", () => {
      // Save invalid data (missing accepted field)
      mockStorage[PENDING_TERMS_KEY] = JSON.stringify({
        version: "2026-01-03",
        timestamp: Date.now(),
      });

      const result = getPendingTermsAcceptance();

      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith(PENDING_TERMS_KEY);
    });

    it("returns null and clears on JSON parse error", () => {
      // Save invalid JSON
      mockStorage[PENDING_TERMS_KEY] = "not valid json";

      const result = getPendingTermsAcceptance();

      expect(result).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith(PENDING_TERMS_KEY);
    });
  });

  describe("clearPendingTermsAcceptance", () => {
    it("removes item from localStorage", () => {
      mockStorage[PENDING_TERMS_KEY] = JSON.stringify({
        accepted: true,
        version: "2026-01-03",
        timestamp: Date.now(),
      });

      clearPendingTermsAcceptance();

      expect(localStorage.removeItem).toHaveBeenCalledWith(PENDING_TERMS_KEY);
    });
  });

  describe("hasPendingTermsAcceptance", () => {
    it("returns true when valid pending terms exist", () => {
      mockStorage[PENDING_TERMS_KEY] = JSON.stringify({
        accepted: true,
        version: "2026-01-03",
        timestamp: Date.now(),
      });

      expect(hasPendingTermsAcceptance()).toBe(true);
    });

    it("returns false when no pending terms", () => {
      expect(hasPendingTermsAcceptance()).toBe(false);
    });

    it("returns false when pending terms are expired", () => {
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      mockStorage[PENDING_TERMS_KEY] = JSON.stringify({
        accepted: true,
        version: "2026-01-03",
        timestamp: sixMinutesAgo,
      });

      expect(hasPendingTermsAcceptance()).toBe(false);
    });
  });

  describe("full flow", () => {
    it("save -> get -> clear flow works correctly", () => {
      // 1. Save
      const saveResult = savePendingTermsAcceptance("2026-01-03");
      expect(saveResult).toBe(true);

      // 2. Get
      const version = getPendingTermsAcceptance();
      expect(version).toBe("2026-01-03");

      // 3. Clear
      clearPendingTermsAcceptance();

      // 4. Verify cleared
      const afterClear = getPendingTermsAcceptance();
      expect(afterClear).toBeNull();
    });
  });

  describe("SSR safety", () => {
    it("handles missing window gracefully", () => {
      // Temporarily remove localStorage
      vi.stubGlobal("localStorage", undefined);

      // All functions should return safe defaults
      expect(savePendingTermsAcceptance("2026-01-03")).toBe(false);
      expect(getPendingTermsAcceptance()).toBeNull();
      expect(hasPendingTermsAcceptance()).toBe(false);
      // clearPendingTermsAcceptance should not throw
      expect(() => clearPendingTermsAcceptance()).not.toThrow();
    });
  });
});
