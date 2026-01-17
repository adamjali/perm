"use client";

import ProgressRing from "@/components/ui/progress-ring";
import { NavigableCard } from "@/components/ui/navigable-card";

export type CornerVariant = "none" | "solid" | "bar" | "tag";

interface SummaryTileProps {
  status: "pwd" | "recruitment" | "eta9089" | "i140" | "complete" | "closed" | "duplicates";
  label: string;
  count: number;
  subtext: string;
  href: string;
  /** Corner decoration variant: "none" (default), "solid" (color block), "bar" (full-width bar), or "tag" (small badge) */
  cornerVariant?: CornerVariant;
  /** Progress value (0-100) for the progress ring around the count. Shows ring when provided. */
  progress?: number;
}

// Status colors - hex values for inline styles (dark mode compatible)
const STATUS_HEX_COLORS = {
  pwd: "#0066FF",
  recruitment: "#9333ea",
  eta9089: "#D97706",
  i140: "#059669",
  complete: "#059669",
  closed: "#6B7280",
  duplicates: "#F97316", // Orange to indicate potential issue
} as const;

// Stage badge labels (from design4 Stage Progression section)
const STAGE_BADGE_LABELS = {
  pwd: "PWD Phase",
  recruitment: "Recruitment",
  eta9089: "ETA 9089",
  i140: "I-140 Phase",
  complete: "Complete",
  closed: "Closed",
  duplicates: "Duplicates",
} as const;

/**
 * Corner decoration component - renders different styles based on variant
 */
function CornerDecoration({
  variant,
  color,
  status,
}: {
  variant: CornerVariant;
  color: string;
  status: keyof typeof STAGE_BADGE_LABELS;
}) {
  if (variant === "none") return null;

  if (variant === "solid") {
    // Option A: Solid color block in top-right corner (no text)
    // Small 6x6 square that sits flush in the corner, outside content area
    return (
      <div
        className="absolute top-0 right-0 w-6 h-6"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
    );
  }

  if (variant === "bar") {
    // Full-width bar at top with stage label
    return (
      <div
        className="absolute top-0 left-0 right-0 px-2 py-1 text-[9px] font-extrabold uppercase text-white text-center"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {STAGE_BADGE_LABELS[status]}
      </div>
    );
  }

  if (variant === "tag") {
    // Design4 stage-tag style: small badge with hard shadow, positioned top-right
    return (
      <div
        className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-extrabold uppercase text-white border-[1.5px] border-black dark:border-white/20"
        style={{
          backgroundColor: color,
          boxShadow: "2px 2px 0px #000",
        }}
        aria-hidden="true"
      >
        {STAGE_BADGE_LABELS[status]}
      </div>
    );
  }

  return null;
}

export default function SummaryTile({
  status,
  label,
  count,
  subtext,
  href,
  cornerVariant = "none",
  progress,
}: SummaryTileProps) {
  const color = STATUS_HEX_COLORS[status];
  const hasProgressRing = progress !== undefined;

  return (
    <div
      data-status={status}
      style={{ "--tile-color": color } as React.CSSProperties}
    >
      <NavigableCard
        href={href}
        loadingIndicator="overlay"
        className="group relative bg-card border-4 border-black dark:border-white/20 shadow-hard hover:shadow-hard-lg hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-200 p-6 overflow-hidden"
      >
        {/* Corner decoration */}
        <CornerDecoration variant={cornerVariant} color={color} status={status} />

        {/* Content - add top padding when tag variant on mobile to avoid overlap, right padding on larger screens */}
        <div className={`relative z-10 ${cornerVariant === "bar" ? "pt-4" : ""} ${cornerVariant === "tag" ? "pt-8 sm:pt-0 sm:pr-20" : ""}`}>
          {/* Status label with hover color effect */}
          <div className="mb-3">
            <h3 className="font-heading font-bold text-sm sm:text-base text-foreground transition-colors group-hover:text-[var(--tile-color)] leading-tight">
              {label}
            </h3>
            {/* Expanding underline (StageProgression effect) */}
            <div
              className="h-1 w-0 group-hover:w-full transition-all duration-500 mt-1"
              style={{ backgroundColor: color }}
            />
          </div>

          {/* Count with optional progress ring */}
          <div className="mb-2">
            {hasProgressRing ? (
              <div className="relative inline-block">
                <ProgressRing
                  value={progress}
                  size={72}
                  strokeWidth={5}
                  color={color}
                  animateOnScroll={true}
                />
                {/* Count centered inside ring */}
                <div
                  className="absolute inset-0 flex items-center justify-center mono text-2xl sm:text-3xl font-bold text-foreground transition-colors group-hover:text-[var(--tile-color)]"
                  data-testid="main-count"
                >
                  {count}
                </div>
              </div>
            ) : (
              <div
                className="mono text-3xl sm:text-4xl font-bold text-foreground transition-colors group-hover:text-[var(--tile-color)]"
                data-testid="main-count"
              >
                {count}
              </div>
            )}
          </div>

          {/* Subtext - theme-aware */}
          {subtext && (
            <div className="text-xs sm:text-sm text-muted-foreground leading-tight">{subtext}</div>
          )}
        </div>
      </NavigableCard>
    </div>
  );
}
