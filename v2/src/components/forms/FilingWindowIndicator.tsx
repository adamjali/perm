"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ToneBadge } from "@/components/ui/badge";
import { WarningIcon as AlertTriangle } from "@phosphor-icons/react";
import { format, parseISO, differenceInDays } from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

export type WindowStatus = "not_open" | "open" | "closing_soon" | "closed" | "recruitment_incomplete";

export interface FilingWindowData {
  /** When the window opens (ISO date string) */
  opensOn?: string;
  /** When the window closes (ISO date string) */
  closesOn?: string;
  /** Days until the window opens (if not yet open) */
  daysUntilOpen?: number;
  /** Days remaining until the window closes */
  daysRemaining?: number;
  /** Whether PWD expiration is the limiting factor for close date (only while the PWD still limits the case) */
  isPwdLimited?: boolean;
  /** Whether the window is currently open */
  isOpen: boolean;
  /** Whether recruitment is complete (required for ETA 9089 window) */
  isRecruitmentComplete?: boolean;
}

export interface FilingWindowIndicatorProps {
  /** Window data */
  window: FilingWindowData;
  /** Label for what this window is (e.g., "ETA 9089 Filing Window") */
  label: string;
  /** Additional className */
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** A window or deadline this close reads as urgent; this close, as a warning. */
export const CLOSING_SOON_DAYS = 14;
export const DEADLINE_WARNING_DAYS = 30;

function getWindowStatus(window: FilingWindowData): WindowStatus {
  // Check for incomplete recruitment first
  if (window.isRecruitmentComplete === false) {
    return "recruitment_incomplete";
  }

  if (!window.opensOn || !window.closesOn) {
    return "not_open";
  }

  if (window.daysUntilOpen && window.daysUntilOpen > 0) {
    return "not_open";
  }

  if (window.daysRemaining !== undefined && window.daysRemaining <= 0) {
    return "closed";
  }

  if (window.daysRemaining !== undefined && window.daysRemaining <= CLOSING_SOON_DAYS) {
    return "closing_soon";
  }

  if (window.isOpen) {
    return "open";
  }

  return "not_open";
}

function getProgressPercentage(window: FilingWindowData): number {
  if (!window.opensOn || !window.closesOn) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const openDate = parseISO(window.opensOn);
  const closeDate = parseISO(window.closesOn);

  const totalDays = differenceInDays(closeDate, openDate);
  const elapsedDays = differenceInDays(today, openDate);

  if (elapsedDays < 0) return 0;
  if (elapsedDays >= totalDays) return 100;

  return Math.round((elapsedDays / totalDays) * 100);
}

/** Each state's words and tone. The tone colours only the chip and the count. */
const STATUS: Record<WindowStatus, { label: string; tone: "good" | "warn" | "bad" | "flat"; ink: string }> = {
  recruitment_incomplete: { label: "Recruitment incomplete", tone: "flat", ink: "text-muted-foreground" },
  not_open: { label: "Not yet open", tone: "flat", ink: "text-foreground" },
  open: { label: "Open", tone: "good", ink: "text-primary-text" },
  closing_soon: { label: "Closing soon", tone: "warn", ink: "text-data-warn-ink" },
  closed: { label: "Closed", tone: "bad", ink: "text-destructive-text" },
};

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * FilingWindowIndicator Component
 *
 * Displays filing window status with:
 * - Visual progress bar showing position within window
 * - Window dates and days remaining
 * - A status chip in the state's tone
 * - PWD expiration warning when applicable
 */
export function FilingWindowIndicator({ window, label, className }: FilingWindowIndicatorProps) {
  const status = getWindowStatus(window);
  const config = STATUS[status];
  const progress = getProgressPercentage(window);

  // Before the window can be drawn, one line says what it waits on.
  if (status === "recruitment_incomplete" || (!window.opensOn && !window.closesOn)) {
    return (
      <p className={cn("bg-tint p-3 text-sm text-muted-foreground", className)}>
        {label}:{" "}
        {status === "recruitment_incomplete"
          ? "Complete all recruitment activities to see filing window"
          : "Complete prerequisites to see window"}
      </p>
    );
  }

  const showCount = (status === "open" || status === "closing_soon") && window.daysRemaining !== undefined && window.daysRemaining > 0;

  return (
    <div className={cn("space-y-3 bg-tint p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <ToneBadge tone={config.tone}>{config.label}</ToneBadge>
      </div>

      {(status === "open" || status === "closing_soon") && (
        <div>
          <div className="h-1.5 bg-muted" role="progressbar" aria-label={`${label}, share elapsed`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full", status === "closing_soon" ? "bg-data-warn" : "bg-primary-text")} style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 flex justify-between text-sm text-muted-foreground tabular-nums">
            <span>{progress}% elapsed</span>{" "}
            <span>{100 - progress}% remaining</span>
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Opens</dt>{" "}
          <dd className="font-medium">{window.opensOn ? formatDate(window.opensOn) : "-"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Closes</dt>{" "}
          <dd className="font-medium">{window.closesOn ? formatDate(window.closesOn) : "-"}</dd>
        </div>
      </dl>

      {status === "not_open" && window.daysUntilOpen !== undefined && window.daysUntilOpen > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-heading text-lg font-bold text-foreground tabular-nums">{window.daysUntilOpen}</span> days until open
        </p>
      )}

      {showCount && (
        <p className="text-sm text-muted-foreground">
          <span className={cn("font-heading text-lg font-bold tabular-nums", config.ink)}>{window.daysRemaining}</span> days remaining
        </p>
      )}

      {status === "closed" && <p className="text-sm font-semibold text-destructive-text">Window has closed</p>}

      {window.isPwdLimited && (
        <p className="flex items-start gap-2 text-sm text-data-warn-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This window closes at the PWD expiration, before the 180-day mark: recruitment began before the determination date, or none is entered (20 CFR 656.40(c)).
        </p>
      )}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================
