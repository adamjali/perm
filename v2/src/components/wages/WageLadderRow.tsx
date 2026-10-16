import { RUNGS, RUNG_LABEL, isComplete, type Ladder } from "@/lib/wageLadder";
import { formatDollars } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One wage ladder, drawn against a domain shared with its siblings.
 *
 * NOT AN SVG, DELIBERATELY. A ladder is four horizontal spans and five ticks,
 * all positioned by percentage of the wage domain, which CSS does exactly and
 * reflows for free. Drawing it in SVG would bring back three problems this
 * codebase has already paid for: text inside a viewBox scales with the
 * viewBox (13px in a 720-unit drawing rendered at 5.5px in a phone column),
 * a label's width has to be measured rather than estimated, and a wide
 * drawing needs a min-width and its own scroll container. Percentages have
 * none of that, and the numbers stay in the markup where an extractor and a
 * screen reader can both read them.
 *
 * THE GEOMETRY CARRIES THE MEANING, NOT OPACITY.
 *   thin rule      p5 to p95    the range nine in ten offers fall inside
 *   solid block    p25 to p75   the middle half
 *   tall tick      p50          the median
 *   short ticks    p10, p90     where the tails start
 * Two spans that differ only in opacity end up sharing one caption and being
 * read as one thing; four different shapes cannot.
 */

export interface WageLadderRowProps {
  ladder: Ladder;
  /** Shared domain, so every row in a set is comparable. */
  domain: [number, number];
  /** Rendered when the ladder is incomplete, in place of the drawing. */
  withheldNote?: string;
  className?: string;
}

/**
 * What a ladder says on hover: every rung, which the row draws but only partly
 * prints, and its population. Read inside a `ChartTips` the caller places
 * around the whole set of rows.
 */
export function ladderTip(ladder: Ladder): string {
  return [
    ladder.label,
    ...RUNGS.map((r) => `${r === "p50" ? "Median" : `${RUNG_LABEL[r]} percentile`}: ${formatDollars(ladder[r] as number)}`),
    `${ladder.count.toLocaleString("en-US")} certified cases`,
  ].join("\n");
}

/** Position within the shared domain, clamped so nothing escapes the track. */
function pct(v: number, [lo, hi]: [number, number]): number {
  if (hi <= lo) return 0;
  return Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
}

export function WageLadderRow({
  ladder,
  domain,
  withheldNote,
  className,
}: WageLadderRowProps) {
  if (!isComplete(ladder)) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {withheldNote ??
          `No ladder is published for ${ladder.label}: at least one percentile is missing from the cell.`}
      </p>
    );
  }
  // Every rung resolved, so the assertions below are what isComplete proved.
  const p = Object.fromEntries(
    RUNGS.map((r) => [r, pct(ladder[r] as number, domain)]),
  ) as Record<(typeof RUNGS)[number], number>;

  return (
    <div
      className={cn("relative h-7 w-full", className)}
      data-tip={ladderTip(ladder)}
      role="img"
      aria-label={
        `${ladder.label}: 5th percentile ${formatDollars(ladder.p5 as number)}, ` +
        `median ${formatDollars(ladder.p50 as number)}, ` +
        `95th percentile ${formatDollars(ladder.p95 as number)}, ` +
        `from ${ladder.count.toLocaleString("en-US")} certified cases.`
      }
    >
      {/* The bed. A hairline the full width of the domain, so a short ladder
          reads as short rather than as a chart that failed to render. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-input"
      />
      {/* p5 to p95. */}
      <span
        aria-hidden="true"
        className="absolute top-1/2 h-1 -translate-y-1/2 bg-chart-yellow"
        style={{ left: `${p.p5}%`, width: `${Math.max(0, p.p95 - p.p5)}%` }}
      />
      {/* p25 to p75, the middle half. */}
      <span
        aria-hidden="true"
        // A soft green fill inside a dark green edge (round 3, Oct 15 2026:
        // soft colours, no grey). The edge, --data-good-ink, measures 4.70:1
        // on the #FAFAFA page, over WCAG 1.4.11's 3:1 floor for a graphical
        // object, so the shape reads whatever the fill.
        className="absolute top-1/2 h-4 -translate-y-1/2 border-2 border-data-good-ink bg-chart-green"
        style={{ left: `${p.p25}%`, width: `${Math.max(0, p.p75 - p.p25)}%` }}
      />
      {/* p10 and p90: where the tails start. */}
      {(["p10", "p90"] as const).map((r) => (
        <span
          key={r}
          aria-hidden="true"
          className="absolute top-1/2 h-2 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-data-warn"
          style={{ left: `${p[r]}%` }}
        />
      ))}
      {/* The median, tallest and darkest. */}
      <span
        aria-hidden="true"
        className="absolute top-1/2 h-6 w-[3px] -translate-x-1/2 -translate-y-1/2 bg-data-good-ink"
        style={{ left: `${p.p50}%` }}
      />
    </div>
  );
}

/**
 * The key. Drawn from the same primitives as the row rather than described in
 * prose, so a reader checks the shape against the shape.
 */
export function WageLadderKey({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-1 w-8 bg-chart-yellow" />{" "}
        <span>5th to 95th</span>
      </li>{" "}
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-4 w-8 border-2 border-data-good-ink bg-chart-green"
        />{" "}
        <span>25th to 75th</span>
      </li>{" "}
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-5 w-[3px] bg-data-good-ink" />{" "}
        <span>Median</span>
      </li>{" "}
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-2 w-0.5 bg-data-warn" />{" "}
        <span>10th and 90th</span>
      </li>{" "}
    </ul>
  );
}
