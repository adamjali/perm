"use client";

import * as React from "react";
import { CheckCircle as CheckCircle2, WarningCircle as AlertCircle } from "@phosphor-icons/react";
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
   * Whether section is initially expanded (kept for backward compat, ignored)
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
 * FormSection component - static section wrapper for form organization.
 *
 * Features:
 * - Section title with optional icon
 * - Status indicator (complete/incomplete/has-errors)
 * - Neobrutalist styling
 *
 * Note: No longer collapsible, outer CollapsibleSection handles collapse.
 */
export function FormSection({
  title,
  icon,
  status,
  className,
  children,
}: FormSectionProps) {
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
        "border-2 border-border bg-card shadow-hard-sm",
        status === "has-errors" && "border-destructive",
        status === "complete" && "border-emerald-500/50",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 min-w-0 p-4 pb-0">
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        <h3 className="font-heading font-semibold text-lg break-words min-w-0">{title}</h3>
        {statusIcon && <span className="shrink-0">{statusIcon}</span>}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}
