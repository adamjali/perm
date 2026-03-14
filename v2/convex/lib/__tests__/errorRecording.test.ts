import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the internal API before importing the module.
// With isolate:false this mock may not fully intercept — assertions
// below avoid comparing the function reference directly.
vi.mock("../../_generated/api", () => ({
  internal: {
    systemErrors: {
      record: "mock-system-errors-record",
    },
    sentryReportAction: {
      report: "mock-sentry-report",
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

  /** Helper: get the args object from the first runAfter call (systemErrors.record). */
  function getRecordArgs() {
    return mockRunAfter.mock.calls[0][2] as Record<string, unknown>;
  }

  describe("error message extraction", () => {
    it("extracts message from Error instances", async () => {
      await recordError(mockCtx, "mutation", "test.op", new Error("boom"));

      expect(mockRunAfter).toHaveBeenCalled();
      expect(getRecordArgs().message).toBe("boom");
    });

    it("extracts stack from Error instances", async () => {
      const error = new Error("boom");
      await recordError(mockCtx, "action", "test.op", error);

      expect(mockRunAfter).toHaveBeenCalled();
      expect(getRecordArgs().stack).toEqual(expect.stringContaining("Error: boom"));
    });

    it("converts non-Error values to string message", async () => {
      await recordError(mockCtx, "mutation", "test.op", "string error");

      expect(mockRunAfter).toHaveBeenCalled();
      const args = getRecordArgs();
      expect(args.message).toBe("string error");
      expect(args.stack).toBeUndefined();
    });

    it("handles null/undefined errors", async () => {
      await recordError(mockCtx, "cron", "test.op", null);

      expect(mockRunAfter).toHaveBeenCalled();
      expect(getRecordArgs().message).toBe("null");
    });

    it("handles number errors", async () => {
      await recordError(mockCtx, "webhook", "test.op", 42);

      expect(mockRunAfter).toHaveBeenCalled();
      expect(getRecordArgs().message).toBe("42");
    });
  });

  describe("source and operation", () => {
    it("passes source and operation through", async () => {
      await recordError(mockCtx, "cron", "scheduledJobs.cleanup", new Error("fail"));

      expect(mockRunAfter).toHaveBeenCalled();
      const args = getRecordArgs();
      expect(args.source).toBe("cron");
      expect(args.operation).toBe("scheduledJobs.cleanup");
    });
  });

  describe("optional fields", () => {
    it("includes userId when provided", async () => {
      await recordError(mockCtx, "mutation", "op", new Error("x"), {
        userId: "user123" as any,
      });

      expect(getRecordArgs().userId).toBe("user123");
    });

    it("includes resourceId when provided", async () => {
      await recordError(mockCtx, "mutation", "op", new Error("x"), {
        resourceId: "case456",
      });

      expect(getRecordArgs().resourceId).toBe("case456");
    });

    it("includes extra when provided", async () => {
      await recordError(mockCtx, "mutation", "op", new Error("x"), {
        extra: JSON.stringify({ key: "val" }),
      });

      expect(getRecordArgs().extra).toBe('{"key":"val"}');
    });

    it("omits optional fields when not provided", async () => {
      await recordError(mockCtx, "mutation", "op", new Error("x"));

      const args = getRecordArgs();
      expect(args.userId).toBeUndefined();
      expect(args.resourceId).toBeUndefined();
      expect(args.extra).toBeUndefined();
    });

    it("omits optional fields when empty string", async () => {
      await recordError(mockCtx, "mutation", "op", new Error("x"), {
        resourceId: "",
        extra: "",
      });

      const args = getRecordArgs();
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
