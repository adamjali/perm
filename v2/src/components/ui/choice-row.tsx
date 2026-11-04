"use client";

import { Fragment, useId, type ReactNode } from "react";

import { choiceVariants } from "@/components/ui/choice";
import { cn } from "@/lib/utils";

export interface ChoiceRowOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Said to a screen reader in place of the label, where the label is short or a symbol. */
  ariaLabel?: string;
  disabled?: boolean;
}

/**
 * Two to four choices as one row of buttons, each a tap. A select with this
 * few options hides them behind a second tap and a scroll wheel on a phone;
 * a row shows them all, and the chosen one is lime (`choiceVariants`) and
 * says so with `aria-pressed`.
 *
 * The row is a labelled group, so a screen reader hears the question before
 * the choices. With a `name`, a hidden input carries the value, so a form that
 * reads its fields at submit (or a plain GET form with scripts running) still
 * gets it under the name the select had.
 */
export function ChoiceRow<T extends string>({
  label,
  labelClassName = "block text-sm font-semibold",
  hideLabel = false,
  options,
  value,
  onChange,
  name,
  disabled,
  className,
  rowClassName,
}: {
  label: ReactNode;
  labelClassName?: string;
  /** The question still names the group for a screen reader, but isn't drawn. */
  hideLabel?: boolean;
  options: readonly ChoiceRowOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
  rowClassName?: string;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className={className}>
      <span id={labelId} className={hideLabel ? "sr-only" : labelClassName}>
        {label}
      </span>{" "}
      <div className={cn("flex flex-wrap gap-2", !hideLabel && "mt-1.5", rowClassName)}>
        {options.map((o) => (
          <Fragment key={o.value}>
            <button
              type="button"
              aria-pressed={o.value === value}
              aria-label={o.ariaLabel}
              disabled={disabled || o.disabled}
              onClick={() => {
                if (o.value !== value) onChange(o.value);
              }}
              className={choiceVariants({ on: o.value === value })}
            >
              {o.label}
            </button>{" "}
          </Fragment>
        ))}
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
