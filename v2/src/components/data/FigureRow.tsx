import type { ReactNode } from "react";

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

export function Figure({
  label,
  value,
  note,
  tone = "paper",
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** One figure in a row may stand out: the lime one is the reader's own. */
  tone?: keyof typeof TONE;
}) {
  return (
    <div className={cn("min-w-0 flex-1 basis-44 p-4 sm:p-5", TONE[tone])}>
      <p className="text-sm font-bold">{label}</p>{" "}
      <p className="mt-2 font-heading text-3xl font-bold leading-none tabular-nums sm:text-4xl">{value}</p>{" "}
      {note ? (
        <p className={cn("mt-2 text-sm leading-snug", tone === "paper" ? "text-muted-foreground" : "opacity-85")}>{note}</p>
      ) : null}
    </div>
  );
}
