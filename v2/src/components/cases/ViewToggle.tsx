"use client";

/**
 * ViewToggle
 *
 * Two buttons that switch the case list between cards and rows. The chosen
 * one takes the tint; each says its name to a screen reader and on hover.
 *
 * @module components/cases/ViewToggle
 */

import { ListIcon, SquaresFourIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

export type ViewMode = "card" | "list";

export interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
  className?: string;
}

const VIEWS = [
  { id: "card", label: "Card view", Icon: SquaresFourIcon },
  { id: "list", label: "List view", Icon: ListIcon },
] as const;

export function ViewToggle({ view, onChange, className }: ViewToggleProps) {
  return (
    <div role="radiogroup" aria-label="View mode" className={cn("inline-flex border border-input", className)}>
      {VIEWS.map(({ id, label, Icon }) => {
        const on = view === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => {
              if (!on) onChange(id);
            }}
            className={cn(
              "flex size-11 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              on ? "bg-tint text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
