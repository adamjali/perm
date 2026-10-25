import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Columns for a short series (weeks, days, readings), drawn in HTML so every
 * label stays at its CSS size on a phone, with a hover and tap readout from
 * `ChartTips` and the same numbers in a table for screen readers.
 *
 * A COLUMN IS A SOFT FILL WITH AN INK CAP. The soft chart colours sit near
 * 1.2:1 against the tint, under WCAG 1.4.11's 3:1 for a mark a reader needs;
 * the 2px cap in the colour's ink is what passes, the same way the pulse's
 * typical week does.
 *
 * The column marked `now` is lime (rule 3: lime marks now), hatched when it
 * is still filling, so a week in progress never reads as a drop.
 */

export type ColumnTone = "yellow" | "blue" | "green";

const FILL: Record<ColumnTone, string> = {
  yellow: "bg-chart-yellow border-data-warn-ink",
  blue: "bg-chart-blue border-data-info-ink",
  green: "bg-chart-green border-data-good-ink",
};

export interface ColumnPart {
  value: number;
  /** A fill class for one part of a stacked column. */
  fill: string;
}

export interface Column {
  key: string;
  value: number;
  /** The hover readout, lines split by "\n". */
  tip: string;
  /** The column the chart is about: today, this week. Drawn lime. */
  now?: boolean;
  /** Still filling (a week in progress). */
  partial?: boolean;
  /** Stacked parts, bottom first; they replace the tone. */
  parts?: ColumnPart[];
  /** The table's row label. */
  label: string;
  /** Where a click on the column goes. */
  href?: string;
  /** A short label printed above the column ("Jan ’26"), for a chart read without hovering. */
  top?: string;
}

export function ColumnChart({
  columns,
  tone = "yellow",
  label,
  first,
  last,
  unit,
  className,
  height = "h-36 sm:h-40",
  grow = false,
  showMax = true,
}: {
  columns: readonly Column[];
  tone?: ColumnTone;
  /** What the chart shows: the keyboard announcement, the image label and the table caption. */
  label: string;
  /** The tick under the first and the last column. */
  first: string;
  last: string;
  /** "cases", "RFIs": the table's value heading. */
  unit: string;
  className?: string;
  /** The columns' height; with `grow`, their least height. */
  height?: string;
  /** Fill the rest of a tile: the columns take whatever height the tile has left. */
  grow?: boolean;
  /** Print the largest value above the columns (off where the value isn't a count). */
  showMax?: boolean;
}) {
  if (columns.length === 0) return null;
  const max = Math.max(1, ...columns.map((c) => c.value));
  const labelled = columns.some((c) => c.top);
  return (
    <div className={cn(grow && "flex flex-1 flex-col", className)}>
      {showMax ? <p className="text-sm tabular-nums text-muted-foreground">{formatInt(max)}</p> : null}{" "}
      <ChartTips label={label} className={cn(grow && "flex flex-1 flex-col")}>
        <div
          className={cn("mt-1 flex items-end gap-[3px] border-b-2 border-input", height, grow && "flex-1", labelled && "pt-7")}
          role="img"
          aria-label={`${label}: from ${formatInt(Math.min(...columns.map((c) => c.value)))} to ${formatInt(max)}.`}
        >
          {columns.map((c) => {
            const h = c.value > 0 ? Math.max(2, (c.value / max) * 100) : 0;
            if (c.parts?.length) {
              return (
                <div
                  key={c.key}
                  data-tip={c.tip}
                  data-href={c.href}
                  className={cn("flex flex-1 flex-col-reverse", c.now && "outline outline-2 outline-offset-1 outline-foreground")}
                  style={{ height: `${h}%` }}
                >
                  {c.parts.map((p, i) => (
                    <div key={i} className={p.fill} style={{ height: `${c.value ? (p.value / c.value) * 100 : 0}%` }} />
                  ))}
                </div>
              );
            }
            return (
              <div
                key={c.key}
                data-tip={c.tip}
                data-href={c.href}
                className={cn(
                  "relative flex-1 border-t-2",
                  c.now ? "border-foreground bg-primary" : FILL[tone],
                  c.partial && "bg-hatch text-input",
                )}
                style={{ height: `${h}%` }}
              >
                {c.top ? (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm tabular-nums text-soft" aria-hidden="true">
                    {c.top}{" "}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </ChartTips>{" "}
      <div className="mt-2 flex justify-between gap-4 text-sm tabular-nums text-muted-foreground">
        <span>{first}</span>{" "}
        <span>{last}</span>
      </div>
      {/* sr-only on a <table> can't shrink it below its content; a div can. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Period{" "}</th>
              <th scope="col">{unit}{" "}</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c) => (
              <Fragment key={c.key}>
                <tr>
                  <td>{c.label}{" "}</td>
                  <td>{formatInt(c.value)}{c.partial ? " so far" : ""}{" "}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
