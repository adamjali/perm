import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleOperationError } from "@/lib/errors";

// Mock dependencies
vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { captureError } from "@/lib/sentry";
import { toast } from "@/lib/toast";

describe("handleOperationError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures error and shows error toast by default", () => {
    const error = new Error("test error");
    handleOperationError(error, { userMessage: "Something failed" });

    expect(captureError).toHaveBeenCalledWith(error, undefined);
    expect(toast.error).toHaveBeenCalledWith("Something failed");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("passes context to captureError", () => {
    const error = new Error("test");
    const context = { operation: "updateCase", resourceId: "abc123" };
    handleOperationError(error, { userMessage: "Failed", context });

    expect(captureError).toHaveBeenCalledWith(error, context);
  });

  it("shows warning toast when level is warning", () => {
    const error = new Error("test");
    handleOperationError(error, {
      userMessage: "Partial failure",
      level: "warning",
    });

    expect(captureError).toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith("Partial failure");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("suppresses toast when silent is true", () => {
    const error = new Error("test");
    handleOperationError(error, {
      userMessage: "Hidden",
      silent: true,
    });

    expect(captureError).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
