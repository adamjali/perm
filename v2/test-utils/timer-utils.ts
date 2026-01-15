/**
 * Centralized fake timer utilities
 *
 * Eliminates duplicated beforeEach/afterEach blocks across test files.
 * Provides consistent timer setup with automatic cleanup.
 */
import { vi, beforeEach, afterEach } from "vitest";

interface FakeTimerOptions {
  /** Enable auto-advancing timers (for userEvent compatibility) */
  shouldAdvanceTime?: boolean;
  /** Initial system date to set */
  initialDate?: Date | string;
}

interface TimerControls {
  /** Advance timers by specified milliseconds */
  advanceTime: (ms: number) => void;
  /** Set the system time to a specific date */
  setSystemTime: (date: Date | string) => void;
  /** Run all pending timers synchronously */
  runAllTimers: () => void;
  /** Run all pending timers asynchronously */
  runAllTimersAsync: () => Promise<unknown>;
  /** Run only pending timers (not new ones scheduled during execution) */
  runOnlyPendingTimers: () => void;
  /** Run only pending timers asynchronously */
  runOnlyPendingTimersAsync: () => Promise<unknown>;
  /** Advance timers to next timer callback */
  advanceTimersToNextTimer: () => void;
  /** Get count of pending timers */
  getTimerCount: () => number;
  /** Clear all timers without running them */
  clearAllTimers: () => void;
}

/**
 * Setup fake timers for a describe block with automatic cleanup.
 *
 * @example
 * describe("MyTests", () => {
 *   const { advanceTime, setSystemTime } = useFakeTimers();
 *
 *   it("debounces input", () => {
 *     // ... trigger debounced action
 *     advanceTime(300);
 *     // ... assert debounced result
 *   });
 * });
 *
 * @example
 * describe("DateTests", () => {
 *   const { setSystemTime } = useFakeTimers({ initialDate: "2024-06-01" });
 *
 *   it("calculates deadline correctly", () => {
 *     // System time is 2024-06-01
 *     setSystemTime("2024-07-15"); // Change mid-test if needed
 *   });
 * });
 */
export function useFakeTimers(options?: FakeTimerOptions): TimerControls {
  beforeEach(() => {
    vi.useFakeTimers({
      shouldAdvanceTime: options?.shouldAdvanceTime ?? false,
    });
    if (options?.initialDate) {
      vi.setSystemTime(
        typeof options.initialDate === "string"
          ? new Date(options.initialDate)
          : options.initialDate
      );
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  return {
    advanceTime: (ms: number) => vi.advanceTimersByTime(ms),
    setSystemTime: (date: Date | string) =>
      vi.setSystemTime(typeof date === "string" ? new Date(date) : date),
    runAllTimers: () => vi.runAllTimers(),
    runAllTimersAsync: () => vi.runAllTimersAsync(),
    runOnlyPendingTimers: () => vi.runOnlyPendingTimers(),
    runOnlyPendingTimersAsync: () => vi.runOnlyPendingTimersAsync(),
    advanceTimersToNextTimer: () => vi.advanceTimersToNextTimer(),
    getTimerCount: () => vi.getTimerCount(),
    clearAllTimers: () => vi.clearAllTimers(),
  };
}

/**
 * Setup fake timers with auto-advance for userEvent compatibility.
 *
 * Use this when testing with @testing-library/user-event which needs
 * timers to advance automatically during interactions.
 *
 * @example
 * describe("FormTests", () => {
 *   const { advanceTime } = useAutoAdvancingTimers();
 *
 *   it("handles user input with debounce", async () => {
 *     const user = userEvent.setup();
 *     await user.type(input, "hello");
 *     advanceTime(300); // Debounce completes
 *   });
 * });
 */
export function useAutoAdvancingTimers(
  initialDate?: Date | string
): TimerControls {
  return useFakeTimers({
    shouldAdvanceTime: true,
    initialDate,
  });
}

/**
 * Setup fake timers with a specific system date.
 *
 * Shorthand for useFakeTimers({ initialDate: date }).
 *
 * @example
 * describe("DeadlineCalculations", () => {
 *   const { advanceTime } = useFakeTimersWithDate("2024-06-01");
 *
 *   it("calculates PWD expiration", () => {
 *     // System time is 2024-06-01
 *     const result = calculatePWDExpiration("2024-06-01");
 *     expect(result).toBe("2025-06-30");
 *   });
 * });
 */
export function useFakeTimersWithDate(date: Date | string): TimerControls {
  return useFakeTimers({ initialDate: date });
}

/**
 * One-off timer setup for a single test (doesn't use beforeEach/afterEach).
 *
 * Useful when only one or two tests in a file need fake timers.
 * Remember to call cleanup() when done!
 *
 * @example
 * it("single test with timers", () => {
 *   const { advanceTime, cleanup } = setupFakeTimersOnce("2024-06-01");
 *   try {
 *     // test logic
 *     advanceTime(1000);
 *   } finally {
 *     cleanup();
 *   }
 * });
 */
export function setupFakeTimersOnce(
  initialDate?: Date | string,
  options?: Omit<FakeTimerOptions, "initialDate">
): TimerControls & { cleanup: () => void } {
  vi.useFakeTimers({
    shouldAdvanceTime: options?.shouldAdvanceTime ?? false,
  });

  if (initialDate) {
    vi.setSystemTime(
      typeof initialDate === "string" ? new Date(initialDate) : initialDate
    );
  }

  return {
    advanceTime: (ms: number) => vi.advanceTimersByTime(ms),
    setSystemTime: (date: Date | string) =>
      vi.setSystemTime(typeof date === "string" ? new Date(date) : date),
    runAllTimers: () => vi.runAllTimers(),
    runAllTimersAsync: () => vi.runAllTimersAsync(),
    runOnlyPendingTimers: () => vi.runOnlyPendingTimers(),
    runOnlyPendingTimersAsync: () => vi.runOnlyPendingTimersAsync(),
    advanceTimersToNextTimer: () => vi.advanceTimersToNextTimer(),
    getTimerCount: () => vi.getTimerCount(),
    clearAllTimers: () => vi.clearAllTimers(),
    cleanup: () => vi.useRealTimers(),
  };
}
