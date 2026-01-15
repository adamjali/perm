"use client";

/**
 * useInactivityTimeout Hook
 * Tracks user inactivity and triggers warning/logout after timeout.
 *
 * Features:
 * - 15 minute inactivity timeout (configurable)
 * - 2 minute warning before auto-logout
 * - Multi-tab sync via BroadcastChannel
 * - Debounced activity tracking
 * - Events: mouse, keyboard, scroll, touch
 * - Safe localStorage operations (handles private browsing)
 *
 * Phase: 20 (Dashboard + UI Polish)
 * Inspired by: v1/frontend/src/js/config/timeout.js
 * Updated: 2025-12-24 - Fixed memory leaks, stale closures, localStorage safety
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================================
// CONFIGURATION
// ============================================================================

const TIMEOUT_CONFIG = {
  /** Total inactivity timeout: 15 minutes (user is logged out after this) */
  INACTIVITY_TIMEOUT: 15 * 60 * 1000,
  /** Warning appears at 13 minutes (leaving 2 minutes for user response) */
  WARNING_TIME: 13 * 60 * 1000,
  /** Activity debounce: 1 second */
  ACTIVITY_DEBOUNCE: 1000,
  /** Countdown update interval: 1 second */
  COUNTDOWN_INTERVAL: 1000,
  /** BroadcastChannel name */
  CHANNEL_NAME: "perm-tracker-auth-channel",
  /** LocalStorage key */
  STORAGE_KEY: "perm-tracker-last-activity",
  /** Activity events to track */
  ACTIVITY_EVENTS: ["mousedown", "keydown", "scroll", "touchstart", "click"] as const,
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface UseInactivityTimeoutOptions {
  onTimeout: () => void;
  onWarning?: () => void;
  enabled?: boolean;
}

interface UseInactivityTimeoutReturn {
  isWarningVisible: boolean;
  remainingSeconds: number;
  extendSession: () => void;
  resetTimeout: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Safely get item from localStorage.
 * Returns null if localStorage is unavailable (private browsing, etc.)
 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // localStorage not available (private browsing, security restrictions)
    return null;
  }
}

/**
 * Safely set item in localStorage.
 * No-op if localStorage is unavailable.
 */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage not available - continue without persistence
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useInactivityTimeout({
  onTimeout,
  onWarning,
  enabled = true,
}: UseInactivityTimeoutOptions): UseInactivityTimeoutReturn {
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120); // 2 minutes

  // Refs for timer IDs - use lazy initialization via function to avoid calling Date.now() during render
  const lastActivityRef = useRef<number | null>(null);
  const getLastActivity = () => {
    if (lastActivityRef.current === null) {
      lastActivityRef.current = Date.now();
    }
    return lastActivityRef.current;
  };
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Refs for callbacks to avoid stale closures
  const onTimeoutRef = useRef(onTimeout);
  const onWarningRef = useRef(onWarning);
  const isWarningVisibleRef = useRef(isWarningVisible);

  // Keep callback refs updated
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);

  useEffect(() => {
    isWarningVisibleRef.current = isWarningVisible;
  }, [isWarningVisible]);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Update last activity in localStorage and broadcast to other tabs
  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    safeSetItem(TIMEOUT_CONFIG.STORAGE_KEY, now.toString());

    // Broadcast to other tabs
    if (channelRef.current) {
      try {
        channelRef.current.postMessage({ type: "activity", timestamp: now });
      } catch {
        // Channel may be closed - ignore
      }
    }
  }, []);

  // Start countdown timer (uses local interval ID to avoid stale closure)
  const startCountdown = useCallback(() => {
    const endTime = getLastActivity() + TIMEOUT_CONFIG.INACTIVITY_TIMEOUT;

    // Store interval ID locally to avoid stale ref in cleanup
    const intervalId = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(intervalId);
      }
    }, TIMEOUT_CONFIG.COUNTDOWN_INTERVAL);

    countdownIntervalRef.current = intervalId;
  }, []);

  // Start timeout timers
  const startTimers = useCallback(() => {
    clearAllTimers();

    // Warning timer (13 minutes)
    warningTimerRef.current = setTimeout(() => {
      setIsWarningVisible(true);
      setRemainingSeconds(120); // Reset to 2 minutes
      startCountdown();
      onWarningRef.current?.();
    }, TIMEOUT_CONFIG.WARNING_TIME);

    // Logout timer (15 minutes)
    logoutTimerRef.current = setTimeout(() => {
      setIsWarningVisible(false);
      onTimeoutRef.current();
    }, TIMEOUT_CONFIG.INACTIVITY_TIMEOUT);
  }, [clearAllTimers, startCountdown]);

  // Reset timeout (extend session)
  const resetTimeout = useCallback(() => {
    updateLastActivity();
    setIsWarningVisible(false);
    setRemainingSeconds(120);
    startTimers();
  }, [updateLastActivity, startTimers]);

  // Extend session (user clicked "Stay Logged In")
  const extendSession = useCallback(() => {
    resetTimeout();
  }, [resetTimeout]);

  // Handle activity - stable reference using ref
  const handleActivityRef = useRef<() => void>(() => {});

  useEffect(() => {
    handleActivityRef.current = () => {
      // Debounce activity events
      if (debounceTimerRef.current) return;

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
      }, TIMEOUT_CONFIG.ACTIVITY_DEBOUNCE);

      // Only reset if warning is not showing
      if (!isWarningVisibleRef.current) {
        resetTimeout();
      }
    };
  }, [resetTimeout]);

  // Stable activity handler for event listeners
  const handleActivity = useCallback(() => {
    handleActivityRef.current();
  }, []);

  // Handle messages from other tabs
  const handleChannelMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data.type === "activity") {
        lastActivityRef.current = event.data.timestamp;
        if (!isWarningVisibleRef.current) {
          startTimers();
        }
      } else if (event.data.type === "logout") {
        onTimeoutRef.current();
      }
    },
    [startTimers]
  );

  // Initialize
  useEffect(() => {
    if (!enabled) return;

    // Setup BroadcastChannel for multi-tab sync
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channelRef.current = new BroadcastChannel(TIMEOUT_CONFIG.CHANNEL_NAME);
        channelRef.current.onmessage = handleChannelMessage;
      } catch {
        // BroadcastChannel not supported - continue without multi-tab sync
      }
    }

    // Check localStorage for last activity from other tabs
    const storedActivity = safeGetItem(TIMEOUT_CONFIG.STORAGE_KEY);
    if (storedActivity) {
      const parsed = parseInt(storedActivity, 10);
      if (!isNaN(parsed)) {
        lastActivityRef.current = parsed;
      }
    }

    // Start timers
    updateLastActivity();
    startTimers();

    // Add activity event listeners
    TIMEOUT_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearAllTimers();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (channelRef.current) {
        try {
          channelRef.current.close();
        } catch {
          // Ignore close errors
        }
      }

      TIMEOUT_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, handleActivity, handleChannelMessage, startTimers, updateLastActivity, clearAllTimers]);

  return {
    isWarningVisible,
    remainingSeconds,
    extendSession,
    resetTimeout,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format seconds to MM:SS display string.
 *
 * @param seconds - Number of seconds (non-negative)
 * @returns Formatted string like "2:00" or "0:30"
 *
 * @example
 * formatTimeRemaining(120) // "2:00"
 * formatTimeRemaining(65)  // "1:05"
 * formatTimeRemaining(9)   // "0:09"
 * formatTimeRemaining(0)   // "0:00"
 */
export function formatTimeRemaining(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
