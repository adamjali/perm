"use client";

import * as React from "react";
import { CaretDown, CheckCircle as CheckCircle2, Warning as AlertTriangle } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
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
  /** Optional icon to display next to title */
  icon?: React.ReactNode;
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
 * CollapsibleSection Component
 *
 * A collapsible form section with dependency indicators.
 *
 * Features:
 * - Always openable (even when prerequisites aren’t met)
 * - Animated expand/collapse
 * - Completion checkmark + summary when collapsed
 * - Soft prerequisite note when opened without prerequisites
 * - Neobrutalist design (hard shadows, snappy animations)
 */
export function CollapsibleSection({
  name,
  title,
  state,
  onToggle,
  icon,
  description,
  children,
  className,
}: CollapsibleSectionProps) {
  const { isOpen, isEnabled, disabledReason, statusInfo, isComplete, summary } = state;

  return (
    <div
      data-section={name}
      className={cn(
        "rounded-lg border-2 border-border bg-background",
        !isEnabled && "opacity-70",
        isEnabled && "shadow-hard",
        className
      )}
    >
      {/* Header — always clickable */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className={cn(
          "flex w-full items-center justify-between p-4",
          "text-left transition-colors duration-150 rounded-t-lg",
          "hover:bg-muted/50 cursor-pointer",
        )}
        aria-expanded={isOpen}
        aria-controls={`section-${name}-content`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon */}
          {icon && (
            <span className={cn(
              "shrink-0",
              isEnabled ? "text-foreground" : "text-muted-foreground"
            )}>
              {icon}
            </span>
          )}

          {/* Title and description */}
          <div className="min-w-0">
            <h3 className={cn(
              "font-heading font-semibold text-lg break-words",
              !isEnabled && "text-muted-foreground"
            )}>
              {title}
            </h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 break-words">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right side: Status indicators, completion, and chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status info — amber warning for waiting period, subtle for enabled sections */}
          {statusInfo && (
            <span className={cn(
              "text-xs font-medium px-2 py-1 rounded hidden sm:inline",
              !isEnabled
                ? "bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700"
                : "text-muted-foreground bg-muted"
            )}>
              {statusInfo}
            </span>
          )}

          {/* Completion indicator */}
          {isComplete && (
            <div className="flex items-center gap-1.5 text-[var(--primary)]">
              <CheckCircle2 className="h-4 w-4" />
              {!isOpen && summary && (
                <span className="text-xs text-muted-foreground max-w-[300px] truncate hidden sm:inline">
                  {summary}
                </span>
              )}
            </div>
          )}

          {/* Chevron */}
          <span className="text-muted-foreground transition-transform duration-200">
            <CaretDown className={cn(
              "h-5 w-5",
              isOpen && "rotate-180"
            )} />
          </span>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`section-${name}-content`}
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1, overflow: "visible" }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{
              type: "spring",
              visualDuration: 0.15,
              bounce: 0.1,
              overflow: { delay: 0.15 },
            }}
          >
            {/* Prerequisite warning when opened without prerequisites */}
            {!isEnabled && (
              <div className="mx-4 mb-3 flex items-center gap-2 text-sm px-3 py-2.5 rounded-md border-2 border-amber-500/50 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-500/30">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="font-medium">{disabledReason || "Complete earlier sections first for accurate validation."}</span>
              </div>
            )}
            <div className="px-4 pb-4 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CollapsibleSection;
