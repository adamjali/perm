import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The interpretation layer: say what the number MEANS, above the number.
 *
 * The measured gap against the rival is not data — we hold a fresher cut of
 * the same files — it is that they conclude and we tabulate. Their pages open
 * with "The DOL is deciding PERM cases filed in September 2025" and a verdict
 * chip; ours opened with a table and left the reader to do the arithmetic.
 *
 * Everything here is a shape for a claim that is TRUE BY CONSTRUCTION:
 * arithmetic on figures already on the page. No projections, no scores, no
 * modelled probabilities. A verdict we cannot derive is a verdict we do not
 * ship.
 */

type Direction = "good" | "warn" | "bad" | "flat";

/*
 * NO TEXT COLOUR HERE, DELIBERATELY. The badge INHERITS from whatever it sits
 * on, and that is the only thing that works in both places it is used.
 *
 * `InsightLede` is an inverted panel - `bg-foreground text-background` - so it
 * is black in the light theme and near-white in the dark one. This map used to
 * hardcode `text-foreground`, which on that panel is THE SAME COLOUR AS THE
 * BACKGROUND: black on black in light, white on white in dark. The badge was
 * unreadable in both themes, and it looked like a styling nicety rather than a
 * bug because the border and tint still drew fine.
 *
 * Inheriting is correct on an ordinary surface too, where the ambient colour
 * already is `--foreground`. The backgrounds stay keyed to `--card` rather
 * than the panel, which is intentional: a tinted chip needs a stable ground,
 * and at 14-16% over card it stays legible under inherited text either way.
 */
const DIRECTION_STYLE: Record<Direction, string> = {
  good: "border-primary bg-primary/15",
  warn: "border-[var(--data-warn)] bg-[color-mix(in_srgb,var(--data-warn)_16%,var(--card))]",
  bad: "border-[var(--data-bad)] bg-[color-mix(in_srgb,var(--data-bad)_14%,var(--card))]",
  flat: "border-border bg-card",
};

const DIRECTION_MARK: Record<Direction, string> = {
  good: "▲",
  warn: "▲",
  bad: "▼",
  flat: "■",
};

/**
 * A verdict chip. Reads before the figure it describes, because "gaining
 * ground" is the answer and "+279" is the evidence.
 */
export function Verdict({
  direction = "flat",
  children,
}: {
  direction?: Direction;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border-2 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider",
        DIRECTION_STYLE[direction],
      )}
    >
      <span aria-hidden="true">{DIRECTION_MARK[direction]}</span>
      {children}
    </span>
  );
}

/**
 * The lede claim on a data page: one sentence stating what the data says,
 * with the figures inside it, above everything else on the page.
 */
export function InsightLede({
  verdict,
  direction,
  children,
  source,
}: {
  verdict?: string;
  direction?: Direction;
  children: ReactNode;
  source?: ReactNode;
}) {
  return (
    <div className="border-2 border-border bg-foreground p-6 text-background shadow-hard sm:p-8">
      {verdict ? (
        <div className="mb-4">
          <Verdict direction={direction}>{verdict}</Verdict>
        </div>
      ) : null}
      <p className="max-w-3xl font-heading text-xl font-black leading-snug sm:text-2xl">
        {children}
      </p>
      {source ? (
        <p className="mt-3 font-mono text-xs uppercase tracking-wider text-background/50">
          {source}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A rate expressed against the field, which is the form people can actually
 * read. "37.6%" is a number; "12.5x the field" is a finding. The multiple is
 * computed here from the two rates so it can never drift from them.
 */
export function BaselineMultiple({
  rate,
  baseline,
  className,
}: {
  rate: number;
  baseline: number;
  className?: string;
}) {
  if (baseline <= 0) return null;
  const x = rate / baseline;
  // Below 10x, one decimal carries real information; above it, it is noise.
  const label = x >= 10 ? `${Math.round(x)}x` : `${x.toFixed(1)}x`;
  const direction: Direction = x >= 2 ? "bad" : x >= 1.2 ? "warn" : "good";
  return (
    <span
      className={cn(
        "inline-flex items-center border px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums",
        direction === "bad"
          ? "border-[var(--data-bad)] text-[var(--data-bad-ink)]"
          : direction === "warn"
            ? "border-[var(--data-warn)] text-[var(--data-warn-ink)]"
            : "border-primary text-foreground",
        className,
      )}
      title={`${rate.toFixed(2)}% against a field baseline of ${baseline.toFixed(2)}%`}
    >
      {label} the field
    </span>
  );
}

export interface Freshness {
  label: string;
  /** Human date or relative phrase. Never invent one; omit the dot instead. */
  asOf: string;
  /** live = refreshed on a schedule; window = a published quarter. */
  kind: "live" | "window";
}

/**
 * Provenance dots. Two sources with different cadences run this product, and
 * a reader who cannot tell them apart cannot judge any figure on the page.
 * Showing both, always, is cheap and it is the whole trust argument.
 */
export function FreshnessDots({ items }: { items: Freshness[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      {items.map((f) => (
        <span key={f.label} className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              f.kind === "live" ? "bg-primary" : "bg-[var(--data-none)]",
            )}
          />
          <span className="font-mono text-xs uppercase tracking-wider text-foreground/60">
            {f.label}: {f.asOf}
          </span>
        </span>
      ))}
    </div>
  );
}
