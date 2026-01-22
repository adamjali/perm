/**
 * Tests for Auth-Aware Toast Wrapper
 *
 * Verifies:
 * - Toasts show when isSigningOut is false (normal operation)
 * - Toasts are suppressed when isSigningOut is true
 * - Dismiss always works regardless of state
 * - Promise toasts still return the promise even when suppressed
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { toast as sonnerToast } from "sonner";
import { toast, updateToastAuthState, getToastAuthState } from "../toast";

// Mock sonner
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(() => "toast-id-default"), {
    success: vi.fn(() => "toast-id-success"),
    error: vi.fn(() => "toast-id-error"),
    warning: vi.fn(() => "toast-id-warning"),
    info: vi.fn(() => "toast-id-info"),
    loading: vi.fn(() => "toast-id-loading"),
    custom: vi.fn(() => "toast-id-custom"),
    message: vi.fn(() => "toast-id-message"),
    promise: vi.fn((promise) => promise),
    dismiss: vi.fn(),
  }),
}));

describe("Auth-Aware Toast", () => {
  // Reset module state at suite start to ensure clean isolation
  beforeAll(() => {
    updateToastAuthState(false);
  });

  beforeEach(() => {
    // Reset state FIRST (before clearing mocks) to handle any cross-test pollution
    updateToastAuthState(false);
    vi.clearAllMocks();
    // Reset state again AFTER clearing mocks to ensure clean state
    updateToastAuthState(false);
  });

  afterEach(() => {
    // Clean up
    updateToastAuthState(false);
  });

  describe("updateToastAuthState", () => {
    it("updates the signing out state to true", () => {
      updateToastAuthState(true);
      expect(getToastAuthState()).toBe(true);
    });

    it("updates the signing out state to false", () => {
      updateToastAuthState(true);
      updateToastAuthState(false);
      expect(getToastAuthState()).toBe(false);
    });

    it("defaults to false (toasts allowed)", () => {
      expect(getToastAuthState()).toBe(false);
    });
  });

  describe("when NOT signing out (normal operation)", () => {
    beforeEach(() => {
      updateToastAuthState(false);
    });

    it("forwards default toast to sonner", () => {
      toast("Test message");
      expect(sonnerToast).toHaveBeenCalledWith("Test message", undefined);
    });

    it("forwards success toast to sonner", () => {
      toast.success("Success!");
      expect(sonnerToast.success).toHaveBeenCalledWith("Success!", undefined);
    });

    it("forwards error toast to sonner", () => {
      toast.error("Error!");
      expect(sonnerToast.error).toHaveBeenCalledWith("Error!", undefined);
    });

    it("forwards warning toast to sonner", () => {
      toast.warning("Warning!");
      expect(sonnerToast.warning).toHaveBeenCalledWith("Warning!", undefined);
    });

    it("forwards info toast to sonner", () => {
      toast.info("Info");
      expect(sonnerToast.info).toHaveBeenCalledWith("Info", undefined);
    });

    it("forwards loading toast to sonner", () => {
      toast.loading("Loading...");
      expect(sonnerToast.loading).toHaveBeenCalledWith("Loading...", undefined);
    });

    it("forwards custom toast to sonner", () => {
      const customFn = vi.fn();
      toast.custom(customFn);
      expect(sonnerToast.custom).toHaveBeenCalledWith(customFn, undefined);
    });

    it("forwards message toast to sonner", () => {
      toast.message("Message");
      expect(sonnerToast.message).toHaveBeenCalledWith("Message", undefined);
    });

    it("forwards toast with options", () => {
      toast.success("Test", { duration: 3000, description: "Details" });
      expect(sonnerToast.success).toHaveBeenCalledWith("Test", {
        duration: 3000,
        description: "Details",
      });
    });

    it("forwards promise toast to sonner", async () => {
      const promise = Promise.resolve("data");
      const result = toast.promise(promise, {
        loading: "Loading...",
        success: "Done!",
        error: "Failed",
      });

      expect(sonnerToast.promise).toHaveBeenCalledWith(promise, {
        loading: "Loading...",
        success: "Done!",
        error: "Failed",
      });
      await expect(result).resolves.toBe("data");
    });

    it("forwards dismiss to sonner", () => {
      toast.dismiss("toast-id");
      expect(sonnerToast.dismiss).toHaveBeenCalledWith("toast-id");
    });

    it("returns toast ID from sonner", () => {
      const id = toast.success("Test");
      expect(id).toBe("toast-id-success");
    });
  });

  describe("when signing out", () => {
    beforeEach(() => {
      updateToastAuthState(true);
    });

    it("suppresses default toast", () => {
      const result = toast("Test message");
      expect(sonnerToast).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("suppresses success toast", () => {
      const result = toast.success("Success!");
      expect(sonnerToast.success).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("suppresses error toast", () => {
      const result = toast.error("Error!");
      expect(sonnerToast.error).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("suppresses warning toast", () => {
      const result = toast.warning("Warning!");
      expect(sonnerToast.warning).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("suppresses info toast", () => {
      const result = toast.info("Info");
      expect(sonnerToast.info).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("suppresses loading toast", () => {
      const result = toast.loading("Loading...");
      expect(sonnerToast.loading).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("suppresses custom toast", () => {
      const customFn = vi.fn();
      const result = toast.custom(customFn);
      expect(sonnerToast.custom).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("suppresses message toast", () => {
      const result = toast.message("Message");
      expect(sonnerToast.message).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("suppresses promise toast but still returns promise wrapper", async () => {
      const promise = Promise.resolve("data");
      const result = toast.promise(promise, {
        loading: "Loading...",
        success: "Done!",
        error: "Failed",
      });

      // Promise should NOT be shown
      expect(sonnerToast.promise).not.toHaveBeenCalled();

      // But wrapped promise should still resolve via unwrap()
      expect(result).toBeDefined();
      expect(result).toHaveProperty("unwrap");
      await expect(result.unwrap()).resolves.toBe("data");
    });

    it("ALWAYS allows dismiss (cleanup should never be blocked)", () => {
      toast.dismiss("toast-id");
      expect(sonnerToast.dismiss).toHaveBeenCalledWith("toast-id");
    });

    it("allows dismiss without ID (dismiss all)", () => {
      toast.dismiss();
      expect(sonnerToast.dismiss).toHaveBeenCalledWith(undefined);
    });
  });

  describe("state transitions", () => {
    it("allows toasts after signing out completes", () => {
      // Start signing out
      updateToastAuthState(true);
      toast.success("During sign out");
      expect(sonnerToast.success).not.toHaveBeenCalled();

      // Sign out completes
      updateToastAuthState(false);
      toast.success("After sign out");
      expect(sonnerToast.success).toHaveBeenCalledWith(
        "After sign out",
        undefined
      );
    });

    it("suppresses toasts when sign-out begins mid-operation", () => {
      // Normal operation
      toast.success("First toast");
      expect(sonnerToast.success).toHaveBeenCalledTimes(1);

      // Sign out begins
      updateToastAuthState(true);

      // Subsequent toasts suppressed
      toast.success("Second toast");
      toast.error("Error toast");
      expect(sonnerToast.success).toHaveBeenCalledTimes(1);
      expect(sonnerToast.error).not.toHaveBeenCalled();
    });
  });
});
