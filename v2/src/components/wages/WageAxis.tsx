import { tickAnchor } from "@/components/tools/chartTicks";
import { moneyShort } from "@/lib/wageLadder";
import { cn } from "@/lib/utils";

/**
 * The shared wage axis under a set of ladders.
 *
 * Ticks land on round dollars rather than on evenly divided domain, because a
 * reader checks an offer against $100,000 and never against $103,441. The
 * SPACING is still even, since `niceStep` picks one interval for the whole
 * axis.
 *
 * The anchoring comes from chartTicks.tickAnchor, which the SVG charts on this
 * site already use. Same rule, different rendering: a label centred on the last
 * tick sits inside the track by its anchor point and past the edge by its box,
 * so the ends turn inward. That was found on an SVG axis and it is exactly as
 * true of an absolutely positioned span.
 */

/**
 * The finest step this axis can express.
 *
 * `moneyShort` rounds to thousands, so a step below $1,000 puts two ticks at
 * two positions under one label. A narrow domain then draws five ticks all
 * reading "$100k", which looks like a rendering bug and is arithmetic doing
 * exactly what it was asked. An axis must not offer a distinction its own
 * formatter cannot show.
 */
export const MIN_AXIS_STEP = 1_000;

/** 1, 2 or 5 times a power of ten, whichever gives near `target` ticks. */
export function niceStep(span: number, target = 5, min = MIN_AXIS_STEP): number {
  if (span <= 0) return min;
  const raw = span / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5]) {
    if (raw <= m * mag) return Math.max(min, m * mag);
  }
  return Math.max(min, 10 * mag);
}

/**
 * Round tick values inside the domain, ends included where they fall on one.
 *
 * An empty result is a real answer: a domain narrower than one step holds no
 * round figure, and drawing nothing is better than drawing a label that does
 * not describe where it sits.
 */
export function axisTicks(domain: [number, number], target = 5): number[] {
  const [lo, hi] = domain;
  const step = niceStep(hi - lo, target);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

const ANCHOR_CLASS = {
  start: "translate-x-0 text-left",
  middle: "-translate-x-1/2 text-center",
  end: "-translate-x-full text-right",
} as const;

export function WageAxis({
  domain,
  ticks = 5,
  className,
}: {
  domain: [number, number];
  ticks?: number;
  className?: string;
}) {
  const values = axisTicks(domain, ticks);
  if (values.length === 0) return null;
  const [lo, hi] = domain;
  const at = (v: number) => ((v - lo) / Math.max(1, hi - lo)) * 100;
  return (
    <div className={cn("relative h-9 w-full border-t-2 border-border", className)}>
      {values.map((v, i) => {
        const anchor = tickAnchor(i, values.length);
        return (
          <span key={v} className="contents">
            <span
              aria-hidden="true"
              className="absolute top-0 h-2 w-px bg-border"
              style={{ left: `${at(v)}%` }}
            />
            <span
              className={cn(
                "absolute top-3 font-mono text-xs font-bold tabular-nums text-foreground/60",
                ANCHOR_CLASS[anchor],
              )}
              style={{ left: `${at(v)}%` }}
            >
              {moneyShort(v)}
            </span>
          </span>
        );
      })}
    </div>
  );
}
