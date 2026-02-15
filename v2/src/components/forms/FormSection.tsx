"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export type SectionStatus = "complete" | "incomplete" | "has-errors" | undefined;

export interface FormSectionProps {
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
   * Section completion status
   */
  status?: SectionStatus;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Section content
   */
  children: React.ReactNode;
}

/**
 * FormSection component - collapsible section wrapper for form organization.
 *
 * Features:
 * - Collapsible with smooth animation (Framer Motion)
 * - Status indicator (complete/incomplete/has-errors)
 * - Section title with optional icon
 * - Neobrutalist styling
 */
export function FormSection({
  title,
  icon,
  defaultOpen = true,
  status,
  className,
  children,
}: FormSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const statusIcon = React.useMemo(() => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "has-errors":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  }, [status]);

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-border bg-card shadow-hard-sm",
        "transition-all duration-150 hover:shadow-hard hover:-translate-y-0.5",
        status === "has-errors" && "border-destructive",
        status === "complete" && "border-emerald-500/50",
        className
      )}
    >
      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between p-4 text-left",
          "hover:bg-muted/50 transition-colors rounded-t-lg",
          !isOpen && "rounded-b-lg"
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
          <h3 className="font-heading font-semibold text-lg break-words min-w-0">{title}</h3>
          {statusIcon && <span className="shrink-0">{statusIcon}</span>}
        </div>
        <span className="shrink-0 text-muted-foreground transition-transform duration-200">
          {isOpen ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </span>
      </button>

      {/* Content - animated collapse */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1, overflow: "visible" }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{ duration: 0.2, ease: "easeInOut", overflow: { delay: 0.2 } }}
          >
            <div className="p-4 pt-0 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
