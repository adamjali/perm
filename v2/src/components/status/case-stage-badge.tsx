import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CaseStatus } from "@/lib/perm"

/**
 * Stage configuration using CSS variables from globals.css
 * @see perm_flow.md for canonical case status definitions
 */
const stageConfig: Record<CaseStatus, { bg: string; label: string }> = {
  pwd: { bg: "bg-[var(--stage-pwd)]", label: "PWD" },
  recruitment: { bg: "bg-[var(--stage-recruitment)]", label: "Recruitment" },
  eta9089: { bg: "bg-[var(--stage-eta9089)]", label: "ETA 9089" },
  i140: { bg: "bg-[var(--stage-i140)]", label: "I-140" },
  closed: { bg: "bg-[var(--stage-closed)]", label: "Closed" },
}

/** Fallback for unknown/invalid stages (defensive coding) */
const FALLBACK_CONFIG = { bg: "bg-gray-500", label: "Unknown" }

interface CaseStageBadgeProps {
  stage: CaseStatus
  /** Use black border instead of color-matched border (neobrutalist style) */
  bordered?: boolean
  className?: string
}

export function CaseStageBadge({ stage, bordered = false, className }: CaseStageBadgeProps) {
  const config = stageConfig[stage] ?? FALLBACK_CONFIG
  const borderClass = bordered
    ? "border-[1.5px] border-black dark:border-white/20 shadow-[2px_2px_0_#000] dark:shadow-[2px_2px_0_rgba(255,255,255,0.2)]"
    : "border-transparent"

  return (
    <Badge
      className={cn("font-semibold text-white", config.bg, borderClass, className)}
      data-status={stage}
    >
      {config.label}
    </Badge>
  )
}
