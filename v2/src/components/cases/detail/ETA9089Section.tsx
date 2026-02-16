"use client";

import { useMemo } from "react";
import { FileCheck } from "lucide-react";
import { CaseDetailSection, MilestoneTrack, ValueHighlight } from "./CaseDetailSection";
import { formatISODate } from "@/lib/utils/date";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface ETA9089SectionProps {
  data: {
    eta9089FilingDate?: string;
    eta9089AuditDate?: string;
    eta9089CertificationDate?: string;
    eta9089ExpirationDate?: string;
    eta9089CaseNumber?: string;
  };
  filingWindowOpensDate?: string;
  filingWindowClosesDate?: string;
  defaultOpen?: boolean;
  accentColor?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format date for display, returning "-" if empty
 */
function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return "-";
  return formatISODate(isoDate);
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format ISO date as short label (e.g. "Jan 25")
 */
function formatShortDate(isoDate: string): string {
  // isoDate is always YYYY-MM-DD
  const month = SHORT_MONTHS[parseInt(isoDate.substring(5, 7), 10) - 1] ?? "???";
  const day = parseInt(isoDate.substring(8, 10), 10);
  return `${month} ${day}`;
}

/**
 * Calculate progress percentage through a date window (0-100)
 */
function getWindowProgress(opensDate: string, closesDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const opens = new Date(opensDate + "T00:00:00");
  const closes = new Date(closesDate + "T00:00:00");
  const total = closes.getTime() - opens.getTime();
  if (total <= 0) return 100;
  const elapsed = today.getTime() - opens.getTime();
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

/**
 * Calculate filing window status
 */
function getFilingWindowStatus(
  filingDate: string | undefined,
  opensDate: string | undefined,
  closesDate: string | undefined
): {
  status: "filed" | "open" | "not-open" | "closed" | "unknown";
  daysRemaining?: number;
  daysUntilOpen?: number;
} {
  // Already filed
  if (filingDate) {
    return { status: "filed" };
  }

  // No window dates available
  if (!opensDate || !closesDate) {
    return { status: "unknown" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const opens = new Date(opensDate + "T00:00:00");
  const closes = new Date(closesDate + "T00:00:00");

  const daysUntilOpen = differenceInDays(opens, today);
  const daysRemaining = differenceInDays(closes, today);

  // Window not yet open
  if (daysUntilOpen > 0) {
    return { status: "not-open", daysUntilOpen };
  }

  // Window has closed
  if (daysRemaining < 0) {
    return { status: "closed" };
  }

  // Window is open
  return { status: "open", daysRemaining };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ETA9089Section Component
 *
 * Read-only display section for ETA 9089 (Labor Certification) information.
 *
 * Features:
 * - Filing date, audit date, certification date, expiration date
 * - Case number
 * - Filing window status indicator (if not yet filed)
 *
 * @example
 * ```tsx
 * <ETA9089Section
 *   data={{
 *     eta9089FilingDate: "2024-04-01",
 *     eta9089CertificationDate: "2024-06-15",
 *     eta9089ExpirationDate: "2024-12-12",
 *     eta9089CaseNumber: "A-12345-67890",
 *   }}
 *   filingWindowOpensDate="2024-03-15"
 *   filingWindowClosesDate="2024-08-01"
 * />
 * ```
 */
export function ETA9089Section({
  data,
  filingWindowOpensDate,
  filingWindowClosesDate,
  defaultOpen = true,
  accentColor,
}: ETA9089SectionProps) {
  const hasData = !!(
    data.eta9089FilingDate ||
    data.eta9089AuditDate ||
    data.eta9089CertificationDate ||
    data.eta9089ExpirationDate ||
    data.eta9089CaseNumber
  );

  const windowStatus = getFilingWindowStatus(
    data.eta9089FilingDate,
    filingWindowOpensDate,
    filingWindowClosesDate
  );

  // Preview summary for collapsed state
  const preview = useMemo(() => {
    if (data.eta9089CertificationDate) return `Certified ${formatDate(data.eta9089CertificationDate)}`;
    if (data.eta9089FilingDate) return `Filed ${formatDate(data.eta9089FilingDate)}`;
    if (windowStatus.status === "open") return "Window Open";
    return undefined;
  }, [data.eta9089CertificationDate, data.eta9089FilingDate, windowStatus.status]);

  return (
    <CaseDetailSection
      title="ETA 9089 (Labor Certification)"
      icon={<FileCheck className="h-5 w-5" />}
      defaultOpen={defaultOpen}
      preview={preview}
      accentColor={accentColor}
    >
      {hasData || windowStatus.status !== "unknown" ? (
        <div className="space-y-4">
          {/* Filing Window Indicator (if not filed) */}
          {!data.eta9089FilingDate && windowStatus.status !== "unknown" && (
            <div
              className={cn(
                "border-2 p-3 text-sm",
                windowStatus.status === "open" && windowStatus.daysRemaining !== undefined && windowStatus.daysRemaining <= 30
                  ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300"
                  : windowStatus.status === "open"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : windowStatus.status === "not-open"
                      ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                      : "border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
              )}
            >
              {windowStatus.status === "open" && (
                <p>
                  <span className="font-semibold">Filing window is open.</span>
                  {windowStatus.daysRemaining !== undefined && (
                    <span>
                      {" "}
                      {windowStatus.daysRemaining} day{windowStatus.daysRemaining !== 1 ? "s" : ""} remaining.
                    </span>
                  )}
                </p>
              )}
              {windowStatus.status === "not-open" && (
                <p>
                  <span className="font-semibold">Filing window not yet open.</span>
                  {windowStatus.daysUntilOpen !== undefined && (
                    <span>
                      {" "}
                      Opens in {windowStatus.daysUntilOpen} day{windowStatus.daysUntilOpen !== 1 ? "s" : ""}.
                    </span>
                  )}
                </p>
              )}
              {windowStatus.status === "closed" && (
                <p className="font-semibold">Filing window has closed.</p>
              )}
            </div>
          )}

          {/* Milestone Timeline: Filing → Audit → Certification → Expiration */}
          <MilestoneTrack
            color="var(--stage-eta9089)"
            steps={[
              { label: "Filed", value: data.eta9089FilingDate ? formatISODate(data.eta9089FilingDate) : undefined },
              { label: "Audit", value: data.eta9089AuditDate ? formatISODate(data.eta9089AuditDate) : undefined },
              { label: "Certified", value: data.eta9089CertificationDate ? formatISODate(data.eta9089CertificationDate) : undefined },
              { label: "Expires", value: data.eta9089ExpirationDate ? formatISODate(data.eta9089ExpirationDate) : undefined },
            ]}
          />

          {/* Case Number */}
          {data.eta9089CaseNumber && (
            <div className="flex flex-wrap gap-3">
              <ValueHighlight label="Case Number" value={data.eta9089CaseNumber} mono />
            </div>
          )}

          {/* Filing Window with Progress Bar */}
          {(filingWindowOpensDate || filingWindowClosesDate) && (
            <div className="pt-3 border-t border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Filing Window
                </span>
                {windowStatus.status === "filed" ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border-2 border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    Filed
                  </span>
                ) : windowStatus.status === "closed" ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border-2 border-red-500 bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                    Closed
                  </span>
                ) : windowStatus.status === "open" ? (
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Open{windowStatus.daysRemaining !== undefined ? ` (${windowStatus.daysRemaining}d)` : ""}
                  </span>
                ) : windowStatus.status === "not-open" ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border-2 border-border bg-muted text-muted-foreground">
                    Not Yet
                  </span>
                ) : null}
              </div>
              {/* Progress bar with date labels */}
              {filingWindowOpensDate && filingWindowClosesDate && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    {formatShortDate(filingWindowOpensDate)}
                  </span>
                  <div className="flex-1 h-1 bg-border/50 relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 bottom-0 transition-[width] duration-1000"
                      style={{
                        width: `${getWindowProgress(filingWindowOpensDate, filingWindowClosesDate)}%`,
                        backgroundColor: windowStatus.status === "closed" ? "var(--destructive)" : "var(--stage-eta9089)",
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    {formatShortDate(filingWindowClosesDate)}
                  </span>
                </div>
              )}
              {/* Fallback: only one date available */}
              {!(filingWindowOpensDate && filingWindowClosesDate) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {filingWindowOpensDate && <span>{formatISODate(filingWindowOpensDate)}</span>}
                  {filingWindowClosesDate && <span>{formatISODate(filingWindowClosesDate)}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No ETA 9089 information entered yet.
        </p>
      )}
    </CaseDetailSection>
  );
}
