import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CaseStatus } from "@/lib/perm"
import { STAGE_VISUALS } from "./stage-visuals"

/** Fallback for unknown/invalid stages (defensive coding) */
const FALLBACK = { fill: "bg-muted-foreground", label: "Unknown" }

interface CaseStageBadgeProps {
  stage: CaseStatus
  className?: string
}

/**
 * A case's stage as a quiet chip: the stage's own colour as a dot beside its
 * name. The colour is a reminder of the stage, never the whole fill.
 */
export function CaseStageBadge({ stage, className }: CaseStageBadgeProps) {
  const config = STAGE_VISUALS[stage] ?? FALLBACK
  return (
    <Badge className={cn("font-normal", className)} data-status={stage}>
      <span aria-hidden="true" className={cn("size-2 shrink-0", config.fill)} />
      {config.label}
    </Badge>
  )
}
