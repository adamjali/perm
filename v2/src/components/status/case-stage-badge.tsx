import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CaseStatus } from "@/lib/perm"
import { STAGE_VISUALS } from "./stage-visuals"

/** Fallback for unknown/invalid stages (defensive coding) */
const FALLBACK_CONFIG = { fill: "bg-muted-foreground", onFill: "text-white", label: "Unknown" }

interface CaseStageBadgeProps {
  stage: CaseStatus
  /** Use black border instead of color-matched border (neobrutalist style) */
  bordered?: boolean
  className?: string
}

export function CaseStageBadge({ stage, bordered = false, className }: CaseStageBadgeProps) {
  // Fill and ink come from the shared stage map, where each pairing is measured.
  const config = STAGE_VISUALS[stage] ?? FALLBACK_CONFIG
  const borderClass = bordered
    ? "border-2 border-border"
    : "border-transparent"

  return (
    <Badge
      className={cn("font-semibold", config.fill, config.onFill, borderClass, className)}
      data-status={stage}
    >
      {config.label}
    </Badge>
  )
}
