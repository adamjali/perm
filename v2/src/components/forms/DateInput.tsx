"use client";

import * as React from "react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a string is a valid ISO date (YYYY-MM-DD)
 */
function isValidDateString(str: string): boolean {
  if (!str || str.length !== 10) return false;
  const date = new Date(str + "T00:00:00");
  return !isNaN(date.getTime());
}

/**
 * Get the next Sunday on or after a given date string (YYYY-MM-DD)
 * Returns undefined if no date provided
 */
function getNextSunday(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr + "T00:00:00");
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) return dateStr; // Already Sunday
  const daysUntilSunday = 7 - dayOfWeek;
  date.setDate(date.getDate() + daysUntilSunday);
  return date.toISOString().split("T")[0];
}

/**
 * Get a recent Sunday date (within 7 days of today).
 * Returns last Sunday if today is Sun-Wed, next Sunday if Thu-Sat.
 * Used as fallback for Sunday-only date picker when no minDate is provided.
 */
function getRecentSunday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

  if (dayOfWeek <= 3) {
    // Sunday through Wednesday - use last Sunday
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - dayOfWeek);
    return lastSunday.toISOString().split("T")[0]!;
  } else {
    // Thursday through Saturday - use next Sunday
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (7 - dayOfWeek));
    return nextSunday.toISOString().split("T")[0]!;
  }
}

// ============================================================================
// TYPES
// ============================================================================

import type { ValidationState } from "@/hooks/useDateFieldValidation";

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /**
   * Whether the field has an error
   */
  error?: boolean;

  /**
   * Whether this value was auto-calculated
   */
  autoCalculated?: boolean;

  /**
   * Validation state for visual feedback
   */
  validationState?: ValidationState;

  /**
   * Callback when clear button is clicked
   */
  onClear?: () => void;

  /**
   * Minimum allowed date (YYYY-MM-DD format)
   */
  minDate?: string;

  /**
   * Maximum allowed date (YYYY-MM-DD format)
   */
  maxDate?: string;

  /**
   * Restrict selection to Sundays only (for Sunday ad fields)
   * Uses step="7" with Sunday-aligned min date
   */
  sundayOnly?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * DateInput component - styled date picker with clear functionality.
 *
 * Features:
 * - Native date input with neobrutalist styling
 * - Internal state management to prevent clearing during typing
 * - Clear button when value present
 * - Error state with red border
 * - Auto-calculated state indicator
 * - Hard shadows on focus (neobrutalist)
 * - Min/max date support for date range restrictions
 * - Calendar icon indicator
 *
 * Typing behavior:
 * - Uses internal state to hold value during typing
 * - Only propagates to parent on blur or when valid date is entered
 * - Prevents the common issue of date fields clearing on partial input
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      className,
      error,
      autoCalculated,
      validationState,
      onClear,
      value,
      onChange,
      onBlur,
      disabled,
      minDate,
      maxDate,
      sundayOnly,
      ...props
    },
    ref
  ) => {
    // Internal state to handle typing without losing value
    const [internalValue, setInternalValue] = useState<string>(
      value != null ? String(value) : ""
    );
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync internal state when external value changes (e.g., auto-calculation from parent)
    useEffect(() => {
      const externalValue = value != null ? String(value) : "";
      setInternalValue(externalValue);
    }, [value]);

    // For Sunday-only mode, adjust min date to next Sunday and use step="7"
    const effectiveMinDate = useMemo(() => {
      if (sundayOnly) {
        return minDate ? getNextSunday(minDate) : getRecentSunday();
      }
      return minDate;
    }, [sundayOnly, minDate]);

    // Merge refs
    useEffect(() => {
      if (ref && inputRef.current) {
        if (typeof ref === "function") {
          ref(inputRef.current);
        } else {
          (ref as React.MutableRefObject<HTMLInputElement>).current = inputRef.current;
        }
      }
    }, [ref]);

    /**
     * Handle input change
     * - Always update internal state for responsive UI
     * - Only propagate to parent for valid dates or explicit clears
     */
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInternalValue(newValue);

        // Propagate immediately for:
        // 1. Valid complete dates (from date picker or complete typing)
        // 2. Empty string (user clearing the field)
        if (newValue === "" || isValidDateString(newValue)) {
          onChange?.(e);
        }
      },
      [onChange]
    );

    /**
     * Handle blur - propagate final value to parent
     * This ensures any remaining value is saved when user leaves the field
     */
    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        // If internal value differs from external and is valid, propagate
        const externalValue = value != null ? String(value) : "";
        if (internalValue !== externalValue) {
          // Create synthetic change event with current internal value
          if (isValidDateString(internalValue) || internalValue === "") {
            const syntheticEvent = {
              ...e,
              target: { ...e.target, value: internalValue },
              currentTarget: { ...e.currentTarget, value: internalValue },
            } as React.ChangeEvent<HTMLInputElement>;
            onChange?.(syntheticEvent);
          }
        }
        onBlur?.(e);
      },
      [internalValue, value, onChange, onBlur]
    );

    // Open native date picker on calendar icon click
    const handleCalendarClick = useCallback(() => {
      if (inputRef.current && !disabled) {
        inputRef.current.showPicker?.();
      }
    }, [disabled]);

    const hasValue = internalValue.length > 0;

    return (
      <div
        className={cn("relative w-full min-w-0 group", className)}
        data-auto-calculated={autoCalculated ? "true" : undefined}
      >
        <input
          ref={inputRef}
          type="date"
          value={internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          {...(effectiveMinDate ? { min: effectiveMinDate } : {})}
          {...(maxDate ? { max: maxDate } : {})}
          {...(sundayOnly ? { step: "7" } : {})}
          aria-invalid={error ? "true" : undefined}
          className={cn(
            // Base styles - neobrutalist
            "h-11 w-full min-w-0 border-2 bg-background px-3 py-1 text-base shadow-hard-sm transition-all duration-150 outline-none md:text-sm",
            // Hover state
            "hover:shadow-hard hover:-translate-y-[1px]",
            // Focus state
            "focus:shadow-hard focus:ring-2 focus:ring-ring focus-visible:border-ring focus:-translate-y-[1px]",
            // Disabled state
            "disabled:shadow-none disabled:hover:shadow-none disabled:hover:translate-y-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
            // Error state (highest priority)
            (error || validationState === 'error') && "border-destructive ring-2 ring-destructive/20 dark:ring-destructive/40",
            // Warning state
            !error && validationState === 'warning' && "border-orange-500 ring-2 ring-orange-500/20",
            // Valid state (show green when explicitly valid)
            !error && validationState === 'valid' && !autoCalculated && "border-emerald-500 ring-1 ring-emerald-500/20",
            // Normal state (no validation state)
            !error && !validationState && !autoCalculated && "border-input",
            // Auto-calculated state (overrides valid state styling)
            autoCalculated && "ring-2 ring-emerald-500/30 border-emerald-500",
            // Right padding for buttons
            hasValue && onClear ? "pr-16" : "pr-10",
            // Custom calendar icon styling
            "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          )}
          {...props}
        />

        {/* Calendar icon - acts as click target for picker */}
        <button
          type="button"
          onClick={handleCalendarClick}
          disabled={disabled}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 p-1 text-muted-foreground transition-colors",
            "hover:text-foreground",
            "disabled:opacity-50 disabled:pointer-events-none",
            hasValue && onClear ? "right-8" : "right-2"
          )}
          aria-label="Open date picker"
          tabIndex={-1}
        >
          <Calendar className="h-4 w-4" />
        </button>

        {/* Clear button */}
        {hasValue && onClear && !disabled && (
          <button
            type="button"
            onClick={onClear}
            data-testid="clear-button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Clear date"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

DateInput.displayName = "DateInput";
