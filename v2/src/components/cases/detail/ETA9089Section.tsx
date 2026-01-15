"use client";

import * as React from "react";
import { FileCheck } from "lucide-react";
import { CaseDetailSection, DetailField } from "./CaseDetailSection";
import { formatISODate } from "@/lib/utils/date";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface ETA9089SectionProps {
  /**
   * ETA 9089 data to display
   */
  data: {
    eta9089FilingDate?: string;
    eta9089AuditDate?: string;
    eta9089CertificationDate?: string;
    eta9089ExpirationDate?: string;
    eta9089CaseNumber?: string;
  };

  /**
   * Date when filing window opens (30 days after last recruitment step)
   */
  filingWindowOpensDate?: string;

  /**
   * Date when filing window closes (180 days from first recruitment or PWD expiration)
   */
  filingWindowClosesDate?: string;

  /**
   * Whether section is initially expanded
   */
  defaultOpen?: boolean;
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
}: ETA9089SectionProps) {
  // Check if section has any data
  const hasData = !!(
    data.eta9089FilingDate ||
    data.eta9089AuditDate ||
    data.eta9089CertificationDate ||
    data.eta9089ExpirationDate ||
    data.eta9089CaseNumber
  );

  // Calculate filing window status
  const windowStatus = getFilingWindowStatus(
    data.eta9089FilingDate,
    filingWindowOpensDate,
    filingWindowClosesDate
  );

  return (
    <CaseDetailSection
      title="ETA 9089 (Labor Certification)"
      icon={<FileCheck className="h-5 w-5" />}
      defaultOpen={defaultOpen}
    >
      {hasData || windowStatus.status !== "unknown" ? (
        <div className="space-y-4">
          {/* Filing Window Indicator (if not filed) */}
          {!data.eta9089FilingDate && windowStatus.status !== "unknown" && (
            <div
              className={cn(
                "rounded-lg border-2 p-3 text-sm",
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

          {/* Main Data Grid */}
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField
              label="Filing Date"
              value={formatDate(data.eta9089FilingDate)}
            />
            <DetailField
              label="Case Number"
              value={data.eta9089CaseNumber}
              mono
            />
            <DetailField
              label="Audit Date"
              value={formatDate(data.eta9089AuditDate)}
            />
            <div /> {/* Spacer for grid alignment */}
            <DetailField
              label="Certification Date"
              value={formatDate(data.eta9089CertificationDate)}
            />
            <DetailField
              label="Expiration Date"
              value={formatDate(data.eta9089ExpirationDate)}
            />
          </dl>

          {/* Window Dates (always show if available) */}
          {(filingWindowOpensDate || filingWindowClosesDate) && (
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Filing Window</h4>
                {/* Status badge */}
                {windowStatus.status === "filed" ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    Filed
                  </span>
                ) : windowStatus.status === "closed" ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                    Closed
                  </span>
                ) : windowStatus.status === "open" ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    Open
                  </span>
                ) : windowStatus.status === "not-open" ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    Not Yet Open
                  </span>
                ) : null}
              </div>
              <dl className="grid gap-4 md:grid-cols-2">
                <DetailField
                  label="Window Opens"
                  value={formatDate(filingWindowOpensDate)}
                />
                <DetailField
                  label="Window Closes"
                  value={formatDate(filingWindowClosesDate)}
                />
              </dl>
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
