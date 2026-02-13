/**
 * Tests for Error Recording Helper
 *
 * Verifies:
 * - Error message extraction from Error instances and non-Error values
 * - Stack trace extraction
 * - Optional fields (userId, resourceId, extra) passed correctly
 * - Self-healing: recording failures don't propagate
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the internal API before importing the module
vi.mock("../../_generated/api", () => ({
  internal: {
    systemErrors: {
      record: "mock-function-ref",
    },
  },
}));

import { recordError } from "../errorRecording";

describe("recordError", () => {
  const mockRunAfter = vi.fn().mockResolvedValue(undefined);
  const mockCtx = {
    scheduler: { runAfter: mockRunAfter },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("error message extraction", () => {
    it("extracts message from Error instances", async () => {
      await recordError(mockCtx, "mutation", "test.op", new Error("boom"));

      expect(mockRunAfter).toHaveBeenCalledWith(
        0,
        "mock-function-ref",
        expect.objectContaining({ message: "boom" }),
      );
    });

    it("extracts stack from Error instances", async () => {
      const error = new Error("boom");
      await recordError(mockCtx, "action", "test.op", error);

      expect(mockRunAfter).toHaveBeenCalledWith(
        0,
        "mock-function-ref",
        expect.objectContaining({
          stack: expect.stringContaining("Error: boom"),
        }),
      );
    });

    it("converts non-Error values to string message", async () => {
      await recordError(mockCtx, "mutation", "test.op", "string error");

      expect(mockRunAfter).toHaveBeenCalledWith(
        0,
        "mock-function-ref",
        expect.objectContaining({ message: "string error", stack: undefined }),
      );
    });

    it("handles null/undefined errors", async () => {
      await recordError(mockCtx, "cron", "test.op", null);

      expect(mockRunAfter).toHaveBeenCalledWith(
        0,
        "mock-function-ref",
        expect.objectContaining({ message: "null" }),
      );
    });

    it("handles number errors", async () => {
      await recordError(mockCtx, "webhook", "test.op", 42);

      expect(mockRunAfter).toHaveBeenCalledWith(
        0,
        "mock-function-ref",
        expect.objectContaining({ message: "42" }),
      );
    });
  });

  describe("source and operation", () => {
    it("passes source and operation through", async () => {
      await recordError(mockCtx, "cron", "scheduledJobs.cleanup", new Error("fail"));

      expect(mockRunAfter).toHaveBeenCalledWith(
        0,
        "mock-function-ref",
        expect.objectContaining({
          source: "cron",
          operation: "scheduledJobs.cleanup",
        }),
      );
    });
  });

  describe("optional fields", () => {
    it("includes userId when provided", async () => {
      await recordError(mockCtx, "mutation", "op", new Error("x"), {
        userId: "user123" as any,
      });

      const args = mockRunAfter.mock.calls[0][2];
      expect(args.userId).toBe("user123");
    });

    it("includes resourceId when provided", async () => {
      await recordError(mockCtx, "mutation", "op", new Error("x"), {
        resourceId: "case456",
      });

      const args = mockRunAfter.mock.calls[0][2];
      expect(args.resourceId).toBe("case456");
    });

    it("includes extra when provided", async () => {
      await recordError(mockCtx, "mutation", "op", new Error("x"), {
        extra: JSON.stringify({ key: "val" }),
      });

      const args = mockRunAfter.mock.calls[0][2];
      expect(args.extra).toBe('{"key":"val"}');
    });

    it("omits optional fields when not provided", async () => {
      await recordError(mockCtx, "mutation", "op", new Error("x"));

      const args = mockRunAfter.mock.calls[0][2];
      expect(args.userId).toBeUndefined();
      expect(args.resourceId).toBeUndefined();
      expect(args.extra).toBeUndefined();
    });

    it("omits optional fields when empty string", async () => {
      await recordError(mockCtx, "mutation", "op", new Error("x"), {
        resourceId: "",
        extra: "",
      });

      const args = mockRunAfter.mock.calls[0][2];
      expect(args.resourceId).toBeUndefined();
      expect(args.extra).toBeUndefined();
    });
  });

  describe("self-healing", () => {
    it("does not throw when scheduler.runAfter fails", async () => {
      const failingCtx = {
        scheduler: {
          runAfter: vi.fn().mockRejectedValue(new Error("scheduler down")),
        },
      };

      // Should not throw
      await expect(
        recordError(failingCtx, "mutation", "test.op", new Error("original")),
      ).resolves.toBeUndefined();
    });

    it("logs error to console when recording fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const failingCtx = {
        scheduler: {
          runAfter: vi.fn().mockRejectedValue(new Error("scheduler down")),
        },
      };

      await recordError(failingCtx, "mutation", "test.op", new Error("original"));

      expect(consoleSpy).toHaveBeenCalledWith(
        "[errorRecording] Failed to record: test.op",
        "original",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });
});
