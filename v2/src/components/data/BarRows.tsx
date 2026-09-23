import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Server-rendered bar rows and a stacked bar, for the USCIS quarterly pages.
 *
 * No chart library and no client JS: each row is a label, a length and the
 * figure, in the served HTML, which is what an answer engine reads and what a
 * phone paints first. A length says "which one is biggest" faster than a
 * column of numbers the eye has to compare, and the number is still there for
 * anyone who wants it. Same idiom as `I140SubtypePanel`.
 *
 * A NULL IS NOT A SMALL NUMBER. USCIS withholds a cell of 1 to 9 as "D"; the
 * row keeps its place, draws no bar and says "withheld", because a bar of
 * zero would rank an office with a handful of cases below one with none.
 */

export interface BarRow {
  key: string;
  label: ReactNode;
  /** A second, quieter line under the label. */
  sub?: ReactNode;
  /** The bar's length; null draws no bar and prints "withheld". */
  value: number | null;
  /** The figure as printed beside the bar. */
  text: string;
  tone?: "primary" | "ink";
}

export function BarRows({
  rows,
  max,
  className,
}: {
  rows: readonly BarRow[];
  /** The value that fills the bar; defaults to the largest value present. */
  max?: number;
  className?: string;
}) {
  const top = max ?? Math.max(0, ...rows.map((r) => r.value ?? 0));
  return (
    <ol className={cn("space-y-3", className)}>
      {rows.map((r) => {
        const width = r.value === null || top <= 0 ? 0 : Math.max(1, (r.value / top) * 100);
        return (
          <Fragment key={r.key}>{" "}
          <li className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4">
            <div className="min-w-0">
              <p className="text-base font-semibold leading-snug">{r.label}</p>{" "}
              {r.sub ? <p className="text-sm text-muted-foreground">{r.sub}</p> : null}
              <div className="mt-1.5 h-2.5 w-full bg-muted" aria-hidden="true">
                {r.value !== null ? (
                  <div
                    className={cn("h-full", r.tone === "ink" ? "bg-foreground" : "bg-primary")}
                    style={{ width: `${width}%` }}
                  />
                ) : null}
              </div>
            </div>
            <span className="whitespace-nowrap font-mono text-base font-bold tabular-nums">
              {r.value === null ? "withheld" : r.text}
            </span>
          </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

export interface StackSegment {
  key: string;
  label: string;
  value: number;
}

/** The five grounds the stacked bar uses, in segment order, all on house tokens. */
const STACK_TONES = ["bg-primary", "bg-foreground", "bg-foreground/60", "bg-foreground/35", "bg-primary/40"] as const;

/**
 * One bar split into parts, with a legend that carries the figures. The bar
 * is decoration (aria-hidden); the legend is the data.
 */
export function StackedBar({
  segments,
  total,
  className,
}: {
  segments: readonly StackSegment[];
  /** The bar's full length; defaults to the sum of the segments. */
  total?: number;
  className?: string;
}) {
  const sum = total ?? segments.reduce((a, s) => a + s.value, 0);
  return (
    <div className={className}>
      <div className="flex h-4 w-full overflow-hidden bg-muted" aria-hidden="true">
        {segments.map((s, i) => (
          <div
            key={s.key}
            className={cn("h-full", STACK_TONES[i % STACK_TONES.length])}
            style={{ width: sum > 0 ? `${(s.value / sum) * 100}%` : "0%" }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {segments.map((s, i) => (
          <Fragment key={s.key}>{" "}
          <li className="flex items-center gap-1.5">
            <span className={cn("inline-block h-3 w-3 shrink-0", STACK_TONES[i % STACK_TONES.length])} aria-hidden="true" />{" "}
            <span className="text-foreground/80">{s.label}</span>{" "}
            <span className="font-mono font-bold tabular-nums">{s.value.toLocaleString("en-US")}</span>{" "}
            {sum > 0 ? (
              <span className="text-muted-foreground">({Math.round((s.value / sum) * 100)}%)</span>
            ) : null}
          </li>
          </Fragment>
        ))}
      </ul>
    </div>
  );
}

/** The empty state every USCIS quarterly page shares: the file has not arrived. */
export function QuarterlyEmpty({ file, children }: { file: string; children?: ReactNode }) {
  return (
    <section className="mt-8 border-2 border-border bg-muted p-6 sm:p-8">
      <h2 className="font-heading text-xl font-black">Nothing loaded yet</h2>{" "}
      <p className="mt-3 max-w-2xl leading-relaxed text-foreground/70">
        USCIS&apos;s quarterly file ({file}) has not been read into this site&apos;s
        record yet, so there are no figures to show. The file itself is on{" "}
        <a
          href="https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          USCIS&apos;s immigration and citizenship data page
        </a>
        .
      </p>{" "}
      {children}
    </section>
  );
}
