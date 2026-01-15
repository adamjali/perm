"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectInputProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  /**
   * Select options
   */
  options: SelectOption[];

  /**
   * Placeholder text when no value selected
   */
  placeholder?: string;

  /**
   * Whether the field has an error
   */
  error?: boolean;
}

/**
 * SelectInput component - styled dropdown with neobrutalist design.
 *
 * Features:
 * - Native select with consistent neobrutalist styling
 * - Hard shadows and black border
 * - Placeholder support
 * - Error state styling
 */
export const SelectInput = React.forwardRef<HTMLSelectElement, SelectInputProps>(
  ({ className, options, placeholder, error, ...props }, ref) => {
    return (
      <select
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        className={cn(
          // Base styles - neobrutalist
          "h-11 w-full border-2 bg-background px-3 py-1 text-base shadow-hard-sm transition-all duration-150 outline-none md:text-sm appearance-none cursor-pointer",
          // Custom arrow
          "bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat pr-10",
          // Hover state
          "hover:shadow-hard hover:-translate-y-[1px]",
          // Focus state
          "focus:shadow-hard focus:ring-2 focus:ring-ring focus-visible:border-ring focus:-translate-y-[1px]",
          // Disabled state
          "disabled:shadow-none disabled:hover:shadow-none disabled:hover:translate-y-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          // Error state
          error && "border-destructive ring-destructive/20 dark:ring-destructive/40",
          // Normal state
          !error && "border-input",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);

SelectInput.displayName = "SelectInput";
