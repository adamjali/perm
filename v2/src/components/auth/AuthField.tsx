"use client";

/**
 * AuthField, label + input + inline state feedback for auth forms.
 *
 * Wraps the existing neo-brutalist `Input` / `PasswordInput` with:
 *   - Mono uppercase label (matches signup/login/reset pattern)
 *   - Success indicator (green check icon, appears when state === "valid")
 *   - Error indicator (red alert icon + destructive-colored message)
 *   - Helper text (neutral, shown while pristine/valid and no error)
 *
 * Visual language stays consistent with the existing case form aesthetic:
 * 2px borders, hard shadows, mono labels, snappy transitions.
 *
 * Consumer owns validation, this component only renders the state.
 */

import { CheckCircle as CheckCircle2, WarningCircle as AlertCircle } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FieldState } from "@/lib/auth/signup-validation";

interface AuthFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  state: FieldState;
  /** Shown when state === "invalid". */
  error?: string;
  /** Shown when state is pristine or valid (and no error). */
  helperText?: string;
  /** Optional override — green helper when this condition is met. */
  helperMet?: boolean;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  component?: "input" | "password";
  inputMode?: "email" | "text";
}

export function AuthField({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  value,
  onChange,
  onBlur,
  state,
  error,
  helperText,
  helperMet,
  disabled,
  required,
  maxLength,
  placeholder,
  component = "input",
  inputMode,
}: AuthFieldProps) {
  const InputComponent = component === "password" ? PasswordInput : Input;
  const showError = state === "invalid" && !!error;
  const showValid = state === "valid";

  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-xs uppercase mono font-bold tracking-widest"
      >
        {label}
      </Label>

      <div className="relative">
        <InputComponent
          id={id}
          name={name ?? id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          inputMode={inputMode}
          aria-invalid={state === "invalid"}
          aria-describedby={showError ? `${id}-error` : helperText ? `${id}-help` : undefined}
          data-valid={showValid ? "true" : undefined}
          // Push right-padding to clear the status icon. PasswordInput already
          // reserves pr-11 for its eye toggle — stack the icon to its left.
          className={cn(
            showValid && component !== "password" && "pr-9",
            showError && component !== "password" && "pr-9",
            showValid && component === "password" && "pr-20",
            showError && component === "password" && "pr-20",
          )}
        />

        {showValid && (
          <CheckCircle2
            className={cn(
              "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 pointer-events-none",
              "transition-opacity duration-150",
              component === "password" ? "right-12" : "right-3",
            )}
            aria-hidden="true"
          />
        )}
        {showError && (
          <AlertCircle
            className={cn(
              "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-destructive pointer-events-none",
              "transition-opacity duration-150",
              component === "password" ? "right-12" : "right-3",
            )}
            aria-hidden="true"
          />
        )}
      </div>

      {showError ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs mono font-semibold text-destructive flex items-start gap-1.5"
        >
          <AlertCircle className="h-3 w-3 shrink-0 mt-[1px]" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p
          id={`${id}-help`}
          className={cn(
            "text-xs mono transition-colors duration-150 flex items-start gap-1.5",
            helperMet
              ? "text-emerald-600 font-semibold"
              : "text-muted-foreground",
          )}
        >
          {helperMet && (
            <CheckCircle2
              className="h-3 w-3 shrink-0 mt-[1px]"
              aria-hidden="true"
            />
          )}
          <span>{helperText}</span>
        </p>
      ) : null}
    </div>
  );
}
