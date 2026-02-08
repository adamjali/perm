"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { CaseDetailSection, MilestoneTrack, ValueHighlight } from "./CaseDetailSection";
import { formatISODate } from "@/lib/utils/date";

// ============================================================================
// TYPES
// ============================================================================

export interface PWDSectionProps {
  data: {
    pwdFilingDate?: string;
    pwdDeterminationDate?: string;
    pwdExpirationDate?: string;
    pwdCaseNumber?: string;
    pwdWageAmount?: number;
    pwdWageLevel?: string;
  };
  defaultOpen?: boolean;
  /** CSS color for accent strip (e.g. "var(--stage-pwd)") */
  accentColor?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format wage amount from cents to display string
 */
function formatWageAmount(cents: number | undefined): string {
  if (cents === undefined || cents === null) {
    return "-";
  }
  // Convert cents to dollars and format with commas
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format date for display, returning "-" if empty
 */
function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return "-";
  return formatISODate(isoDate);
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PWDSection Component
 *
 * Read-only display section for PWD (Prevailing Wage Determination) information.
 *
 * Features:
 * - Filing date, determination date, expiration date
 * - PWD case number
 * - Wage amount (formatted as currency)
 * - Wage level (I-IV)
 * - All dates formatted with formatISODate
 *
 * @example
 * ```tsx
 * <PWDSection
 *   data={{
 *     pwdFilingDate: "2024-01-15",
 *     pwdDeterminationDate: "2024-03-01",
 *     pwdExpirationDate: "2025-06-30",
 *     pwdCaseNumber: "PWD-2024-001",
 *     pwdWageAmount: 8500000, // $85,000.00 in cents
 *     pwdWageLevel: "Level II",
 *   }}
 * />
 * ```
 */
export function PWDSection({
  data,
  defaultOpen = true,
  accentColor,
}: PWDSectionProps) {
  const hasData = !!(
    data.pwdFilingDate ||
    data.pwdDeterminationDate ||
    data.pwdExpirationDate ||
    data.pwdCaseNumber ||
    data.pwdWageAmount ||
    data.pwdWageLevel
  );

  // Preview summary for collapsed state
  const preview = React.useMemo(() => {
    if (data.pwdExpirationDate) return `Exp ${formatDate(data.pwdExpirationDate)}`;
    if (data.pwdDeterminationDate) return `Det ${formatDate(data.pwdDeterminationDate)}`;
    if (data.pwdFilingDate) return `Filed ${formatDate(data.pwdFilingDate)}`;
    return undefined;
  }, [data.pwdExpirationDate, data.pwdDeterminationDate, data.pwdFilingDate]);

  return (
    <CaseDetailSection
      title="PWD (Prevailing Wage Determination)"
      icon={<FileText className="h-5 w-5" />}
      defaultOpen={defaultOpen}
      preview={preview}
      accentColor={accentColor}
    >
      {hasData ? (
        <div className="space-y-4">
          {/* Milestone Timeline: Filing → Determination → Expiration */}
          {(data.pwdFilingDate || data.pwdDeterminationDate || data.pwdExpirationDate) && (
            <MilestoneTrack
              color="var(--stage-pwd)"
              steps={[
                { label: "Filed", value: data.pwdFilingDate ? formatISODate(data.pwdFilingDate) : undefined },
                { label: "Determined", value: data.pwdDeterminationDate ? formatISODate(data.pwdDeterminationDate) : undefined },
                { label: "Expires", value: data.pwdExpirationDate ? formatISODate(data.pwdExpirationDate) : undefined },
              ]}
            />
          )}

          {/* Wage Amount + Wage Level — 2-col grid */}
          {(data.pwdWageAmount !== undefined || data.pwdWageLevel) && (
            <div className="grid grid-cols-2 gap-2">
              {data.pwdWageAmount !== undefined && (
                <ValueHighlight label="Prevailing Wage" value={formatWageAmount(data.pwdWageAmount)} mono />
              )}
              {data.pwdWageLevel && (
                <ValueHighlight label="Wage Level" value={data.pwdWageLevel} />
              )}
            </div>
          )}

          {/* Case Number — separate row */}
          {data.pwdCaseNumber && (
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">PWD Case Number</dt>
              <dd className="text-sm font-mono">{data.pwdCaseNumber}</dd>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No PWD information entered yet.
        </p>
      )}
    </CaseDetailSection>
  );
}
