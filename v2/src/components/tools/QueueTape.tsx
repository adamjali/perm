import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * The queue, drawn as a measuring tape.
 *
 * PERM's mental model is one line: every case waits in filing-month order and
 * DOL clears it oldest-first. This renders that line as an instrument strip —
 * cleared months in solid primary, waiting months in paper, the frontier
 * marked with a flag, and optionally the reader's own month.
 *
 * Presentational and server-renderable: months in, markup out. The timeline
 * calculator passes `selectedMonth` from its own state; the overview passes
 * none and shows the national picture.
 */

export interface QueueTapeProps {
  /** DOL's analyst-review frontier, "YYYY-MM". */
  frontierMonth: string;
  /** The reader's filing month, "YYYY-MM". Optional. */
  selectedMonth?: string;
  /** Months to draw after the frontier. The wait, visually. */
  monthsAhead?: number;
  /** Months to draw before the frontier. Cleared territory. */
  monthsBehind?: number;
  className?: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = (y ?? 0) * 12 + ((m ?? 1) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function label(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${String(y ?? 0).slice(2)}`;
}

export function QueueTape({
  frontierMonth,
  selectedMonth,
  monthsAhead = 10,
  monthsBehind = 8,
  className,
}: QueueTapeProps) {
  const months: string[] = [];
  for (let i = -monthsBehind; i <= monthsAhead; i += 1) {
    months.push(addMonths(frontierMonth, i));
  }

  return (
    <figure className={cn("m-0", className)}>
      <div className="-mx-1 overflow-x-auto px-1 pt-7">
        <div
          className="relative grid min-w-[560px] border-2 border-border shadow-hard-sm"
          style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
        >
          {months.map((m) => {
            const cleared = m < frontierMonth;
            const isFrontier = m === frontierMonth;
            const isYou = m === selectedMonth;
            return (
              <Fragment key={m}>{" "}
              <div
                className={cn(
                  "relative flex h-16 items-end justify-center border-r border-border/30 pb-1 last:border-r-0",
                  cleared && "bg-primary",
                  isFrontier && "bg-primary/80",
                  !cleared && !isFrontier && "bg-card",
                )}
              >
                {/* Tick */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-1/2 top-0 h-2 w-px",
                    cleared || isFrontier ? "bg-black/50" : "bg-border/60",
                  )}
                />
                <span
                  className={cn(
                    "font-mono text-[11px] font-bold leading-none",
                    cleared || isFrontier ? "text-black/80" : "text-foreground/50",
                    // Room is tight: label every other month, ends always.
                    months.indexOf(m) % 2 !== 0 &&
                      !isFrontier && !isYou && "sr-only",
                  )}
                >
                  {label(m)}
                </span>
                {/* Real space: the flag span is adjacent to the label span
                    and would glue for every DOM extractor. */}
                {" "}
                {isFrontier ? (
                  <span className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border-2 border-border bg-foreground px-1.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wider text-background">
                    DOL is here
                  </span>
                ) : null}
                {isYou && !isFrontier ? (
                  <span className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border-2 border-border bg-primary px-1.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wider text-black">
                    You
                  </span>
                ) : null}
              </div>
              </Fragment>
            );
          })}
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground/70">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 border border-border bg-primary" />
          Cleared, oldest first
        </span>{" "}
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 border border-border bg-card" />
          Still waiting
        </span>
      </figcaption>
    </figure>
  );
}
