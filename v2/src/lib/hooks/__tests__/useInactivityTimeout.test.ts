/**
 * useInactivityTimeout Hook Tests
 *
 * Tests:
 * - Timer initialization and cleanup
 * - Warning callback triggers at correct time
 * - Timeout callback triggers at correct time
 * - Activity resets timer
 * - extendSession resets timer when warning is visible
 * - formatTimeRemaining utility
 *
 * Phase: 20 (Dashboard + UI Polish)
 * Created: 2025-12-24
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInactivityTimeout, formatTimeRemaining } from "../useInactivityTimeout";

// ============================================================================
// SETUP
// ============================================================================

describe("useInactivityTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", { value: localStorageMock });

    // Mock BroadcastChannel
    vi.stubGlobal("BroadcastChannel", class {
      onmessage = null;
      postMessage = vi.fn();
      close = vi.fn();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // --------------------------------------------------------------------------
  // INITIALIZATION TESTS
  // --------------------------------------------------------------------------

  describe("Initialization", () => {
    it("returns isWarningVisible as false initially", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() =>
        useInactivityTimeout({ onTimeout })
      );

      expect(result.current.isWarningVisible).toBe(false);
    });

    it("returns remainingSeconds as 120 initially", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() =>
        useInactivityTimeout({ onTimeout })
      );

      expect(result.current.remainingSeconds).toBe(120);
    });

    it("does not call onTimeout immediately", () => {
      const onTimeout = vi.fn();
      renderHook(() => useInactivityTimeout({ onTimeout }));

      expect(onTimeout).not.toHaveBeenCalled();
    });

    it("does not start timers when disabled", () => {
      const onTimeout = vi.fn();
      const onWarning = vi.fn();

      renderHook(() =>
        useInactivityTimeout({ onTimeout, onWarning, enabled: false })
      );

      // Advance to warning time (13 minutes)
      act(() => {
        vi.advanceTimersByTime(13 * 60 * 1000);
      });

      expect(onWarning).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // WARNING CALLBACK TESTS
  // --------------------------------------------------------------------------

  describe("Warning callback", () => {
    it("calls onWarning after 13 minutes of inactivity", () => {
      const onTimeout = vi.fn();
      const onWarning = vi.fn();

      renderHook(() =>
        useInactivityTimeout({ onTimeout, onWarning })
      );

      // Advance to just before warning (12:59)
      act(() => {
        vi.advanceTimersByTime(12 * 60 * 1000 + 59 * 1000);
      });
      expect(onWarning).not.toHaveBeenCalled();

      // Advance to warning time (13:00)
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it("sets isWarningVisible to true when warning triggers", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() =>
        useInactivityTimeout({ onTimeout })
      );

      act(() => {
        vi.advanceTimersByTime(13 * 60 * 1000);
      });

      expect(result.current.isWarningVisible).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // TIMEOUT CALLBACK TESTS
  // --------------------------------------------------------------------------

  describe("Timeout callback", () => {
    it("calls onTimeout after 15 minutes of inactivity", () => {
      const onTimeout = vi.fn();

      renderHook(() => useInactivityTimeout({ onTimeout }));

      // Advance to just before timeout (14:59)
      act(() => {
        vi.advanceTimersByTime(14 * 60 * 1000 + 59 * 1000);
      });
      expect(onTimeout).not.toHaveBeenCalled();

      // Advance to timeout (15:00)
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it("sets isWarningVisible to false when timeout triggers", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() =>
        useInactivityTimeout({ onTimeout })
      );

      act(() => {
        vi.advanceTimersByTime(15 * 60 * 1000);
      });

      expect(result.current.isWarningVisible).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // EXTEND SESSION TESTS
  // --------------------------------------------------------------------------

  describe("extendSession", () => {
    it("resets isWarningVisible to false", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() =>
        useInactivityTimeout({ onTimeout })
      );

      // Trigger warning
      act(() => {
        vi.advanceTimersByTime(13 * 60 * 1000);
      });
      expect(result.current.isWarningVisible).toBe(true);

      // Extend session
      act(() => {
        result.current.extendSession();
      });

      expect(result.current.isWarningVisible).toBe(false);
    });

    it("resets remainingSeconds to 120", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() =>
        useInactivityTimeout({ onTimeout })
      );

      // Trigger warning and let countdown run
      act(() => {
        vi.advanceTimersByTime(13 * 60 * 1000 + 30 * 1000);
      });
      expect(result.current.remainingSeconds).toBeLessThan(120);

      // Extend session
      act(() => {
        result.current.extendSession();
      });

      expect(result.current.remainingSeconds).toBe(120);
    });

    it("prevents timeout when called during warning period", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() =>
        useInactivityTimeout({ onTimeout })
      );

      // Advance to warning + 1 minute
      act(() => {
        vi.advanceTimersByTime(14 * 60 * 1000);
      });

      // Extend session
      act(() => {
        result.current.extendSession();
      });

      // Advance past what would have been original timeout
      act(() => {
        vi.advanceTimersByTime(2 * 60 * 1000);
      });

      // onTimeout should not have been called
      expect(onTimeout).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // RESET TIMEOUT TESTS
  // --------------------------------------------------------------------------

  describe("resetTimeout", () => {
    it("restarts the warning timer", () => {
      const onTimeout = vi.fn();
      const onWarning = vi.fn();
      const { result } = renderHook(() =>
        useInactivityTimeout({ onTimeout, onWarning })
      );

      // Advance 12 minutes
      act(() => {
        vi.advanceTimersByTime(12 * 60 * 1000);
      });
      expect(onWarning).not.toHaveBeenCalled();

      // Reset timeout (simulates user activity)
      act(() => {
        result.current.resetTimeout();
      });

      // Advance 12 more minutes from reset point
      act(() => {
        vi.advanceTimersByTime(12 * 60 * 1000);
      });

      // Warning should not have fired yet (only 12 min from last activity)
      expect(onWarning).not.toHaveBeenCalled();

      // Advance 1 more minute to hit 13 min from reset
      act(() => {
        vi.advanceTimersByTime(1 * 60 * 1000);
      });

      expect(onWarning).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // CLEANUP TESTS
  // --------------------------------------------------------------------------

  describe("Cleanup", () => {
    it("clears timers on unmount", () => {
      const onTimeout = vi.fn();
      const { unmount } = renderHook(() =>
        useInactivityTimeout({ onTimeout })
      );

      unmount();

      // Advance past timeout time
      act(() => {
        vi.advanceTimersByTime(20 * 60 * 1000);
      });

      // onTimeout should not be called after unmount
      expect(onTimeout).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// FORMAT TIME REMAINING TESTS
// ============================================================================

describe("formatTimeRemaining", () => {
  it("formats 120 seconds as 2:00", () => {
    expect(formatTimeRemaining(120)).toBe("2:00");
  });

  it("formats 65 seconds as 1:05", () => {
    expect(formatTimeRemaining(65)).toBe("1:05");
  });

  it("formats 9 seconds as 0:09", () => {
    expect(formatTimeRemaining(9)).toBe("0:09");
  });

  it("formats 0 seconds as 0:00", () => {
    expect(formatTimeRemaining(0)).toBe("0:00");
  });

  it("handles negative numbers as 0:00", () => {
    expect(formatTimeRemaining(-10)).toBe("0:00");
  });

  it("handles decimal numbers by flooring", () => {
    expect(formatTimeRemaining(65.9)).toBe("1:05");
  });
});
