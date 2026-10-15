import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The interpretation layer: say what the number MEANS, above the number.
 *
 * A table that leaves the reader to do the arithmetic is half an answer. A
 * page should open with the conclusion its figures support, such as "DOL is
 * deciding PERM cases filed in September 2025".
 *
 * Everything here is a shape for a claim that is TRUE BY CONSTRUCTION:
 * arithmetic on figures already on the page. No projections, no scores, no
 * modelled probabilities. A verdict we cannot derive is a verdict we do not
 * ship.
 */

type Direction = "good" | "warn" | "bad" | "flat";

/** The dot carries the direction; the label stays on the surface's own ink. */
const DIRECTION_DOT: Record<Direction, string> = {
  good: "bg-data-good-ink",
  warn: "bg-data-warn-ink",
  bad: "bg-data-bad-ink",
  flat: "bg-muted-foreground",
};

/**
 * A verdict chip: a quiet label with a coloured dot, read before the figure it
 * describes ("Pending", then the sentence). The word carries the meaning; the
 * dot only repeats it, so nothing rests on colour. The chip is a card on
 * whatever it sits on, and the dot uses the `-ink` tokens, which clear 3:1 on
 * a card in both themes.
 */
export function Verdict({
  direction = "flat",
  children,
}: {
  direction?: Direction;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 bg-tint px-2.5 py-1 text-sm font-semibold text-foreground">
      <span aria-hidden="true" className={cn("size-2.5 shrink-0", DIRECTION_DOT[direction])} />{" "}
      {children}
    </span>
  );
}

/**
 * The answer block: the one tinted panel on a page, holding the fact the page
 * exists to give and the one thing to do next.
 *
 * Everything above `actions` is a claim TRUE BY CONSTRUCTION, arithmetic on
 * figures already on the page. A verdict we cannot derive is a verdict we do
 * not ship. The source line says where the figures came from, under them.
 */
export function AnswerPanel({
  verdict,
  direction,
  label,
  children,
  source,
  picture,
  actions,
  className,
}: {
  verdict?: string;
  direction?: Direction;
  /** Beside the chip: what the answer is about (a case number, a month). */
  label?: ReactNode;
  children: ReactNode;
  source?: ReactNode;
  /** A picture of the answer, under the claim (the queue with the case on it). */
  picture?: ReactNode;
  /** What to do next, under the claim and above the source line. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    // `data-answer` marks a page's answer for the article picture captures.
    // An object: the one thing on the page meant to be read first.
    <section data-answer className={cn("object p-5 text-foreground sm:p-8", className)}>
      {verdict || label ? (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          {verdict ? <Verdict direction={direction}>{verdict}</Verdict> : null}{" "}
          {label ? <span className="font-mono text-sm text-soft">{label}</span> : null}
        </div>
      ) : null}
      <p className="max-w-3xl text-lg leading-relaxed text-foreground sm:text-xl">{children}</p>{" "}
      {picture ? <div className="mt-6">{picture}</div> : null}{" "}
      {actions ?? null}{" "}
      {source ? <p className="mt-5 text-sm text-muted-foreground">{source}</p> : null}
    </section>
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
  withTitle = true,
}: {
  rate: number;
  baseline: number;
  className?: string;
  /** Off inside a chart whose hover tooltip already carries both rates. */
  withTitle?: boolean;
}) {
  if (baseline <= 0) return null;
  const x = rate / baseline;
  // Below 10x, one decimal carries real information; above it, it is noise.
  const label = x >= 10 ? `${Math.round(x)}x` : `${x.toFixed(1)}x`;
  const direction: Direction = x >= 2 ? "bad" : x >= 1.2 ? "warn" : "good";
  return (
    <span
      className={cn(
        "inline-flex items-center border px-1.5 py-0.5 text-sm font-bold tabular-nums",
        direction === "bad"
          ? "border-[var(--data-bad)] text-[var(--data-bad-ink)]"
          : direction === "warn"
            ? "border-[var(--data-warn)] text-[var(--data-warn-ink)]"
            : "border-primary text-foreground",
        className,
      )}
      title={withTitle ? `${rate.toFixed(2)}% against a field baseline of ${baseline.toFixed(2)}%` : undefined}
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
          <span className="text-sm text-muted-foreground">
            {f.label}: {f.asOf}
          </span>
        </span>
      ))}
    </div>
  );
}
