import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ProgressStatus } from "@/lib/perm"

// Progress status visual config - neobrutalist bold colors with black borders
const progressConfig: Record<ProgressStatus, { className: string; label: string }> = {
  working: {
    className: "bg-accent text-foreground border-border",
    label: "Working on it",
  },
  waiting_intake: {
    className: "bg-muted text-foreground border-border",
    label: "Waiting for Intake",
  },
  filed: {
    className: "bg-stage-pwd text-white border-border",
    label: "Filed",
  },
  approved: {
    className: "bg-primary text-primary-foreground border-border",
    label: "Approved",
  },
  under_review: {
    className: "bg-stage-eta9089 text-black border-border",
    label: "Under Review",
  },
  rfi_rfe: {
    className: "bg-urgency-urgent text-white border-border",
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
