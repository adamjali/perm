"use client";

/**
 * The whole employment-based green card, drawn to scale.
 *
 * The point of the drawing is proportion. On current published figures the
 * employer controls about two months of the process, and the stage nobody can
 * put a number on sits at the end. Written as a list those read as five equal
 * bullet points; drawn to width, the imbalance is the first thing you see,
 * which is the honest impression.
 *
 * CSS rather than SVG: it is a proportional bar, so flex widths handle it with
 * no viewBox arithmetic, no overflow risk, and text that stays selectable and
 * legible at any width.
 */

import { Lock, Timer, WarningCircle as CircleAlert } from "@phosphor-icons/react";
import type { GreenCardTimeline, TimelineStage } from "@/lib/perm";
import { cn } from "@/lib/utils";

export interface GreenCardTimelineViewProps {
  timeline: GreenCardTimeline;
  className?: string;
}

const CERTAINTY = {
  statutory: {
    label: "Fixed by regulation",
    bar: "bg-primary",
    icon: Lock,
    note: "Exact arithmetic on the prevailing wage determination.",
  },
  queue: {
    label: "Government queue",
    bar: "bg-foreground/70",
    icon: Timer,
    note: "A forecast over a backlog. It moves when the agency moves.",
  },
  unknown: {
    label: "Not knowable",
    bar: "bg-foreground/15",
    icon: CircleAlert,
    note: "No published figure supports a number here.",
  },
} as const;

function months(n: number): string {
  return n === 1 ? "1 month" : `${n} months`;
}

export function GreenCardTimelineView({ timeline, className }: GreenCardTimelineViewProps) {
  const measured = timeline.stages.filter((s) => s.months !== null) as (TimelineStage & {
    months: number;
  })[];
  const total = timeline.totalKnownMonths;
  if (!total || measured.length === 0) return null;

  return (
    <figure className={cn("m-0", className)}>
      {/* Proportional band. The unknown stage is deliberately outside it: it has
          no width because it has no number, and giving it one would invent the
          figure the whole page says cannot be known. */}
      <div className="flex h-12 w-full overflow-hidden border-2 border-border">
        {measured.map((stage, i) => (
          <div
            key={stage.id}
            className={cn(
              CERTAINTY[stage.certainty].bar,
              i > 0 && "border-l-2 border-border",
            )}
            style={{ width: `${(stage.months / total) * 100}%` }}
            title={`${stage.label}: ${months(stage.months)}`}
          />
        ))}
      </div>

      <ol className="mt-6 space-y-4">
        {timeline.stages.map((stage) => {
          const meta = CERTAINTY[stage.certainty];
          const Icon = meta.icon;
          return (
            <li
              key={stage.id}
              className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b-2 border-border/40 pb-4 last:border-b-0"
            >
              <Icon className="mt-1 h-5 w-5 shrink-0 text-foreground/60" aria-hidden="true" />
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h3 className="font-heading text-lg font-black">{stage.label}</h3>{" "}
                  <span className="text-base font-bold tabular-nums">
                    {stage.months === null ? "No published figure" : months(stage.months)}
                  </span>
                </div>
                <p className="mt-2 text-base leading-relaxed text-foreground/70">
                  {stage.detail}
                </p>{" "}
                <p className="mt-2 text-sm text-foreground/60">
                  {meta.label}. {meta.note}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <figcaption className="mt-6 border-2 border-border bg-tint-primary p-6">
        <p className="font-heading text-xl font-black leading-tight">
          {months(timeline.employerControlledMonths)} of {total} are on your
          side of the process.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          The rest is queue time at DOL and USCIS, plus a wait for a visa number
          that no published figure covers. The recruitment window is the part
          you set the pace on, and it’s the part that restarts the case if a
          date is missed.
        </p>
      </figcaption>
    </figure>
  );
}
