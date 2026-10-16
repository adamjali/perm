/**
 * ActionModeToggle Component
 *
 * What the assistant may do to your cases, chosen on a strip under the chat's
 * title bar (round 2, Oct 15 2026: three icons in the title bar read as
 * nothing; the owner asked for the modes with good colour, like an app's
 * permission modes):
 * - Read only (`off`, ink): it answers questions and changes nothing
 * - Ask first (`confirm`, lime, the default): it shows each change and waits
 *   for an OK
 * - Auto (`auto`, amber): it changes cases right away; a deletion still asks
 *
 * Each option has its icon and its words; the chosen one fills with its
 * colour, and a line under the strip says what that mode means, edged in the
 * same colour. The words carry the meaning, so nothing rests on colour alone.
 * A radiogroup: Left and Right (or Up and Down) move the choice.
 *
 * @module components/chat/ActionModeToggle
 */

"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";
import { EyeSlashIcon, LightningIcon, ShieldCheckIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import type { ActionMode } from "@/lib/ai/tool-permissions";

// Re-export for consumers
export type { ActionMode };

export interface ActionModeToggleProps {
  /** Current action mode */
  mode: ActionMode;
  /** Callback when mode changes */
  onChange: (mode: ActionMode) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_CONFIG: Record<
  ActionMode,
  { icon: typeof EyeSlashIcon; label: string; fill: string; edge: string }
> = {
  off: {
    icon: EyeSlashIcon,
    label: "Read only",
    fill: "bg-[#141414] text-white dark:bg-white dark:text-black",
    edge: "border-l-[#141414] dark:border-l-white",
  },
  confirm: {
    icon: ShieldCheckIcon,
    label: "Ask first",
    fill: "bg-primary text-black",
    edge: "border-l-primary",
  },
  auto: {
    icon: LightningIcon,
    label: "Auto",
    fill: "bg-data-warn text-black",
    edge: "border-l-data-warn",
  },
};

const MODES: ActionMode[] = ["off", "confirm", "auto"];

/** What each mode means, in one line under the strip. */
export const ACTION_MODE_NOTICE: Record<ActionMode, string> = {
  off: "Read only: it answers questions and changes nothing.",
  confirm: "Ask first: it shows each change and waits for your OK.",
  auto: "Auto: it changes cases right away. A deletion still asks.",
};

// ============================================================================
// Component
// ============================================================================

export function ActionModeToggle({ mode, onChange, disabled = false, className }: ActionModeToggleProps) {
  const refs = useRef<Map<ActionMode, HTMLButtonElement>>(new Map());

  const choose = useCallback(
    (next: ActionMode) => {
      if (!disabled && next !== mode) onChange(next);
    },
    [disabled, mode, onChange],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const step =
        e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!step || disabled) return;
      e.preventDefault();
      const next = MODES[(MODES.indexOf(mode) + step + MODES.length) % MODES.length]!;
      choose(next);
      refs.current.get(next)?.focus();
    },
    [choose, disabled, mode],
  );

  return (
    <div className={cn("border-b-2 border-border bg-muted px-3 py-2.5", className)}>
      <div
        role="radiogroup"
        aria-label="What the assistant may do"
        onKeyDown={onKeyDown}
        className={cn("grid grid-cols-3 border-2 border-black bg-background shadow-hard-sm dark:border-[var(--object-border)]", disabled && "opacity-60")}
      >
        {MODES.map((m) => {
          const { icon: Icon, label, fill } = MODE_CONFIG[m];
          const on = mode === m;
          return (
            <button
              key={m}
              ref={(el) => {
                if (el) refs.current.set(m, el);
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              disabled={disabled}
              onClick={() => choose(m)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 border-r-2 border-black px-1 text-sm last:border-r-0 md:min-h-9 dark:border-[var(--object-border)]",
                "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                "disabled:cursor-not-allowed",
                on ? cn(fill, "font-bold") : "font-semibold text-soft hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon weight={on ? "bold" : "regular"} className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>{" "}
      <p
        aria-live="polite"
        className={cn("mt-2 border-l-4 pl-2 text-sm leading-snug text-foreground", MODE_CONFIG[mode].edge)}
      >
        {ACTION_MODE_NOTICE[mode]}
      </p>
    </div>
  );
}
