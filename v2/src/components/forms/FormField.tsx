"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ValidationState } from "@/hooks/useDateFieldValidation";

export interface FormFieldProps {
  /**
   * The label text displayed above the input
   */
  label: string;

  /**
   * Field name used for label association and error identification
   */
  name: string;

  /**
   * Whether the field is required (shows red asterisk)
   */
  required?: boolean;

  /**
   * Hint text displayed below the label
   */
  hint?: string;

  /**
   * Error message to display
   */
  error?: string;

  /**
   * Warning message to display (non-blocking)
   */
  warning?: string;

  /**
   * Whether this field value was auto-calculated
   */
  autoCalculated?: boolean;

  /**
   * Validation state for visual indicator
   */
  validationState?: ValidationState;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * The input element
   */
  children: React.ReactNode;
}

/**
 * FormField component - wrapper for form inputs with label, hint, error, and warning display.
 *
 * Features:
 * - Label with optional required indicator (red asterisk)
 * - Status icons next to label (error/warning/valid)
 * - Hint text below label (dynamic based on constraints)
 * - Error message with shake animation
 * - Warning message (non-blocking)
 * - Auto-calculated state indicator
 * - Neobrutalist styling
 * - Snappy animations (0.2-0.4s)
 */
export function FormField({
  label,
  name,
  required,
  hint,
  error,
  warning,
  autoCalculated,
  validationState,
  className,
  children,
}: FormFieldProps) {
  // Determine validation icon to show
  const showValidIcon = validationState === 'valid' && !autoCalculated;
  const showErrorIcon = validationState === 'error' || !!error;
  const showWarningIcon = (validationState === 'warning' || !!warning) && !showErrorIcon;

  // Build aria-describedby for the input
  const describedByIds: string[] = [];
  if (hint) describedByIds.push(`${name}-hint`);
  if (error) describedByIds.push(`${name}-error`);
  if (warning && !error) describedByIds.push(`${name}-warning`);
  const ariaDescribedBy = describedByIds.length > 0 ? describedByIds.join(" ") : undefined;

  // Clone children to add accessibility attributes
  const enhancedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement<React.HTMLAttributes<HTMLElement>>(child)) {
      return React.cloneElement(child, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": ariaDescribedBy,
        "aria-required": required,
      });
    }
    return child;
  });

  return (
    <div
      className={cn("flex flex-col space-y-1.5 min-w-0", className)}
      data-error={error ? "true" : undefined}
      data-warning={warning && !error ? "true" : undefined}
      data-valid={validationState === 'valid' ? "true" : undefined}
      data-auto-calculated={autoCalculated ? "true" : undefined}
    >
      {/* Label row with status indicator */}
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <Label htmlFor={name} data-slot="label" className="font-semibold break-words min-w-0">
          {label}
          {required && (
            <span className="text-destructive ml-1 font-bold" aria-hidden="true">
              *
            </span>
          )}
        </Label>

        {/* Status icons - only show one at a time */}
        {showErrorIcon && (
          <AlertCircle
            className="size-4 shrink-0 text-destructive animate-fade-in"
            aria-label="Field has error"
          />
        )}
        {showWarningIcon && (
          <AlertTriangle
            className="size-4 shrink-0 text-orange-500 animate-fade-in"
            aria-label="Field has warning"
          />
        )}
        {showValidIcon && (
          <CheckCircle2
            className="size-4 shrink-0 text-emerald-500 animate-fade-in"
            aria-label="Field is valid"
          />
        )}

        {/* Auto-calculated badge */}
        {autoCalculated && (
          <span
            className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            aria-label="Auto-calculated value"
          >
            Auto
          </span>
        )}
      </div>

      {/* Hint text */}
      {hint && (
        <p
          id={`${name}-hint`}
          data-slot="hint"
          className={cn(
            "text-sm transition-colors duration-200",
            showErrorIcon
              ? "text-destructive/80"
              : showWarningIcon
              ? "text-orange-600/80 dark:text-orange-400/80"
              : "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      )}

      {/* Input wrapper with animation */}
      <div
        className={cn(
          "transition-all duration-200 overflow-hidden",
          error && "animate-shake"
        )}
      >
        {enhancedChildren}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-1.5 animate-fade-in">
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
          <p
            id={`${name}-error`}
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {error}
          </p>
        </div>
      )}

      {/* Warning message */}
      {warning && !error && (
        <div className="flex items-start gap-1.5 animate-fade-in">
          <AlertTriangle className="size-4 text-orange-500 shrink-0 mt-0.5" />
          <p
            id={`${name}-warning`}
            className="text-sm font-medium text-orange-600 dark:text-orange-400"
          >
            {warning}
          </p>
        </div>
      )}
    </div>
  );
}
