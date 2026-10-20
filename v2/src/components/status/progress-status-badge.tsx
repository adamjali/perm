import { formatProgressStatus } from "@convex/lib/notificationHelpers"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ProgressStatus } from "@/lib/perm"

/**
 * The soft fill each progress status takes (owner, Oct 19 2026): filed green,
 * working on it yellow, RFI or RFE red, waiting for intake blue, under review
 * purple. Approved keeps the full green, so it still stands apart from filed.
 * The words always say the same thing, so colour is never the only signal.
 */
export const PROGRESS_FILL: Record<ProgressStatus, string> = {
  working: "bg-soft-wait text-foreground",
  waiting_intake: "bg-soft-info text-foreground",
  filed: "bg-soft-good text-foreground",
  approved: "bg-data-good text-black",
  under_review: "bg-soft-purple text-foreground",
  rfi_rfe: "bg-soft-bad text-foreground",
}

/** Where a case stands within its stage, as a soft chip. */
export function ProgressStatusBadge({ status, className }: { status: ProgressStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(PROGRESS_FILL[status], className)} data-progress={status}>
      {formatProgressStatus(status)}
    </Badge>
  )
}
