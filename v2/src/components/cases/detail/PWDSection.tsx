"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { CaseDetailSection, DetailField } from "./CaseDetailSection";
import { formatISODate } from "@/lib/utils/date";

// ============================================================================
// TYPES
// ============================================================================

export interface PWDSectionProps {
  /**
   * PWD data to display
   */
  data: {
    pwdFilingDate?: string;
    pwdDeterminationDate?: string;
    pwdExpirationDate?: string;
    pwdCaseNumber?: string;
    pwdWageAmount?: number; // Stored as cents
    pwdWageLevel?: string;
  };

  /**
   * Whether section is initially expanded
   */
  defaultOpen?: boolean;
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
}: PWDSectionProps) {
  // Check if section has any data
  const hasData = !!(
    data.pwdFilingDate ||
    data.pwdDeterminationDate ||
    data.pwdExpirationDate ||
    data.pwdCaseNumber ||
    data.pwdWageAmount ||
    data.pwdWageLevel
  );

  return (
    <CaseDetailSection
      title="PWD (Prevailing Wage Determination)"
      icon={<FileText className="h-5 w-5" />}
      defaultOpen={defaultOpen}
    >
      {hasData ? (
        <dl className="grid gap-4 md:grid-cols-3">
          {/* Date Fields */}
          <DetailField
            label="Filing Date"
            value={formatDate(data.pwdFilingDate)}
          />
          <DetailField
            label="Determination Date"
            value={formatDate(data.pwdDeterminationDate)}
          />
          <DetailField
            label="Expiration Date"
            value={formatDate(data.pwdExpirationDate)}
          />

          {/* Case Number */}
          <DetailField
            label="Case Number"
            value={data.pwdCaseNumber}
            mono
          />

          {/* Wage Info */}
          <DetailField
            label="Wage Amount"
            value={formatWageAmount(data.pwdWageAmount)}
            mono
          />
          <DetailField
            label="Wage Level"
            value={data.pwdWageLevel}
          />
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No PWD information entered yet.
        </p>
      )}
    </CaseDetailSection>
  );
}
