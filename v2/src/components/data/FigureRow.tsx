import type { ReactNode } from "react";
import { MinusIcon, TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

/**
 * A row of headline figures in one ink frame, each figure its own
 * compartment (round 2, Oct 15 2026, back toward the original's stat cards):
 * the label, the number and what it counts. The 2px lines between them are
 * the frame's own ink showing through the gaps, and every row fills its
 * width, so no empty cell is ever left showing. On a phone they stack.
 */
export function FigureRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-[2px] border-2 border-border bg-border shadow-hard-sm", className)}>
      {children}
    </div>
  );
}

const TONE = {
  paper: "bg-card text-foreground",
  lime: "bg-primary text-primary-foreground",
  ink: "bg-[#141414] text-white",
} as const;

/**
 * What a figure says against its yardstick, in a chip under the number: which
 * way (up, down, level), and whether that's good, bad or neither. The words
 * carry it ("3.0 points above the field"); the arrow and the fill repeat it
 * for the eye, never alone. Ink words on the soft fills (WCAG 1.4.3); the
 * arrows are -ink on the same fills, 4.3:1 or more in both themes (1.4.11).
 */
export interface FigureTrend {
  text: string;
  dir: "up" | "down" | "level";
  /** good and bad colour the chip; info is a change that's neither (more filings). */
  tone: "good" | "bad" | "info" | "neutral";
}

const TREND_FILL: Record<FigureTrend["tone"], string> = {
  good: "bg-soft-good",
  bad: "bg-soft-bad",
  info: "bg-soft-info",
  neutral: "bg-muted",
};

const TREND_INK: Record<FigureTrend["tone"], string> = {
  good: "text-data-good-ink",
  bad: "text-data-bad-ink",
  info: "text-data-info-ink",
  neutral: "text-muted-foreground",
};

export function TrendChip({ trend, className }: { trend: FigureTrend; className?: string }) {
  const Arrow = trend.dir === "up" ? TrendUpIcon : trend.dir === "down" ? TrendDownIcon : MinusIcon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 text-sm font-semibold leading-snug text-foreground", TREND_FILL[trend.tone], className)}>
      <Arrow aria-hidden="true" weight="bold" className={cn("size-4 shrink-0", TREND_INK[trend.tone])} />
      {trend.text}
    </span>
  );
}

export function Figure({
  label,
  value,
  note,
  tone = "paper",
  icon,
  trend,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** A small icon before the label, saying at a glance what the figure is. */
  icon?: ReactNode;
  /** The figure against its yardstick, as a coloured chip under the number. */
  trend?: FigureTrend;
  /** One figure in a row may stand out: the lime one is the reader's own. */
  tone?: keyof typeof TONE;
}) {
  return (
    <div className={cn("min-w-0 flex-1 basis-40 px-4 py-3.5 sm:px-5 sm:py-4", TONE[tone])}>
      <p className="flex items-center gap-1.5 text-sm font-bold">
        {icon ? <span aria-hidden="true" className="inline-flex shrink-0 [&_svg]:size-4">{icon}</span> : null}
        {label}
      </p>{" "}
      <p className="mt-1.5 font-heading text-[1.75rem] font-bold leading-none tabular-nums sm:text-[2rem]">{value}</p>{" "}
      {trend ? <TrendChip trend={trend} className="mt-2" /> : null}{" "}
      {note ? (
        <p className={cn("mt-1.5 text-sm leading-snug", tone === "paper" ? "text-muted-foreground" : "opacity-85")}>{note}</p>
      ) : null}
    </div>
  );
}
