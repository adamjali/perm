/**
 * Debounce Hooks
 *
 * Reusable debounce utilities for value and callback debouncing.
 * All callback hooks include error handling for sync and async callbacks.
 */

import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_DELAY = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

/** Keeps a ref synchronized with the latest callback value */
function useCallbackRef<T extends AnyFunction>(callback: T): React.RefObject<T> {
  const ref = useRef<T>(callback);
  useEffect(() => {
    ref.current = callback;
  }, [callback]);
  return ref;
}

/** Manages timer cleanup on unmount */
function useTimerRef(): React.MutableRefObject<ReturnType<typeof setTimeout> | null> {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);
  return timerRef;
}

/** Execute callback with error handling for sync and async errors */
function safeExecute<T extends AnyFunction>(
  callback: T,
  args: Parameters<T>,
  hookName: string
): void {
  try {
    const result = callback(...args);
    if (result instanceof Promise) {
      result.catch((error: unknown) => {
        console.error(`[${hookName}] Async callback error:`, error);
      });
    }
  } catch (error) {
    console.error(`[${hookName}] Callback error:`, error);
  }
}

/**
 * Debounce a value (trailing edge).
 * Returns the value after the specified delay of no changes.
 */
export function useDebounce<T>(value: T, delay: number = DEFAULT_DELAY): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounce a callback function (trailing edge).
 * Multiple rapid calls result in only the last one being executed after the delay.
 */
export function useDebouncedCallback<T extends AnyFunction>(
  callback: T,
  delay: number = DEFAULT_DELAY
): T {
  const callbackRef = useCallbackRef(callback);
  const timerRef = useTimerRef();

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        safeExecute(callbackRef.current, args, "useDebouncedCallback");
      }, delay);
    },
    [callbackRef, timerRef, delay]
  ) as T;
}

/**
 * Debounce a callback function (leading edge).
 * Executes immediately on first call, then ignores subsequent calls within the delay.
 * Useful for preventing double-clicks.
 */
export function useLeadingDebouncedCallback<T extends AnyFunction>(
  callback: T,
  delay: number = DEFAULT_DELAY
): T {
  const callbackRef = useCallbackRef(callback);
  const timerRef = useTimerRef();
  const isBlockedRef = useRef(false);

  return useCallback(
    (...args: Parameters<T>) => {
      if (isBlockedRef.current) return;

      isBlockedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        isBlockedRef.current = false;
      }, delay);

      safeExecute(callbackRef.current, args, "useLeadingDebouncedCallback");
    },
    [callbackRef, timerRef, delay]
  ) as T;
}
