import { formatProgressStatus } from "@convex/lib/notificationHelpers"
import { ToneBadge } from "@/components/ui/badge"
import type { StatusTone } from "@/lib/statusTone"
import type { ProgressStatus } from "@/lib/perm"

/** The tone each progress status's dot takes; the words are the shared labels. */
const TONE: Record<ProgressStatus, StatusTone> = {
  working: "flat",
  waiting_intake: "flat",
  filed: "flat",
  approved: "good",
  under_review: "flat",
  rfi_rfe: "warn",
}

/** Where a case stands within its stage, as a quiet chip. */
export function ProgressStatusBadge({ status, className }: { status: ProgressStatus; className?: string }) {
  return (
    <ToneBadge tone={TONE[status]} className={className} data-progress={status}>
      {formatProgressStatus(status)}
    </ToneBadge>
  )
}
