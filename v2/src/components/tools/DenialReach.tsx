"use client";

import { Fragment, useMemo } from "react";

import { DataView } from "./DataView";

/**
 * Rate against reach: the half of a denial factor every risk tool leaves out.
 *
 * A ranking by denial rate says a part-time position is the riskiest thing in
 * DOL's files, at 54%. It is also the rarest: 396 decided cases out of
 * 355,130, and 215 denials out of 11,357. Read the rate alone and you would
 * spend your attention on a factor that explains 1.9% of denials. The three
 * questions the ETA-9089 asks about, which are the three factors a "risk
 * score" is built from, together account for 4.8% of them.
 *
 * Meanwhile the offered wage, which no risk tool leads with, sorts the pile:
 * jobs under $60,000 are 31.7% of decided cases and 51.6% of all denials.
 *
 * Both facts are true and neither is the whole picture, which is why they are
 * drawn side by side and never combined. Multiplying a rate by a prevalence
 * to get "expected denials" would produce one number that reads as a
 * prediction, which this page exists not to publish.
 *
 * TWO SERIES, TWO TREATMENTS, NOT TWO OPACITIES. The bars mean opposite
 * things when they differ: taller-solid than outline is a factor
 * over-represented among denials, the reverse is under-represented. A pair
 * separated only by alpha would get one caption and be read as one thing, so
 * reach is an outlined bar and denials are a solid one, and each carries its
 * own label.
 */

export interface ReachRow {
  label: string;
  /** Optional one-line explanation of the bucket. */
  note?: string;
  decided: number;
  denied: number;
}

export interface DenialReachProps {
  rows: ReachRow[];
  /** Every decided case in the corpus, the denominator for reach. */
  totalDecided: number;
  /** Every denial in the corpus, the denominator for the share of denials. */
  totalDenied: number;
  label: string;
  unitLabel: string;
  caption: string;
  className?: string;
}

interface Computed extends ReachRow {
  reach: number;
  share: number;
}

function pct(n: number): string {
  return n >= 10 ? `${n.toFixed(0)}%` : `${n.toFixed(1)}%`;
}

function int(n: number): string {
  return n.toLocaleString("en-US");
}

export function DenialReach({
  rows,
  totalDecided,
  totalDenied,
  label,
  unitLabel,
  caption,
  className,
}: DenialReachProps) {
  const computed = useMemo<Computed[]>(
    () =>
      rows.map((r) => ({
        ...r,
        reach: totalDecided > 0 ? (r.decided / totalDecided) * 100 : 0,
        share: totalDenied > 0 ? (r.denied / totalDenied) * 100 : 0,
      })),
    [rows, totalDecided, totalDenied],
  );

  // Scale both series against the same maximum or the comparison is a lie.
  const max = Math.max(1, ...computed.map((c) => Math.max(c.reach, c.share)));

  const chart = (
    <div>
      <ul className="space-y-5">
        {/* Array items render with nothing between them, so the last line of
            one row reaches an extractor glued to the next row's label. A
            whitespace-only text node is not laid out as a list item. */}
        {computed.map((c) => (
          <Fragment key={c.label}>
            {" "}
            <li>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-bold">{c.label}</p>{" "}
              <p className="font-mono text-sm tabular-nums text-foreground/70">
                {int(c.denied)} of {int(c.decided)} denied
              </p>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="h-4 min-w-0 flex-1">
                  <div
                    className="h-full border-2 border-border bg-background"
                    style={{ width: `${(c.reach / max) * 100}%` }}
                    role="img"
                    aria-label={`${pct(c.reach)} of all decided cases`}
                  />
                </div>
                <p className="w-32 shrink-0 font-mono text-xs tabular-nums text-foreground/70">
                  {pct(c.reach)} of cases
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 min-w-0 flex-1">
                  <div
                    className="h-full border-2 border-border bg-data-good-ink"
                    style={{ width: `${(c.share / max) * 100}%` }}
                    role="img"
                    aria-label={`${pct(c.share)} of all denials`}
                  />
                </div>
                <p className="w-32 shrink-0 font-mono text-xs font-bold tabular-nums">
                  {pct(c.share)} of denials
                </p>
              </div>
            </div>
            {c.note ? (
              <p className="mt-2 text-sm leading-snug text-foreground/60">{c.note}</p>
            ) : null}
            </li>
          </Fragment>
        ))}
      </ul>{" "}
      <p className="mt-6 text-sm leading-relaxed text-foreground/60">
        The outlined bar is the {unitLabel.toLowerCase()}&apos;s share of every
        decided case. The solid bar is its share of every denial. A solid bar
        longer than its outline means denials land there more often than case
        volume alone would put them.
      </p>
    </div>
  );

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full border-2 border-border text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-foreground text-background">
          <tr>
            <th scope="col" className="p-3 font-mono text-xs font-bold uppercase tracking-wider">
              {unitLabel}
            {" "}</th>
            <th scope="col" className="p-3 text-right font-mono text-xs font-bold uppercase tracking-wider">
              Decided
            {" "}</th>
            <th scope="col" className="p-3 text-right font-mono text-xs font-bold uppercase tracking-wider">
              Denied
            {" "}</th>
            <th scope="col" className="p-3 text-right font-mono text-xs font-bold uppercase tracking-wider">
              Share of cases
            {" "}</th>
            <th scope="col" className="p-3 text-right font-mono text-xs font-bold uppercase tracking-wider">
              Share of denials
            </th>
          </tr>
        </thead>
        <tbody className="bg-card">
          {computed.map((c) => (
            <tr key={c.label} className="border-t border-border/40">
              <td className="p-3 font-bold">{c.label}{" "}</td>
              <td className="p-3 text-right tabular-nums">{int(c.decided)}{" "}</td>
              <td className="p-3 text-right tabular-nums">{int(c.denied)}{" "}</td>
              <td className="p-3 text-right tabular-nums">{pct(c.reach)}{" "}</td>
              <td className="p-3 text-right font-bold tabular-nums">{pct(c.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <DataView
      label={label}
      chartLabel="Bars"
      tableLabel="Figures"
      chart={chart}
      table={table}
      className={className}
    />
  );
}
