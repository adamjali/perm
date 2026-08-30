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

/**
 * EVERY ENTRY SETS ITS OWN `text-`, and that is the whole fix.
 *
 * The block that stood here argued the exact opposite - "NO TEXT COLOUR HERE,
 * DELIBERATELY, the badge INHERITS from whatever it sits on" - and it was
 * wrong in a way worth recording, because it reads as a considered decision.
 * Inheriting is only safe when every surface the component can land on shares
 * a foreground. This one lands on an INVERTED panel and on ordinary cards, and
 * those two have opposite foregrounds, so inheriting guarantees it is wrong on
 * one of them. The comment even named the failure it was causing.
 *
 * These set a background and a border and inherited their text colour, which
 * is only safe while the chip sits on a surface whose foreground happens to
 * suit. `Insight` is an INVERTED panel - `bg-foreground text-background` - so
 * the chip inherited the panel's near-white ink and painted it on its own
 * translucent tint. Measured on /perm-rfi-audit before this change, with the
 * browser's own computed values:
 *
 *   light   rgb(250,250,250) on rgb(250,250,250)   1.00:1
 *   dark    rgb(10,10,10)    on rgb(26,26,26)      1.14:1
 *
 * Adam: "cant see that text 965 open rfis in light or dark mode." Invisible in
 * both, which is what an inherited colour does when the two surfaces it might
 * land on are inverses of each other.
 *
 * The backgrounds are solid rather than translucent for the same reason: a
 * tint composites against whatever is behind it, so its contrast is a property
 * of the parent rather than of this component. A solid pair can be measured
 * once and stays true wherever the chip is used.
 *
 * THE FILL CANNOT CARRY THE COLOUR, and measuring the tokens is what settled
 * it. A first pass filled each chip with its own `-ink` token and pinned a
 * fixed text colour on top. That works in one theme and cannot work in both,
 * because the `-ink` tokens INVERT between them:
 *
 *   --data-bad-ink    light #b3271a (white 6.52, black 3.22)
 *                     dark  #f87171 (white 2.77, black 7.59)
 *   --data-warn-ink   light #b45309 (white 5.02) / dark #fbbf24 (black 12.58)
 *
 * So white passes in light and fails at 2.77:1 in dark, which is exactly what
 * the re-measurement caught on /perm-denial-risk after the "fix". Only
 * `--primary` holds still (#2ecc40 in both, black 9.83), which is why the
 * lime chip was the one that survived.
 *
 * The chip therefore keeps a `bg-card` / `text-foreground` pair - two tokens
 * designed to flip TOGETHER, so the label is legible in either theme by
 * construction and not by a lucky pairing - and carries its meaning in the
 * BORDER and the mark, both of which use the `-ink` variants that exist
 * precisely to be readable against a card.
 */
const DIRECTION_STYLE: Record<Direction, string> = {
  good: "border-primary bg-card text-foreground",
  warn: "border-[var(--data-warn-ink)] bg-card text-foreground",
  bad: "border-[var(--data-bad-ink)] bg-card text-foreground",
  flat: "border-border bg-card text-foreground",
};

/** The mark carries the direction's colour; the label stays on the safe pair. */
const DIRECTION_INK: Record<Direction, string> = {
  good: "text-[var(--data-good-ink)]",
  warn: "text-[var(--data-warn-ink)]",
  bad: "text-[var(--data-bad-ink)]",
  flat: "text-foreground/60",
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
      <span aria-hidden="true" className={DIRECTION_INK[direction]}>
        {DIRECTION_MARK[direction]}
      </span>{" "}
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
      {/* /70, not /50. Measured on this panel in dark mode: the source line
          came out at 3.71:1 against a 4.5 floor, which is a dateline nobody
          can read on the one component whose whole job is saying where the
          figures came from. Tracked caps at 12px are already the hardest thing
          on the page to read, and a half-opacity ink on top of that is three
          legibility taxes at once.

          The comment sits HERE rather than inside the ternary: the first
          position after `? (` is an expression, not JSX children, so a JSX
          comment there parses as an object literal and takes the build down.
          Writing that rule out cost a second build, because spelling the
          comment delimiters literally inside a comment closes it early. */}
      {source ? (
        <p className="mt-3 font-mono text-xs uppercase tracking-wider text-background/70">
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
