"use client";

import { useMemo } from "react";
import { Award, CheckCircle2, XCircle, Clock, Zap, Building2, Tag } from "lucide-react";
import { CaseDetailSection, MilestoneTrack, ValueHighlight } from "./CaseDetailSection";
import { Badge } from "@/components/ui/badge";
import { formatISODate } from "@/lib/utils/date";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  getI140ProcessingTime,
  getI140CompletionDateRange,
  formatProcessingTimeRange,
  formatCompletionDateRange,
  type I140Category,
  type ServiceCenter,
} from "@/lib/processing-times/i140ProcessingTimes";

// ============================================================================
// TYPES
// ============================================================================

export interface I140SectionProps {
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
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;
  defaultOpen?: boolean;
  accentColor?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

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
  if (filingDate) {
    return { status: "filed" };
  }

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

/**
 * Map category display label
 */
function getCategoryLabel(category: string): string {
  switch (category) {
    case "EB-1":
      return "EB-1 (Priority Workers)";
    case "EB-2":
      return "EB-2 (Advanced Degree)";
    case "EB-2-NIW":
      return "EB-2 National Interest Waiver";
    case "EB-3":
      return "EB-3 (Skilled Workers)";
    default:
      return category;
  }
}

/**
 * Calculate days elapsed since filing
 */
function getDaysElapsed(filingDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const filed = new Date(filingDate + "T00:00:00");
  return differenceInDays(today, filed);
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Processing time estimate bar with progress indicator
 */
function ProcessingTimeEstimate({
  category,
  serviceCenter,
  isPremium,
  filingDate,
  isApproved,
  isDenied,
}: {
  category: string;
  serviceCenter: string;
  isPremium: boolean;
  filingDate?: string;
  isApproved: boolean;
  isDenied: boolean;
}) {
  const processingTime = getI140ProcessingTime(
    category as I140Category,
    serviceCenter as ServiceCenter,
    isPremium
  );

  if (!processingTime) return null;

  // If already decided, show completed state
  if (isApproved || isDenied) {
    return (
      <div className="border-2 border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground uppercase tracking-wider">
            Processing Time
          </span>
          <span className="font-mono text-muted-foreground">
            {filingDate
              ? `${getDaysElapsed(filingDate)} days`
              : formatProcessingTimeRange(processingTime)}
          </span>
        </div>
        <div className="h-2 border border-border bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full",
              isApproved ? "bg-emerald-500" : "bg-red-500"
            )}
            style={{ width: "100%" }}
          />
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {isApproved ? "Approved" : "Denied"}
        </div>
      </div>
    );
  }

  // If filed, show progress bar with estimate
  if (filingDate) {
    const completionRange = getI140CompletionDateRange(
      category as I140Category,
      serviceCenter as ServiceCenter,
      filingDate,
      isPremium
    );

    const daysElapsed = getDaysElapsed(filingDate);
    const medianDays = Math.round(processingTime.medianMonths * 30);
    const maxDays = Math.round(processingTime.maxMonths * 30);
    const progressPct = Math.min((daysElapsed / maxDays) * 100, 100);

    // Determine if overdue
    const isOverdue = daysElapsed > maxDays;
    const isPastMedian = daysElapsed > medianDays;

    return (
      <div className="border-2 border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground uppercase tracking-wider">
            Est. Processing Time
          </span>
          <span className="font-mono font-medium">
            {formatProcessingTimeRange(processingTime)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="h-2.5 border border-border bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                isOverdue
                  ? "bg-red-500"
                  : isPastMedian
                    ? "bg-orange-500"
                    : "bg-emerald-500"
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Median marker */}
          {!isPremium && (
            <div
              className="absolute top-0 w-px h-2.5 bg-muted-foreground/50"
              style={{ left: `${(medianDays / maxDays) * 100}%` }}
            />
          )}
        </div>

        {/* Labels */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Day {daysElapsed}
            {isOverdue && (
              <span className="text-red-500 font-medium ml-1">
                (past typical)
              </span>
            )}
          </span>
          {completionRange && (
            <span className="font-mono">
              Est. {formatCompletionDateRange(completionRange)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Not filed yet — show estimate only
  return (
    <div className="border-2 border-dashed border-border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>
          Typical processing:{" "}
          <span className="font-mono font-medium text-foreground">
            {formatProcessingTimeRange(processingTime)}
          </span>
          {isPremium && (
            <span className="ml-1 text-primary font-medium">(Premium)</span>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * Status banner for approved/denied/pending states
 */
function StatusBanner({
  isApproved,
  isDenied,
  approvalDate,
  denialDate,
  filingDate,
}: {
  isApproved: boolean;
  isDenied: boolean;
  approvalDate?: string;
  denialDate?: string;
  filingDate?: string;
}) {
  if (isApproved) {
    const daysToApprove =
      filingDate && approvalDate
        ? differenceInDays(
            new Date(approvalDate + "T00:00:00"),
            new Date(filingDate + "T00:00:00")
          )
        : null;

    return (
      <div className="flex items-center gap-3 border-2 border-emerald-400 bg-emerald-50 p-3 dark:bg-emerald-950/40 dark:border-emerald-600">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-heading font-bold text-emerald-800 dark:text-emerald-300">
            I-140 Approved
          </span>
          {daysToApprove !== null && (
            <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400 font-mono">
              ({daysToApprove} days)
            </span>
          )}
        </div>
      </div>
    );
  }

  if (isDenied) {
    return (
      <div className="flex items-center gap-3 border-2 border-red-400 bg-red-50 p-3 dark:bg-red-950/40 dark:border-red-600">
        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-heading font-bold text-red-800 dark:text-red-300">
            I-140 Denied
          </span>
          {denialDate && (
            <span className="ml-2 text-xs text-red-600 dark:text-red-400">
              {formatISODate(denialDate)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function I140Section({
  data,
  eta9089CertificationDate: _eta9089CertificationDate,
  eta9089ExpirationDate,
  defaultOpen = true,
  accentColor,
}: I140SectionProps) {
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

  const deadlineStatus = getDeadlineStatus(data.i140FilingDate, eta9089ExpirationDate);
  const isApproved = !!data.i140ApprovalDate;
  const isDenied = !!data.i140DenialDate && !isApproved;

  // Preview summary for collapsed state
  const preview = useMemo(() => {
    if (isApproved) return "Approved";
    if (isDenied) return "Denied";
    if (data.i140FilingDate) return `Filed ${formatISODate(data.i140FilingDate)}`;
    if (deadlineStatus.daysRemaining !== undefined) return `${deadlineStatus.daysRemaining}d to file`;
    return undefined;
  }, [isApproved, isDenied, data.i140FilingDate, deadlineStatus.daysRemaining]);

  return (
    <CaseDetailSection
      title="I-140 Immigrant Petition"
      icon={<Award className="h-5 w-5" />}
      defaultOpen={defaultOpen}
      preview={preview}
      accentColor={accentColor}
    >
      {hasData || deadlineStatus.status !== "unknown" ? (
        <div className="space-y-4">
          {/* Status Banner (Approved/Denied) */}
          <StatusBanner
            isApproved={isApproved}
            isDenied={isDenied}
            approvalDate={data.i140ApprovalDate}
            denialDate={data.i140DenialDate}
            filingDate={data.i140FilingDate}
          />

          {/* Filing Deadline Indicator (if not filed and deadline known) */}
          {!data.i140FilingDate && deadlineStatus.status !== "unknown" && eta9089ExpirationDate && (
            <div
              className={cn(
                "border-2 p-3 text-sm",
                deadlineStatus.status === "urgent"
                  ? "border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                  : deadlineStatus.status === "soon"
                    ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300"
                    : "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              )}
            >
              <p>
                <span className="font-semibold">I-140 Filing Deadline:</span>{" "}
                {formatISODate(eta9089ExpirationDate)}
                {deadlineStatus.daysRemaining !== undefined && (
                  <span>
                    {" "}
                    ({deadlineStatus.daysRemaining} day{deadlineStatus.daysRemaining !== 1 ? "s" : ""} remaining)
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Tags Row: Category, Service Center, Premium */}
          {(data.i140Category || data.i140ServiceCenter || data.i140PremiumProcessing) && (
            <div className="flex flex-wrap gap-2">
              {data.i140Category && (
                <Badge
                  variant="outline"
                  className="gap-1 text-xs border-2 font-medium"
                >
                  <Tag className="h-3 w-3" />
                  {getCategoryLabel(data.i140Category)}
                </Badge>
              )}
              {data.i140ServiceCenter && (
                <Badge
                  variant="outline"
                  className="gap-1 text-xs border-2 font-medium"
                >
                  <Building2 className="h-3 w-3" />
                  {data.i140ServiceCenter} Service Center
                </Badge>
              )}
              {data.i140PremiumProcessing && (
                <Badge className="gap-1 text-xs border-2 border-primary bg-primary/10 text-primary font-bold">
                  <Zap className="h-3 w-3" />
                  Premium Processing
                </Badge>
              )}
            </div>
          )}

          {/* Receipt Number — prominent display */}
          {data.i140ReceiptNumber && (
            <ValueHighlight
              label="Receipt Number"
              value={data.i140ReceiptNumber}
              mono
            />
          )}

          {/* Processing Time Estimate */}
          {data.i140Category && data.i140ServiceCenter && (
            <ProcessingTimeEstimate
              category={data.i140Category}
              serviceCenter={data.i140ServiceCenter}
              isPremium={!!data.i140PremiumProcessing}
              filingDate={data.i140FilingDate}
              isApproved={isApproved}
              isDenied={isDenied}
            />
          )}

          {/* Milestone Timeline: Filing → Receipt → Decision */}
          {(data.i140FilingDate || data.i140ReceiptDate || data.i140ApprovalDate || data.i140DenialDate) && (
            <MilestoneTrack
              color="var(--stage-i140)"
              steps={[
                { label: "Filed", value: data.i140FilingDate ? formatISODate(data.i140FilingDate) : undefined },
                { label: "Received", value: data.i140ReceiptDate ? formatISODate(data.i140ReceiptDate) : undefined },
                {
                  label: data.i140DenialDate && !data.i140ApprovalDate ? "Denied" : "Approved",
                  value: (data.i140ApprovalDate || data.i140DenialDate)
                    ? formatISODate((data.i140ApprovalDate || data.i140DenialDate)!)
                    : undefined,
                },
              ]}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No I-140 information entered yet.
        </p>
      )}
    </CaseDetailSection>
  );
}
