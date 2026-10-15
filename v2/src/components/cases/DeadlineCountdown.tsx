import { cn } from "@/lib/utils";
import { getDaysUntilDeadline, getUrgencyLevel } from "@/lib/status/urgency";
import { countdownParts, formatDeadlineDate } from "./case-card.utils";

/**
 * A case's next deadline, read at a glance: the days left large, in a block
 * whose colour says how close it is (red within a week or late, amber within
 * a month, green after that), then what's due and its date. One drawing for
 * the case folders, the case list and the dashboard, so a deadline looks the
 * same wherever it's read.
 */
export const URGENCY_FILL = {
  urgent: "bg-data-bad text-black",
  soon: "bg-data-warn text-black",
  normal: "bg-primary text-black",
} as const;

/** The same countdown as one small chip, for a row: "14 days left" on the urgency colour. */
export function CountdownChip({ deadline, className }: { deadline: string; className?: string }) {
  return <DaysChip days={getDaysUntilDeadline(deadline)} className={className} />;
}

/** The chip for a count of days already worked out (the calendar's events carry theirs). */
export function DaysChip({ days, className }: { days: number; className?: string }) {
  const { value, unit } = countdownParts(days);
  return (
    <span
      className={cn(
        "inline-flex min-w-[5.5rem] items-center justify-center px-2 py-1 text-sm font-bold tabular-nums",
        URGENCY_FILL[getUrgencyLevel(days)],
        className,
      )}
    >
      {value} {unit}
    </span>
  );
}

export function DeadlineCountdown({ deadline, label, className }: { deadline: string; label: string; className?: string }) {
  const days = getDaysUntilDeadline(deadline);
  const { value, unit } = countdownParts(days);
  const urgency = getUrgencyLevel(days);
  return (
    <div className={cn("flex min-h-14 min-w-0 items-stretch border-2 border-[var(--object-border)] bg-card", className)}>
      <div
        className={cn(
          "flex w-[4.5rem] shrink-0 flex-col items-center justify-center border-r-2 border-[var(--object-border)] px-1 py-1",
          URGENCY_FILL[urgency],
        )}
      >
        <span className="font-heading text-2xl font-bold leading-none tabular-nums">{value}</span>{" "}
        <span className="text-xs font-semibold leading-tight">{unit}</span>
      </div>{" "}
      <div className="flex min-w-0 flex-col justify-center px-3 py-1.5">
        <span className="truncate font-semibold leading-tight" title={label}>
          {label}
        </span>{" "}
        <span className="font-mono text-sm text-soft">{formatDeadlineDate(deadline)}</span>
      </div>
    </div>
  );
}
