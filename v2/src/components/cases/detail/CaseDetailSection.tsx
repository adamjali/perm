"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface CaseDetailSectionProps {
  /**
   * Section title
   */
  title: string;

  /**
   * Icon to display next to title
   */
  icon?: React.ReactNode;

  /**
   * Whether section is initially expanded
   */
  defaultOpen?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Section content
   */
  children: React.ReactNode;
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
 * - Collapsible with smooth Framer Motion animation
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
}: CaseDetailSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-border bg-card shadow-hard-sm",
        "transition-all duration-150 hover:shadow-hard hover:-translate-y-0.5",
        className
      )}
    >
      {/* Header - clickable to toggle, 44px minimum touch target */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between p-3 sm:p-4 text-left",
          "hover:bg-muted/50 transition-colors rounded-t-lg",
          !isOpen && "rounded-b-lg",
          // Ensure minimum 44px touch target height
          "min-h-[48px]"
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
          <h3 className="font-heading font-semibold text-base sm:text-lg">{title}</h3>
        </div>
        <span className="text-muted-foreground transition-transform duration-200 shrink-0 ml-2">
          {isOpen ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </span>
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
  const displayValue = React.useMemo(() => {
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
