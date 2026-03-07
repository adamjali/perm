"use client";

import { useMemo } from "react";
import { parseISO, format } from "date-fns";
import { cn } from "@/lib/utils";
import type { CaseWithDates } from "@/lib/timeline";
import {
  isRecruitmentComplete,
  getFirstRecruitmentDate,
  FILING_WINDOW_CLOSE_DAYS,
  getFilingWindowStatusFromCase,
  daysBetween,
  getTodayISO,
} from "@/lib/perm";

// ============================================================================
// TYPES
// ============================================================================

export interface WindowsDisplayProps {
  caseData: CaseWithDates;
  className?: string;
}

type RecruitmentWindowStatus = "ACTIVE" | "COMPLETED" | "EXPIRED" | "NOT_STARTED";

type FilingWindowStatus =
  | "OPEN"
  | "OPENING_SOON"
  | "CLOSING_SOON"
  | "CLOSED"
  | "FILED"
  | "NOT_AVAILABLE";

// ============================================================================
// STATUS STYLING
// ============================================================================

interface StatusStyle {
  accent: string;
  chipBg: string;
  chipText: string;
  label: string;
}

const RECRUITMENT_STYLES: Record<RecruitmentWindowStatus, StatusStyle> = {
  COMPLETED: {
    accent: "var(--stage-recruitment)",
    chipBg: "bg-purple-100 dark:bg-purple-900",
    chipText: "text-purple-700 dark:text-purple-300",
    label: "Complete",
  },
  ACTIVE: {
    accent: "var(--stage-recruitment)",
    chipBg: "bg-emerald-100 dark:bg-emerald-900",
    chipText: "text-emerald-700 dark:text-emerald-300",
    label: "Active",
  },
  EXPIRED: {
    accent: "var(--destructive)",
    chipBg: "bg-red-100 dark:bg-red-900",
    chipText: "text-red-700 dark:text-red-300",
    label: "Expired",
  },
  NOT_STARTED: {
    accent: "var(--border)",
    chipBg: "bg-muted",
    chipText: "text-muted-foreground",
    label: "Not Started",
  },
};

const FILING_STYLES: Record<FilingWindowStatus, StatusStyle> = {
  OPEN: {
    accent: "var(--stage-eta9089)",
    chipBg: "bg-emerald-100 dark:bg-emerald-900",
    chipText: "text-emerald-700 dark:text-emerald-300",
    label: "Open",
  },
  OPENING_SOON: {
    accent: "var(--stage-eta9089)",
    chipBg: "bg-amber-100 dark:bg-amber-900",
    chipText: "text-amber-700 dark:text-amber-300",
    label: "Opening Soon",
  },
  CLOSING_SOON: {
    accent: "var(--stage-eta9089)",
    chipBg: "bg-orange-100 dark:bg-orange-900",
    chipText: "text-orange-700 dark:text-orange-300",
    label: "Closing Soon",
  },
  CLOSED: {
    accent: "var(--destructive)",
    chipBg: "bg-red-100 dark:bg-red-900",
    chipText: "text-red-700 dark:text-red-300",
    label: "Closed",
  },
  FILED: {
    accent: "var(--stage-eta9089)",
    chipBg: "bg-blue-100 dark:bg-blue-900",
    chipText: "text-blue-700 dark:text-blue-300",
    label: "Filed",
  },
  NOT_AVAILABLE: {
    accent: "var(--border)",
    chipBg: "bg-muted",
    chipText: "text-muted-foreground",
    label: "Not Available",
  },
};

// ============================================================================
// UI HELPERS
// ============================================================================

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatShortDate(isoDate: string): string {
  const month = SHORT_MONTHS[parseInt(isoDate.substring(5, 7), 10) - 1] || "???";
  const day = parseInt(isoDate.substring(8, 10), 10);
  return `${month} ${day}`;
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

function getWindowProgress(startDate: string, endDate: string): number {
  const today = getTodayISO();
  const total = daysBetween(startDate, endDate);
  if (total <= 0) return 100;
  const elapsed = daysBetween(startDate, today);
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

// ============================================================================
// WINDOW CARD COMPONENT
// ============================================================================

interface WindowCardProps {
  title: string;
  style: StatusStyle;
  heroNumber: number | null;
  heroUnit: string;
  heroLabel: string;
  startDate: string | null;
  endDate: string | null;
  showProgress: boolean;
  isTerminal: boolean;
}

function WindowCard({
  title,
  style,
  heroNumber,
  heroUnit,
  heroLabel,
  startDate,
  endDate,
  showProgress,
  isTerminal,
}: WindowCardProps) {
  const progress = startDate && endDate ? getWindowProgress(startDate, endDate) : 0;

  return (
    <div
      className={cn(
        "border-2 border-border bg-card overflow-hidden",
        "shadow-hard-sm transition-all duration-150",
        "hover:shadow-hard hover:-translate-y-0.5"
      )}
    >
      {/* Accent strip at top */}
      <div className="h-[3px]" style={{ backgroundColor: style.accent }} />

      <div className="p-4">
        {/* Row 1: Title + Status chip */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {title}
          </span>
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border-2 border-border",
              style.chipBg,
              style.chipText
            )}
          >
            {style.label}
          </span>
        </div>

        {/* Row 2: Hero metric */}
        <div className="mb-3">
          {heroNumber !== null ? (
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-3xl font-heading font-bold tabular-nums leading-none"
                style={{ color: style.accent }}
              >
                {heroNumber}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {heroUnit}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-lg font-heading font-bold leading-none"
                style={{ color: style.accent }}
              >
                {heroLabel}
              </span>
            </div>
          )}
          {heroNumber !== null && (
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              {heroLabel}
            </span>
          )}
        </div>

        {/* Row 3: Progress bar with date labels */}
        {showProgress && startDate && endDate ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground shrink-0">
              {formatShortDate(startDate)}
            </span>
            <div className="flex-1 h-1.5 bg-border/50 relative overflow-hidden">
              <div
                className="absolute left-0 top-0 bottom-0 transition-[width] duration-1000"
                style={{
                  width: `${isTerminal ? 100 : progress}%`,
                  backgroundColor: style.accent,
                  opacity: isTerminal ? 0.5 : 1,
                }}
              />
            </div>
            <span className="text-[11px] font-mono text-muted-foreground shrink-0">
              {formatShortDate(endDate)}
            </span>
          </div>
        ) : startDate || endDate ? (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
            {startDate && <span>{formatDate(startDate)}</span>}
            {startDate && endDate && <span className="text-border">&rarr;</span>}
            {endDate && <span>{formatDate(endDate)}</span>}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WindowsDisplay({ caseData, className }: WindowsDisplayProps) {
  // Central lib uses string | undefined; CaseWithDates uses string | null | undefined.
  // Both are treated identically (falsy checks), so strip null once here.
  const cd = useMemo(() => ({
    sundayAdFirstDate: caseData.sundayAdFirstDate ?? undefined,
    sundayAdSecondDate: caseData.sundayAdSecondDate ?? undefined,
    jobOrderStartDate: caseData.jobOrderStartDate ?? undefined,
    jobOrderEndDate: caseData.jobOrderEndDate ?? undefined,
    noticeOfFilingStartDate: caseData.noticeOfFilingStartDate ?? undefined,
    noticeOfFilingEndDate: caseData.noticeOfFilingEndDate ?? undefined,
    pwdExpirationDate: caseData.pwdExpirationDate ?? undefined,
    additionalRecruitmentEndDate: caseData.additionalRecruitmentEndDate ?? undefined,
    additionalRecruitmentMethods: caseData.additionalRecruitmentMethods ?? undefined,
    isProfessionalOccupation: caseData.isProfessionalOccupation ?? undefined,
    eta9089FilingDate: caseData.eta9089FilingDate ?? undefined,
  }), [caseData]);

  // ---- Recruitment Window (180-day overall window) ----
  const recruitmentDisplay = useMemo(() => {
    const firstDate = getFirstRecruitmentDate(cd);

    if (!firstDate) {
      return { status: "NOT_STARTED" as const, startDate: null, endDate: null, daysRemaining: null, daysElapsed: null };
    }

    // 180-day overall window: MIN(first + 180, PWD expiration)
    const naturalCloseDate = new Date(firstDate + "T00:00:00Z");
    naturalCloseDate.setUTCDate(naturalCloseDate.getUTCDate() + FILING_WINDOW_CLOSE_DAYS);
    const naturalClose = naturalCloseDate.toISOString().split("T")[0] || firstDate;
    const closes = cd.pwdExpirationDate && cd.pwdExpirationDate < naturalClose
      ? cd.pwdExpirationDate
      : naturalClose;
    const today = getTodayISO();

    if (isRecruitmentComplete(cd)) {
      return { status: "COMPLETED" as const, startDate: firstDate, endDate: closes, daysRemaining: null, daysElapsed: null };
    }

    if (today > closes) {
      return { status: "EXPIRED" as const, startDate: firstDate, endDate: closes, daysRemaining: null, daysElapsed: daysBetween(closes, today) };
    }

    return { status: "ACTIVE" as const, startDate: firstDate, endDate: closes, daysRemaining: daysBetween(today, closes), daysElapsed: null };
  }, [cd]);

  // ---- Filing Window (gated on recruitment completeness) ----
  const filingDisplay = useMemo(() => {
    const isFiled = !!cd.eta9089FilingDate;
    const centralStatus = getFilingWindowStatusFromCase(cd);
    const window = centralStatus.window;
    const today = getTodayISO();

    if (isFiled) {
      const opens = window ? window.opens : null;
      const closes = window ? window.closes : null;
      return { status: "FILED" as const, opensDate: opens, closesDate: closes, daysUntilOpen: null, daysRemaining: null, daysElapsed: null };
    }

    // Gate: recruitment must be complete before showing filing window
    if (!isRecruitmentComplete(cd) || !window) {
      return { status: "NOT_AVAILABLE" as const, opensDate: null, closesDate: null, daysUntilOpen: null, daysRemaining: null, daysElapsed: null };
    }

    switch (centralStatus.status) {
      case "waiting": {
        const daysUntilOpen = centralStatus.daysUntilOpen || daysBetween(today, window.opens);
        if (daysUntilOpen <= 7) {
          return { status: "OPENING_SOON" as const, opensDate: window.opens, closesDate: window.closes, daysUntilOpen, daysRemaining: null, daysElapsed: null };
        }
        return { status: "NOT_AVAILABLE" as const, opensDate: window.opens, closesDate: window.closes, daysUntilOpen, daysRemaining: null, daysElapsed: null };
      }
      case "open": {
        const daysRemaining = centralStatus.daysRemaining || daysBetween(today, window.closes);
        if (daysRemaining <= 14) {
          return { status: "CLOSING_SOON" as const, opensDate: window.opens, closesDate: window.closes, daysUntilOpen: null, daysRemaining, daysElapsed: null };
        }
        return { status: "OPEN" as const, opensDate: window.opens, closesDate: window.closes, daysUntilOpen: null, daysRemaining, daysElapsed: null };
      }
      case "closed": {
        return { status: "CLOSED" as const, opensDate: window.opens, closesDate: window.closes, daysUntilOpen: null, daysRemaining: null, daysElapsed: daysBetween(window.closes, today) };
      }
    }
  }, [cd]);

  // ---- Recruitment Card Props ----
  const rStyle = RECRUITMENT_STYLES[recruitmentDisplay.status];
  const rTerminal = recruitmentDisplay.status === "COMPLETED" || recruitmentDisplay.status === "EXPIRED";

  let rHeroNumber: number | null = null;
  let rHeroUnit = "";
  let rHeroLabel = "";

  switch (recruitmentDisplay.status) {
    case "ACTIVE":
      rHeroNumber = recruitmentDisplay.daysRemaining;
      rHeroUnit = rHeroNumber === 1 ? "day" : "days";
      rHeroLabel = "remaining in window";
      break;
    case "EXPIRED":
      rHeroNumber = recruitmentDisplay.daysElapsed;
      rHeroUnit = rHeroNumber === 1 ? "day" : "days";
      rHeroLabel = "past expiration";
      break;
    case "COMPLETED":
      rHeroLabel = "All steps finished";
      break;
    case "NOT_STARTED":
      rHeroLabel = "No activities yet";
      break;
  }

  // ---- Filing Card Props ----
  const fStyle = FILING_STYLES[filingDisplay.status];
  const fTerminal = filingDisplay.status === "FILED" || filingDisplay.status === "CLOSED";

  let fHeroNumber: number | null = null;
  let fHeroUnit = "";
  let fHeroLabel = "";

  switch (filingDisplay.status) {
    case "OPEN":
      fHeroNumber = filingDisplay.daysRemaining;
      fHeroUnit = fHeroNumber === 1 ? "day" : "days";
      fHeroLabel = "remaining to file";
      break;
    case "OPENING_SOON":
      fHeroNumber = filingDisplay.daysUntilOpen;
      fHeroUnit = fHeroNumber === 1 ? "day" : "days";
      fHeroLabel = "until window opens";
      break;
    case "CLOSING_SOON":
      fHeroNumber = filingDisplay.daysRemaining;
      fHeroUnit = fHeroNumber === 1 ? "day" : "days";
      fHeroLabel = "left to file";
      break;
    case "CLOSED":
      fHeroNumber = filingDisplay.daysElapsed;
      fHeroUnit = fHeroNumber === 1 ? "day" : "days";
      fHeroLabel = "since window closed";
      break;
    case "FILED":
      fHeroLabel = "ETA 9089 filed";
      break;
    case "NOT_AVAILABLE":
      if (filingDisplay.daysUntilOpen !== null) {
        fHeroNumber = filingDisplay.daysUntilOpen;
        fHeroUnit = fHeroNumber === 1 ? "day" : "days";
        fHeroLabel = "until window opens";
      } else {
        fHeroLabel = "Awaiting recruitment";
      }
      break;
  }

  return (
    <div
      className={cn(
        "grid gap-4 grid-cols-1 sm:grid-cols-2",
        className
      )}
    >
      <WindowCard
        title="Recruitment Window"
        style={rStyle}
        heroNumber={rHeroNumber}
        heroUnit={rHeroUnit}
        heroLabel={rHeroLabel}
        startDate={recruitmentDisplay.startDate}
        endDate={recruitmentDisplay.endDate}
        showProgress={!!recruitmentDisplay.startDate && !!recruitmentDisplay.endDate}
        isTerminal={rTerminal}
      />

      <WindowCard
        title="ETA 9089 Filing"
        style={fStyle}
        heroNumber={fHeroNumber}
        heroUnit={fHeroUnit}
        heroLabel={fHeroLabel}
        startDate={filingDisplay.opensDate}
        endDate={filingDisplay.closesDate}
        showProgress={!!filingDisplay.opensDate && !!filingDisplay.closesDate}
        isTerminal={fTerminal}
      />
    </div>
  );
}
