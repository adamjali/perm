import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ProgressStatus } from "@/lib/perm"

// Progress status visual config - neobrutalist bold colors with black borders
const progressConfig: Record<ProgressStatus, { className: string; label: string }> = {
  working: {
    className: "bg-neutral-200 text-neutral-900 border-black dark:bg-neutral-700 dark:text-neutral-100",
    label: "Working on it",
  },
  waiting_intake: {
    className: "bg-neutral-100 text-neutral-700 border-black dark:bg-neutral-800 dark:text-neutral-300",
    label: "Waiting for Intake",
  },
  filed: {
    className: "bg-[#0066FF] text-white border-black dark:bg-[#0066FF]/80",
    label: "Filed",
  },
  approved: {
    className: "bg-[#228B22] text-white border-black dark:bg-[#228B22]/80",
    label: "Approved",
  },
  under_review: {
    className: "bg-[#D97706] text-white border-black dark:bg-[#D97706]/80",
    label: "Under Review",
  },
  rfi_rfe: {
    className: "bg-[#DC2626] text-white border-black dark:bg-[#DC2626]/80",
    label: "RFI/RFE",
  },
}

interface ProgressStatusBadgeProps {
  status: ProgressStatus
  className?: string
}

export function ProgressStatusBadge({ status, className }: ProgressStatusBadgeProps) {
  const config = progressConfig[status]
  return (
    <Badge
      variant="outline"
      className={cn("text-xs", config.className, className)}
      data-progress={status}
    >
      {config.label}
    </Badge>
  )
}
