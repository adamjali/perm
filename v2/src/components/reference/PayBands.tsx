import type { ReactNode } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { WageAxis } from "@/components/wages/WageAxis";
import { formatDollars } from "@/lib/format";
import { moneyShort } from "@/lib/wageLadder";
import { cn } from "@/lib/utils";

/**
 * What a job pays in the market, with DOL's four prevailing wage levels on the
 * same line.
 *
 * Each row is one area's BLS spread (OEWS: 10th to 90th percentile, the middle
 * half as a block, the median as the tall tick), drawn in the same geometry as
 * the site's PERM wage ladders so the two read alike. Under it, four short
 * ticks are DOL's Levels I to IV for that area, always rising left to right,
 * so they need no labels on the track; the exact figures are in the tooltip
 * and in the table that follows the figure. A PERM median, where given, is the
 * marker above the line.
 *
 * Plain positioned HTML, not SVG, for the reason WageLadderRow gives: text in a
 * viewBox shrinks with it on a phone, percentages reflow for free.
 */

export interface PayBand {
  key: string;
  label: ReactNode;
  sub?: ReactNode;
  tipLabel: string;
  p10: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  p90: number | null;
  /** Yearly, Level I to IV, or null where DOL publishes none for this area. */
  levels?: (number | null)[] | null;
  /** A PERM median to mark above the line. */
  perm?: number | null;
}

const pct = (v: number, [lo, hi]: [number, number]) => Math.min(100, Math.max(0, ((v - lo) / Math.max(1, hi - lo)) * 100));

/** One shared domain for every row, padded so no mark sits on the frame. */
export function bandDomain(bands: PayBand[]): [number, number] | null {
  const vals = bands.flatMap((b) => [b.p10, b.p90, b.perm ?? null, ...(b.levels ?? [])]).filter((v): v is number => v != null && v > 0);
  if (!vals.length) return null;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.04 || 1000;
  return [Math.max(0, Math.floor((lo - pad) / 1000) * 1000), Math.ceil((hi + pad) / 1000) * 1000];
}

/** The share of a shared axis the narrowest row may take before it's unreadable. */
export const MIN_ROW_SHARE = 0.12;

/**
 * Whether every row stays readable on one shared axis.
 *
 * One job in several areas reads best on one scale. Several jobs in one area
 * can differ tenfold (food servers near $30k, pilots near $360k), and on one
 * scale the cheaper rows shrink to a sliver; then each row gets its own.
 */
export function sharedScaleFits(bands: PayBand[]): boolean {
  const shared = bandDomain(bands);
  if (!shared) return true;
  const span = shared[1] - shared[0];
  return bands.every((b) => {
    const own = bandDomain([b]);
    return !own || (own[1] - own[0]) / span >= MIN_ROW_SHARE;
  });
}

function tip(b: PayBand): string {
  const lines = [b.tipLabel];
  const add = (k: string, v: number | null | undefined) => v != null && lines.push(`${k}: ${formatDollars(v)}`);
  add("10th percentile", b.p10);
  add("Median", b.median);
  add("90th percentile", b.p90);
  (b.levels ?? []).forEach((v, i) => add(`DOL Level ${["I", "II", "III", "IV"][i]}`, v));
  add("PERM offers, median", b.perm);
  return lines.join("\n");
}

function Track({ band, domain, ends }: { band: PayBand; domain: [number, number]; ends?: boolean }) {
  const complete = band.p10 != null && band.p25 != null && band.median != null && band.p75 != null && band.p90 != null;
  return (
    <div
      className={cn("relative w-full", ends ? "h-[4.25rem]" : "h-12")}
      data-tip={tip(band)}
      role="img"
      aria-label={tip(band).replace(/\n/g, "; ")}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-5 h-px bg-border" />
      {complete ? (
        <>
          <span
            aria-hidden="true"
            className="absolute top-5 h-[3px] -translate-y-1/2 bg-foreground/45"
            style={{ left: `${pct(band.p10!, domain)}%`, width: `${pct(band.p90!, domain) - pct(band.p10!, domain)}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute top-5 h-4 -translate-y-1/2 border-2 border-border bg-data-good-ink"
            style={{ left: `${pct(band.p25!, domain)}%`, width: `${pct(band.p75!, domain) - pct(band.p25!, domain)}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute top-5 h-6 w-[3px] -translate-x-1/2 -translate-y-1/2 bg-foreground"
            style={{ left: `${pct(band.median!, domain)}%` }}
          />
        </>
      ) : band.median != null ? (
        <span
          aria-hidden="true"
          className="absolute top-5 h-6 w-[3px] -translate-x-1/2 -translate-y-1/2 bg-foreground"
          style={{ left: `${pct(band.median, domain)}%` }}
        />
      ) : null}
      {(band.levels ?? []).map((v, i) =>
        v == null ? null : (
          <span
            key={i}
            aria-hidden="true"
            className="absolute top-8 h-3 w-0.5 -translate-x-1/2 bg-foreground"
            style={{ left: `${pct(v, domain)}%` }}
          />
        ),
      )}
      {band.perm != null ? (
        <span
          aria-hidden="true"
          className="absolute top-0 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-data-good-ink"
          style={{ left: `${pct(band.perm, domain)}%` }}
        />
      ) : null}
      {ends ? (
        <>
          <span aria-hidden="true" className="absolute left-0 top-12 font-mono text-sm tabular-nums text-foreground/70">
            {moneyShort(domain[0])}
          </span>{" "}
          <span aria-hidden="true" className="absolute right-0 top-12 font-mono text-sm tabular-nums text-foreground/70">
            {moneyShort(domain[1])}
          </span>{" "}
        </>
      ) : null}
    </div>
  );
}

export function PayBands({
  bands,
  label,
  className,
  scale = "shared",
}: {
  bands: PayBand[];
  label: string;
  className?: string;
  /** "auto" gives each row its own scale when one shared axis would crush a row. */
  scale?: "shared" | "auto";
}) {
  const domain = bandDomain(bands);
  if (!domain || !bands.length) return null;
  const perRow = scale === "auto" && !sharedScaleFits(bands);
  const anyLevels = bands.some((b) => (b.levels ?? []).some((v) => v != null));
  const anyPerm = bands.some((b) => b.perm != null);
  return (
    <div className={className}>
      <ChartTips label={label}>
        <ul className="space-y-3">
          {bands.map((b) => (
            <li key={b.key} className="grid grid-cols-1 gap-1 sm:grid-cols-[13rem_1fr] sm:items-center sm:gap-4 [&>*]:min-w-0">
              <div className="min-w-0">
                <div className="truncate text-base font-bold">{b.label}</div>
                {b.sub ? <div className="truncate text-sm text-foreground/70">{b.sub}</div> : null}
              </div>{" "}
              <Track band={b} domain={perRow ? (bandDomain([b]) ?? domain) : domain} ends={perRow} />
            </li>
          ))}
        </ul>
      </ChartTips>
      {perRow ? (
        <p className="mt-2 text-sm text-foreground/70">
          Each row has its own scale, marked at its ends: these jobs pay too differently to share one. The table
          compares them.
        </p>
      ) : (
        <div className="mt-1 sm:ml-[14rem]">
          <WageAxis domain={domain} />
        </div>
      )}
      <ul className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground/70">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-4 w-8 border-2 border-border bg-data-good-ink" /> middle
          half of pay (BLS)
        </li>{" "}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-5 w-[3px] bg-foreground" /> median
        </li>{" "}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-[3px] w-8 bg-foreground/45" /> 10th to 90th percentile
        </li>{" "}
        {anyLevels ? (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-foreground" /> DOL&apos;s Levels I to IV, left
            to right
          </li>
        ) : null}{" "}
        {anyPerm ? (
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn("inline-block h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-data-good-ink")}
            />{" "}
            median PERM offer
          </li>
        ) : null}
      </ul>
    </div>
  );
}
