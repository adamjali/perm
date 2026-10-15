"use client";

import * as React from "react";
import { CheckCircleIcon as CheckCircle2, WarningCircleIcon as AlertCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type SectionStatus = "complete" | "incomplete" | "has-errors" | undefined;

export interface FormSectionProps {
  /**
   * Section title
   */
  title: string;

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
 * A form section that is always open: the same plain box and heading as the
 * collapsible ones, so the first section and the rest look alike.
 */
export function FormSection({ title, status, className, children }: FormSectionProps) {
  return (
    <section
      className={cn(
        "border border-border bg-card",
        status === "has-errors" && "border-destructive",
        className
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <h2 className="min-w-0 break-words font-heading text-lg font-bold">{title}</h2>
        {status === "complete" && <CheckCircle2 className="size-5 shrink-0 text-primary-text" aria-label="Complete" role="img" />}
        {status === "has-errors" && <AlertCircle className="size-5 shrink-0 text-destructive" aria-label="Has errors" role="img" />}
      </div>
      <div className="space-y-4 border-t border-border p-4">{children}</div>
    </section>
  );
}
