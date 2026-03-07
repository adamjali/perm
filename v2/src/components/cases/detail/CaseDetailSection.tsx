"use client";

import { useState, useMemo, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface CaseDetailSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
  /** Summary text shown in collapsed header (e.g. "Expires Jun 30, 2025") */
  preview?: string;
  /** CSS color for accent top strip (e.g. "var(--stage-pwd)") */
  accentColor?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * CaseDetailSection Component
 *
 * Read-only collapsible section wrapper for case detail page.
 * Uses neobrutalist styling with hard shadows.
 *
 * Features:
 * - Collapsible with smooth Motion animation
 * - Section title with optional icon
 * - Neobrutalist card styling (border-2, shadow-hard-sm)
 * - Hover effects for interactivity
 *
 * @example
 * ```tsx
 * <CaseDetailSection title="PWD Information" icon={<FileText />}>
 *   <div className="grid gap-4 md:grid-cols-2">
 *     <DetailField label="Filing Date" value="Jan 15, 2024" />
 *   </div>
 * </CaseDetailSection>
 * ```
 */
export function CaseDetailSection({
  title,
  icon,
  defaultOpen = true,
  className,
  children,
  preview,
  accentColor,
}: CaseDetailSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "border-2 border-border bg-card shadow-hard-sm overflow-hidden",
        "transition-all duration-150 hover:shadow-hard hover:-translate-y-0.5",
        className
      )}
    >
      {/* Stage accent strip */}
      {accentColor && (
        <div className="h-[3px]" style={{ backgroundColor: accentColor }} />
      )}

      {/* Header - clickable to toggle, 44px minimum touch target */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between p-3 sm:p-4 text-left",
          "hover:bg-muted/50 transition-colors",
          "min-h-[48px]"
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
          <h3 className="font-heading font-semibold text-base sm:text-lg truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Preview text when collapsed */}
          {!isOpen && preview && (
            <span className="text-xs text-muted-foreground font-mono hidden sm:block max-w-[200px] truncate">
              {preview}
            </span>
          )}
          <span className="text-muted-foreground transition-transform duration-200">
            {isOpen ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </span>
        </div>
      </button>

      {/* Content - animated collapse with spring physics */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              type: "spring",
              visualDuration: 0.15,
              bounce: 0.1,
            }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MILESTONE TRACK
// ============================================================================

export interface MilestoneStep {
  /** Step label (e.g. "Filed", "Determined") */
  label: string;
  /** Formatted value to display, or undefined if step not completed */
  value?: string;
}

interface MilestoneTrackProps {
  steps: MilestoneStep[];
  /** CSS color for completed steps (e.g. "var(--stage-pwd)") */
  color: string;
}

/**
 * Horizontal milestone track showing sequential steps with completion status.
 * Squares instead of circles (neobrutalist). Colored connecting lines between completed steps.
 */
export function MilestoneTrack({ steps, color }: MilestoneTrackProps) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
    >
      {steps.map((step, i) => {
        const done = step.value !== undefined;
        const prevDone = i > 0 && steps[i - 1]?.value !== undefined;
        return (
          <div key={step.label} className="text-center">
            {/* Track row: line + dot + line */}
            <div className="flex items-center justify-center h-[14px]">
              {/* Left line */}
              {i > 0 ? (
                <div
                  className="h-px flex-1"
                  style={{
                    backgroundColor: prevDone ? color : "var(--border)",
                  }}
                />
              ) : (
                <div className="flex-1" />
              )}
              {/* Dot */}
              <div
                className={cn(
                  "w-3 h-3 border-2 shrink-0",
                  !done && "bg-card border-muted-foreground/30"
                )}
                style={
                  done
                    ? { backgroundColor: color, borderColor: color }
                    : undefined
                }
              />
              {/* Right line */}
              {i < steps.length - 1 ? (
                <div
                  className="h-px flex-1"
                  style={{
                    backgroundColor: done ? color : "var(--border)",
                  }}
                />
              ) : (
                <div className="flex-1" />
              )}
            </div>
            {/* Label */}
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5 font-medium block leading-tight">
              {step.label}
            </span>
            {/* Value */}
            {done ? (
              <span className="text-xs font-medium mt-0.5 block leading-tight">
                {step.value}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/40 mt-0.5 block">
                —
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// VALUE HIGHLIGHT
// ============================================================================

interface ValueHighlightProps {
  label: string;
  value: string;
  mono?: boolean;
}

/**
 * Compact highlighted value display with label.
 * Used for case numbers, wages, and other important single values.
 */
export function ValueHighlight({ label, value, mono }: ValueHighlightProps) {
  return (
    <div className="border-2 border-border bg-muted/40 px-3 py-2 min-w-0">
      <div
        className={cn(
          "text-sm font-medium leading-tight truncate",
          mono && "font-mono"
        )}
        title={typeof value === "string" || typeof value === "number" ? String(value) : undefined}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 leading-tight">
        {label}
      </div>
    </div>
  );
}

// ============================================================================
// DETAIL FIELD HELPER
// ============================================================================

export interface DetailFieldProps {
  /**
   * Field label
   */
  label: string;

  /**
   * Field value (or undefined/null for empty)
   */
  value: string | number | boolean | undefined | null;

  /**
   * Optional className for custom styling
   */
  className?: string;

  /**
   * Whether to use monospace font (for codes, numbers)
   */
  mono?: boolean;
}

/**
 * DetailField Component
 *
 * Simple label + value display for read-only case details.
 *
 * @example
 * ```tsx
 * <DetailField label="Case Number" value="PWD-2024-001" mono />
 * <DetailField label="Employer" value={case.employerName} />
 * ```
 */
export function DetailField({
  label,
  value,
  className,
  mono = false,
}: DetailFieldProps) {
  // Format value for display
  const displayValue = useMemo(() => {
    if (value === undefined || value === null || value === "") {
      return "-";
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    return String(value);
  }, [value]);

  const isEmpty = displayValue === "-";

  return (
    <div className={cn("space-y-1", className)}>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm",
          mono && "font-mono",
          isEmpty && "text-muted-foreground"
        )}
      >
        {displayValue}
      </dd>
    </div>
  );
}
