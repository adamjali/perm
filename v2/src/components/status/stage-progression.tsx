import { cn } from "@/lib/utils"
import type { CaseStatus } from "@/lib/perm"

// Stage colors matching design4
const stageColors: Record<CaseStatus, string> = {
  pwd: "#0066FF",
  recruitment: "#9333ea",
  eta9089: "#D97706",
  i140: "#059669",
  closed: "#6B7280",
}

const stageLabels: Record<CaseStatus, { label: string; number: string }> = {
  pwd: { label: "PWD Phase", number: "01" },
  recruitment: { label: "Recruitment", number: "02" },
  eta9089: { label: "ETA 9089", number: "03" },
  i140: { label: "I-140 Phase", number: "04" },
  closed: { label: "Closed", number: "05" },
}

interface StageProgressionItemProps {
  stage: CaseStatus
  progressLabel?: string // e.g., "FILED", "ACTIVE", "PREP"
  className?: string
}

export function StageProgressionItem({
  stage,
  progressLabel = "ACTIVE",
  className
}: StageProgressionItemProps) {
  const color = stageColors[stage]
  const { label, number } = stageLabels[stage]

  return (
    <div className={cn("group cursor-pointer", className)}>
      {/* Stage tag */}
      <div
        className="inline-block px-2.5 py-1 text-[10px] font-extrabold uppercase border-[1.5px] border-black shadow-hard-sm mb-2 text-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </div>

      {/* Number + Progress label */}
      <div
        className="text-2xl font-bold mono transition-colors"
      >
        <span className="group-hover:text-[var(--hover-color)]" style={{ '--hover-color': color } as React.CSSProperties}>
          {number}. {progressLabel}
        </span>
      </div>

      {/* Expanding underline */}
      <div
        className="w-0 group-hover:w-full h-1 transition-all duration-500 mt-1"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}

interface StageProgressionProps {
  stages: Array<{ stage: CaseStatus; progressLabel: string }>
  className?: string
}

export function StageProgression({ stages, className }: StageProgressionProps) {
  return (
    <div className={cn("flex flex-wrap gap-8", className)}>
      {stages.map((item) => (
        <StageProgressionItem
          key={item.stage}
          stage={item.stage}
          progressLabel={item.progressLabel}
        />
      ))}
    </div>
  )
}
