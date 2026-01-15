import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useDebounce,
  useDebouncedCallback,
  useLeadingDebouncedCallback,
} from "../use-debounce";
import { useFakeTimers } from "../../../test-utils";

// All debounce tests use fake timers - setup once at top level
describe("debounce hooks", () => {
  const { advanceTime } = useFakeTimers();

  describe("useDebounce", () => {
    it("returns initial value immediately", () => {
      const { result } = renderHook(() => useDebounce("initial", 300));
      expect(result.current).toBe("initial");
    });

    it("debounces value changes", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: "initial" } }
      );

      // Change value
      rerender({ value: "changed" });

      // Value should still be initial before delay
      expect(result.current).toBe("initial");

      // Advance timer past delay
      act(() => {
        advanceTime(300);
      });

      // Now value should be updated
      expect(result.current).toBe("changed");
    });

    it("uses default delay of 300ms", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value),
        {
          initialProps: { value: "initial" },
        }
      );

      rerender({ value: "changed" });
      expect(result.current).toBe("initial");

      act(() => {
        advanceTime(299);
      });
      expect(result.current).toBe("initial");

      act(() => {
        advanceTime(1);
      });
      expect(result.current).toBe("changed");
    });

    it("resets timer on rapid value changes", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: "a" } }
      );

      // Rapid changes
      rerender({ value: "b" });
      act(() => {
        advanceTime(100);
      });

      rerender({ value: "c" });
      act(() => {
        advanceTime(100);
      });

      rerender({ value: "d" });

      // Still should be 'a' because timer keeps resetting
      expect(result.current).toBe("a");

      // Wait full delay from last change
      act(() => {
        advanceTime(300);
      });

      // Should be final value
      expect(result.current).toBe("d");
    });

    it("works with objects", () => {
      const initial = { count: 0 };
      const updated = { count: 1 };

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, 300),
        { initialProps: { value: initial } }
      );

      expect(result.current).toEqual(initial);

      rerender({ value: updated });

      act(() => {
        advanceTime(300);
      });

      expect(result.current).toEqual(updated);
    });
  });

  describe("useDebouncedCallback", () => {
    it("debounces callback execution", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 300));

      // Call multiple times rapidly
      result.current("a");
      result.current("b");
      result.current("c");

      // Callback should not have been called yet
      expect(callback).not.toHaveBeenCalled();

      // Advance timer
      act(() => {
        advanceTime(300);
      });

      // Callback should be called once with last args
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("c");
    });

    it("uses default delay of 300ms", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback));

      result.current();

      act(() => {
        advanceTime(299);
      });
      expect(callback).not.toHaveBeenCalled();

      act(() => {
        advanceTime(1);
      });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("maintains callback identity on re-renders", () => {
      const callback = vi.fn();
      const { result, rerender } = renderHook(
        ({ cb }) => useDebouncedCallback(cb, 300),
        { initialProps: { cb: callback } }
      );

      const firstCallback = result.current;
      rerender({ cb: callback });
      const secondCallback = result.current;

      // Should be the same function reference
      expect(firstCallback).toBe(secondCallback);
    });

    it("cleans up timer on unmount", () => {
      const callback = vi.fn();
      const { result, unmount } = renderHook(() =>
        useDebouncedCallback(callback, 300)
      );

      result.current("test");
      unmount();

      act(() => {
        advanceTime(300);
      });

      // Callback should not be called after unmount
      expect(callback).not.toHaveBeenCalled();
    });

    it("handles multiple arguments", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 300));

      result.current("arg1", "arg2", "arg3");

      act(() => {
        advanceTime(300);
      });

      expect(callback).toHaveBeenCalledWith("arg1", "arg2", "arg3");
    });
  });

  describe("useLeadingDebouncedCallback", () => {
    it("executes callback immediately on first call", () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useLeadingDebouncedCallback(callback, 300)
      );

      result.current("first");

      // Should be called immediately
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("first");
    });

    it("ignores subsequent calls within delay period", () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useLeadingDebouncedCallback(callback, 300)
      );

      result.current("first");
      result.current("second");
      result.current("third");

      // Only first call should have executed
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("first");
    });

    it("allows new call after delay period", () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useLeadingDebouncedCallback(callback, 300)
      );

      result.current("first");
      expect(callback).toHaveBeenCalledTimes(1);

      // Advance past delay
      act(() => {
        advanceTime(300);
      });

      result.current("second");
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith("second");
    });

    it("uses default delay of 300ms", () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useLeadingDebouncedCallback(callback)
      );

      result.current("first");
      expect(callback).toHaveBeenCalledTimes(1);

      // Should still be blocked at 299ms
      act(() => {
        advanceTime(299);
      });

      result.current("blocked");
      expect(callback).toHaveBeenCalledTimes(1);

      // Should allow at 300ms
      act(() => {
        advanceTime(1);
      });

      result.current("allowed");
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("cleans up timer on unmount", () => {
      const callback = vi.fn();
      const { result, unmount } = renderHook(() =>
        useLeadingDebouncedCallback(callback, 300)
      );

      result.current("test");
      expect(callback).toHaveBeenCalledTimes(1);

      unmount();

      // Remount and call again should work (timer was cleaned up)
      const { result: result2 } = renderHook(() =>
        useLeadingDebouncedCallback(callback, 300)
      );

      result2.current("new call");
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe("useDebouncedCallback error handling", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("catches and logs sync errors in callback", () => {
      const error = new Error("Sync error");
      const callback = vi.fn(() => {
        throw error;
      });
      const { result } = renderHook(() => useDebouncedCallback(callback, 100));

      result.current();

      // Advance timer to trigger callback
      act(() => {
        advanceTime(100);
      });

      expect(callback).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "[useDebouncedCallback] Callback error:",
        error
      );
    });

    it("catches and logs async errors in callback", async () => {
      const error = new Error("Async error");
      const callback = vi.fn(async () => {
        throw error;
      });
      const { result } = renderHook(() => useDebouncedCallback(callback, 100));

      result.current();

      act(() => {
        advanceTime(100);
      });

      // Wait for promise rejection to be caught
      await vi.waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          "[useDebouncedCallback] Async callback error:",
          error
        );
      });
    });

    it("handles delay of 0 (nearly immediate)", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 0));

      result.current("test");

      // Even with 0 delay, callback is async
      expect(callback).not.toHaveBeenCalled();

      act(() => {
        advanceTime(0);
      });

      expect(callback).toHaveBeenCalledWith("test");
    });

    it("handles large delay values", () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useDebouncedCallback(callback, 10000)
      );

      result.current("test");

      act(() => {
        advanceTime(9999);
      });
      expect(callback).not.toHaveBeenCalled();

      act(() => {
        advanceTime(1);
      });
      expect(callback).toHaveBeenCalledWith("test");
    });
  });

  describe("useLeadingDebouncedCallback error handling", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("catches and logs sync errors in callback", () => {
      const error = new Error("Leading sync error");
      const callback = vi.fn(() => {
        throw error;
      });
      const { result } = renderHook(() =>
        useLeadingDebouncedCallback(callback, 100)
      );

      result.current();

      expect(callback).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "[useLeadingDebouncedCallback] Callback error:",
        error
      );
    });

    it("remains functional after callback throws", () => {
      const callback = vi.fn().mockImplementationOnce(() => {
        throw new Error("First call error");
      });
      const { result } = renderHook(() =>
        useLeadingDebouncedCallback(callback, 100)
      );

      // First call throws
      result.current("first");
      expect(callback).toHaveBeenCalledTimes(1);

      // Wait for blocking period to end
      act(() => {
        advanceTime(100);
      });

      // Second call should work
      result.current("second");
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith("second");
    });

    it("catches and logs async errors in callback", async () => {
      const error = new Error("Leading async error");
      const callback = vi.fn(async () => {
        throw error;
      });
      const { result } = renderHook(() =>
        useLeadingDebouncedCallback(callback, 100)
      );

      result.current();

      // Wait for promise rejection to be caught
      await vi.waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          "[useLeadingDebouncedCallback] Async callback error:",
          error
        );
      });
    });
  });
});
