import { vi, beforeEach, afterEach } from "vitest";

interface FakeTimerOptions {
  shouldAdvanceTime?: boolean;
  initialDate?: Date | string;
}

interface TimerControls {
  advanceTime: (ms: number) => void;
  setSystemTime: (date: Date | string) => void;
  runAllTimers: () => void;
  runAllTimersAsync: () => Promise<unknown>;
  runOnlyPendingTimers: () => void;
  runOnlyPendingTimersAsync: () => Promise<unknown>;
  advanceTimersToNextTimer: () => void;
  getTimerCount: () => number;
  clearAllTimers: () => void;
}

function makeControls(): TimerControls {
  const toDate = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);
  return {
    advanceTime: (ms) => vi.advanceTimersByTime(ms),
    setSystemTime: (date) => vi.setSystemTime(toDate(date)),
    runAllTimers: () => vi.runAllTimers(),
    runAllTimersAsync: () => vi.runAllTimersAsync(),
    runOnlyPendingTimers: () => vi.runOnlyPendingTimers(),
    runOnlyPendingTimersAsync: () => vi.runOnlyPendingTimersAsync(),
    advanceTimersToNextTimer: () => vi.advanceTimersToNextTimer(),
    getTimerCount: () => vi.getTimerCount(),
    clearAllTimers: () => vi.clearAllTimers(),
  };
}

/** Setup fake timers for a describe block with automatic cleanup */
export function useFakeTimers(options?: FakeTimerOptions): TimerControls {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: options?.shouldAdvanceTime ?? false });
    if (options?.initialDate) {
      const d = options.initialDate;
      vi.setSystemTime(typeof d === "string" ? new Date(d) : d);
    }
  });
  afterEach(() => vi.useRealTimers());
  return makeControls();
}

/** Fake timers with auto-advance for userEvent compatibility */
export function useAutoAdvancingTimers(initialDate?: Date | string): TimerControls {
  return useFakeTimers({ shouldAdvanceTime: true, initialDate });
}

/** Fake timers pinned to a specific date */
export function useFakeTimersWithDate(date: Date | string): TimerControls {
  return useFakeTimers({ initialDate: date });
}

/** One-off timer setup for a single test — call cleanup() when done */
export function setupFakeTimersOnce(
  initialDate?: Date | string,
  options?: Omit<FakeTimerOptions, "initialDate">
): TimerControls & { cleanup: () => void } {
  vi.useFakeTimers({ shouldAdvanceTime: options?.shouldAdvanceTime ?? false });
  if (initialDate) {
    vi.setSystemTime(typeof initialDate === "string" ? new Date(initialDate) : initialDate);
  }
  return { ...makeControls(), cleanup: () => vi.useRealTimers() };
}
