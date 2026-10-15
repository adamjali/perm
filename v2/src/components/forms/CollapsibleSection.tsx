"use client";

import * as React from "react";
import { CaretDownIcon, CheckCircleIcon as CheckCircle2, WarningIcon as AlertTriangle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { SectionState, SectionName } from "@/hooks/useSectionState";

// ============================================================================
// TYPES
// ============================================================================

export interface CollapsibleSectionProps {
  /** Section identifier */
  name: SectionName;
  /** Display title for the section */
  title: string;
  /** Current state of the section */
  state: SectionState;
  /** Callback when section is toggled open/closed */
  onToggle: () => void;
  /** Optional description shown below title */
  description?: string;
  /** Section content */
  children: React.ReactNode;
  /** Additional className for the container */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * One section of the case form: a plain box whose heading opens and closes it.
 *
 * The heading's button is stretched over the whole header row, so the row is
 * one click target and the heading stays a heading. A section whose earlier
 * steps aren't done still opens, says so in one line, and is never faded.
 */
export function CollapsibleSection({
  name,
  title,
  state,
  onToggle,
  description,
  children,
  className,
}: CollapsibleSectionProps) {
  const { isOpen, isEnabled, disabledReason, statusInfo, isComplete, summary } = state;
  const contentId = `section-${name}-content`;
  const statusId = `section-${name}-status`;

  return (
    <section data-section={name} className={cn("bg-tint", className)}>
      <div className="relative flex items-center justify-between gap-4 p-4 hover:bg-card has-[:focus-visible]:bg-card">
        <div className="min-w-0">
          <h2 className={cn("font-heading text-lg font-bold break-words", !isEnabled && "text-muted-foreground")}>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-controls={contentId}
              aria-describedby={statusInfo || (isComplete && summary) ? statusId : undefined}
              className="text-left after:absolute after:inset-0 focus-visible:outline-none"
            >
              {title}
            </button>
          </h2>
          {description && <p className="mt-0.5 break-words text-sm text-muted-foreground">{description}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-3 text-sm">
          <span id={statusId} className="hidden items-center gap-2 sm:flex">
            {statusInfo && (
              <span className={isEnabled ? "text-muted-foreground" : "text-data-warn-ink"}>{statusInfo}</span>
            )}
            {isComplete && !isOpen && summary && (
              <span className="max-w-[300px] truncate text-muted-foreground">{summary}</span>
            )}
          </span>
          {isComplete && <CheckCircle2 className="size-5 text-primary-text" aria-label="Complete" role="img" />}
          <CaretDownIcon className={cn("size-5 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
        </div>
      </div>

      {isOpen && (
        <div id={contentId} className="space-y-4 border-t border-border p-4">
          {!isEnabled && (
            <p className="flex items-center gap-2 text-sm text-data-warn-ink">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              {disabledReason || "Complete earlier sections first for accurate validation."}
            </p>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================
