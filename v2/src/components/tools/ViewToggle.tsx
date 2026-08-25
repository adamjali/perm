"use client";

/**
 * A segmented control for switching one section between two readings of the
 * same numbers.
 *
 * A chart answers "what shape is this" and a table answers "what is the
 * number". Both questions get asked about every figure on these pages, and
 * picking one for the reader loses the other. So the pair ships together and
 * this switches which one is on top.
 *
 * Buttons, not a select: there are two or three options and the current one
 * has to be visible without opening anything. `aria-pressed` rather than a
 * radiogroup, because these are toggles over content that is already present
 * rather than a form value being submitted.
 */

import { Fragment } from "react";

import { cn } from "@/lib/utils";

export interface ViewToggleOption<T extends string> {
  value: T;
  label: string;
}

export interface ViewToggleProps<T extends string> {
  /** Names what is being switched, for the group's accessible name. */
  label: string;
  value: T;
  options: readonly ViewToggleOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function ViewToggle<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: ViewToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex border-2 border-border shadow-hard-sm", className)}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          // The separator is why this is a Fragment. Two adjacent buttons
          // reach the DOM as "ChartTable" to anything walking it, which is
          // the defect Google has printed verbatim in a real listing. The
          // space is invisible: a whitespace-only text node between flex
          // items is not rendered as an item at all.
          <Fragment key={o.value}>
            {" "}
            <button
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-[44px] px-4 font-mono text-xs font-bold uppercase tracking-wider transition-colors focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary",
              i > 0 && "border-l-2 border-border",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground/70 hover:bg-tint-primary hover:text-foreground",
            )}
          >
            {o.label}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
