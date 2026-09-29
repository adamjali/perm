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
    label: "Waiting for intake",
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
    label: "Under review",
  },
  rfi_rfe: {
    className: "bg-urgency-urgent text-white border-border",
    label: "RFI/RFE",
  },
}

interface ProgressStatusBadgeProps {
  status: ProgressStatus
  className?: string
  /**
   * "paper" for the manila case card, which stays light in both themes: the
   * neutral states take white paper and black ink instead of theme tokens.
   */
  surface?: "theme" | "paper"
}

// Neutral states on the always-light folder; the coloured states keep their fill.
const paperOverride: Partial<Record<ProgressStatus, string>> = {
  working: "bg-white/80 text-black",
  waiting_intake: "bg-black/10 text-black",
}

export function ProgressStatusBadge({ status, className, surface = "theme" }: ProgressStatusBadgeProps) {
  const config = progressConfig[status]
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-sm",
        config.className,
        surface === "paper" && ["border-black", paperOverride[status]],
        className,
      )}
      data-progress={status}
    >
      {config.label}
    </Badge>
  )
}
