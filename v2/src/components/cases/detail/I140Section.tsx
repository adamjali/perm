"use client";

import * as React from "react";
import { Award, CheckCircle2 } from "lucide-react";
import { CaseDetailSection, DetailField } from "./CaseDetailSection";
import { Badge } from "@/components/ui/badge";
import { formatISODate } from "@/lib/utils/date";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface I140SectionProps {
  /**
   * I-140 data to display
   */
  data: {
    i140FilingDate?: string;
    i140ReceiptDate?: string;
    i140ReceiptNumber?: string;
    i140ApprovalDate?: string;
    i140DenialDate?: string;
    i140Category?: string;
    i140PremiumProcessing?: boolean;
    i140ServiceCenter?: string;
  };

  /**
   * ETA 9089 certification date (filing deadline = cert + 180 days)
   */
  eta9089CertificationDate?: string;

  /**
   * ETA 9089 expiration date (filing must be before this)
   */
  eta9089ExpirationDate?: string;

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
 * Calculate I-140 filing deadline status
 */
function getDeadlineStatus(
  filingDate: string | undefined,
  expirationDate: string | undefined
): {
  status: "filed" | "urgent" | "soon" | "normal" | "unknown";
  daysRemaining?: number;
} {
  // Already filed
  if (filingDate) {
    return { status: "filed" };
  }

  // No expiration date (deadline unknown)
  if (!expirationDate) {
    return { status: "unknown" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(expirationDate + "T00:00:00");
  const daysRemaining = differenceInDays(deadline, today);

  if (daysRemaining <= 0) {
    return { status: "urgent", daysRemaining: 0 };
  }
  if (daysRemaining <= 7) {
    return { status: "urgent", daysRemaining };
  }
  if (daysRemaining <= 30) {
    return { status: "soon", daysRemaining };
  }
  return { status: "normal", daysRemaining };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * I140Section Component
 *
 * Read-only display section for I-140 Immigrant Petition information.
 *
 * Features:
 * - Filing date, receipt date, approval date
 * - Receipt number
 * - Category (EB-1, EB-2, EB-3)
 * - Service center
 * - Premium processing indicator
 * - Filing deadline indicator (180 days from ETA 9089 certification)
 * - Completion badge when approved
 *
 * @example
 * ```tsx
 * <I140Section
 *   data={{
 *     i140FilingDate: "2024-07-01",
 *     i140ApprovalDate: "2024-08-15",
 *     i140Category: "EB-2",
 *     i140PremiumProcessing: true,
 *   }}
 *   eta9089ExpirationDate="2024-12-12"
 * />
 * ```
 */
export function I140Section({
  data,
  eta9089CertificationDate: _eta9089CertificationDate,
  eta9089ExpirationDate,
  defaultOpen = true,
}: I140SectionProps) {
  // Check if section has any data
  const hasData = !!(
    data.i140FilingDate ||
    data.i140ReceiptDate ||
    data.i140ReceiptNumber ||
    data.i140ApprovalDate ||
    data.i140DenialDate ||
    data.i140Category ||
    data.i140PremiumProcessing ||
    data.i140ServiceCenter
  );

  // Calculate deadline status
  const deadlineStatus = getDeadlineStatus(data.i140FilingDate, eta9089ExpirationDate);

  // Check if approved
  const isApproved = !!data.i140ApprovalDate;
  const isDenied = !!data.i140DenialDate;

  return (
    <CaseDetailSection
      title="I-140 Immigrant Petition"
      icon={<Award className="h-5 w-5" />}
      defaultOpen={defaultOpen}
    >
      {hasData || deadlineStatus.status !== "unknown" ? (
        <div className="space-y-4">
          {/* Completion/Denial Badge */}
          {isApproved && (
            <div className="flex items-center gap-2 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-heading font-semibold">Complete - I-140 Approved!</span>
            </div>
          )}
          {isDenied && !isApproved && (
            <div className="flex items-center gap-2 rounded-lg border-2 border-red-300 bg-red-50 p-3 text-red-800 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
              <span className="font-heading font-semibold">I-140 Denied</span>
            </div>
          )}

          {/* Filing Deadline Indicator (if not filed and deadline known) */}
          {!data.i140FilingDate && deadlineStatus.status !== "unknown" && eta9089ExpirationDate && (
            <div
              className={cn(
                "rounded-lg border-2 p-3 text-sm",
                deadlineStatus.status === "urgent"
                  ? "border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                  : deadlineStatus.status === "soon"
                    ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300"
                    : "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              )}
            >
              <p>
                <span className="font-semibold">I-140 Filing Deadline:</span>{" "}
                {formatDate(eta9089ExpirationDate)}
                {deadlineStatus.daysRemaining !== undefined && (
                  <span>
                    {" "}
                    ({deadlineStatus.daysRemaining} day{deadlineStatus.daysRemaining !== 1 ? "s" : ""} remaining)
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Main Data Grid */}
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField
              label="Filing Date"
              value={formatDate(data.i140FilingDate)}
            />
            <DetailField
              label="Receipt Date"
              value={formatDate(data.i140ReceiptDate)}
            />
            <DetailField
              label="Receipt Number"
              value={data.i140ReceiptNumber}
              mono
            />
            <DetailField
              label="Category"
              value={data.i140Category}
            />
            <DetailField
              label="Approval Date"
              value={formatDate(data.i140ApprovalDate)}
            />
            <DetailField
              label="Denial Date"
              value={formatDate(data.i140DenialDate)}
            />
            <DetailField
              label="Service Center"
              value={data.i140ServiceCenter}
            />
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Premium Processing</dt>
              <dd>
                {data.i140PremiumProcessing ? (
                  <Badge variant="default" className="bg-primary">
                    Premium
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No I-140 information entered yet.
        </p>
      )}
    </CaseDetailSection>
  );
}
