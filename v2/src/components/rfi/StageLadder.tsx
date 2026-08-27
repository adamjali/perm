import { Fragment, type ReactNode } from "react";

import type { ReviewStage } from "@/lib/turso/rfi";
import { GROUP_STYLE, stageMeta } from "./stageMeta";

/**
 * Where each stage sits in a case's life, on a real axis of days since filing.
 *
 * THIS IS THE PAGE'S ARGUMENT, DRAWN. The stages are not a menu of things that
 * might happen to you at any moment. They are strictly ordered by case age,
 * and the order is the same every time you measure it: analyst review around
 * 167 days, holds around 181, RFIs around 372, appeals past 650. An RFI is not
 * a random event during the wait. It arrives at the point DOL reaches your
 * case, which is why the RFI band sits on top of DOL's own published
 * analyst-review average rather than near it.
 *
 * BUILT IN CSS GRID, NOT SVG, and that is a decision rather than a shortcut.
 * SVG text scales with the viewBox, so 13px in a 720-unit drawing renders at
 * 5.5px in a phone column, and every label then needs collision solving,
 * halos and inward anchoring. Here the labels are ordinary HTML in their own
 * grid column: they wrap, they scale with the reader's font size, they are
 * selectable, and no solver can fail on them. Only the bands are positioned,
 * and a band is a rectangle, which is the one thing percentages do perfectly.
 */

export interface StageLadderProps {
  stages: ReviewStage[];
  /** A published figure to mark on the same axis, in days. */
  marker?: { days: number; label: string } | null;
}

/** Round the axis up to a clean hundred so the ticks land on round numbers. */
function axisMax(stages: ReviewStage[], marker: number | null): number {
  const ends = stages.map((s) => s.ageBand?.p90 ?? 0);
  if (marker !== null) ends.push(marker);
  const max = Math.max(0, ...ends);
  return Math.max(200, Math.ceil((max * 1.04) / 100) * 100);
}

export function StageLadder({ stages, marker = null }: StageLadderProps) {
  const drawn = stages.filter((s) => s.ageBand !== null);
  if (drawn.length === 0) return null;

  const max = axisMax(drawn, marker?.days ?? null);
  const pct = (d: number) => `${(d / max) * 100}%`;
  const ticks = Array.from({ length: max / 100 + 1 }, (_, i) => i * 100);
  const ordered = [...drawn].sort(
    (a, b) => (a.ageBand?.median ?? 0) - (b.ageBand?.median ?? 0),
  );

  return (
    <figure className="m-0">
      {/*
        The whole drawing scrolls as one piece below ~560px rather than
        squeezing. A 700-day axis compressed into a 300px column puts the
        analyst-review and hold bands on top of each other, which is the one
        comparison the chart exists to make.
      */}
      <div className="overflow-x-auto">
        <div className="min-w-[34rem]">
          {ordered.map((s) => {
            const band = s.ageBand;
            if (!band) return null;
            const meta = stageMeta(s.status);
            const style = GROUP_STYLE[meta.group];
            return (
              // Keyed Fragment with a real space. React renders array items
              // with NOTHING between them, so a separator has to be part of
              // each iteration or every stage name glues to the next.
              <Fragment key={s.status}>{" "}
              <div className="grid grid-cols-[10.5rem_1fr] items-center gap-3 border-b border-border/25 py-2.5 last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate font-heading text-sm font-bold leading-tight">
                    {meta.label}
                  </div>{" "}
                  <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {s.cases.toLocaleString()} cases
                  </div>
                </div>{" "}
                <div className="relative h-8">
                  <Rails ticks={ticks} pct={pct} />
                  {/*
                    The band is the 10th to 90th percentile and the notch is
                    the median. Three numbers in one shape: how old these cases
                    are, and how tightly they cluster. RFIs span 341 to 424
                    days, six weeks wide over a two-year process, which is the
                    whole reason to draw a band rather than a dot.
                  */}
                  <div
                    className="absolute top-1/2 h-4 -translate-y-1/2 border-2 border-border"
                    style={{
                      left: pct(band.p10),
                      width: pct(Math.max(1, band.p90 - band.p10)),
                      backgroundColor: style.fill,
                    }}
                  />
                  <div
                    className="absolute top-1/2 h-6 w-[3px] -translate-y-1/2 bg-border"
                    style={{ left: pct(band.median) }}
                    aria-hidden="true"
                  />
                  <span className="sr-only">
                    Middle 80% of cases are {band.p10} to {band.p90} days past
                    filing, median {band.median} days.
                  </span>
                </div>
              </div>
              </Fragment>
            );
          })}

          {marker ? (
            <Marker marker={marker} pct={pct} flip={marker.days > max / 2} />
          ) : null}

          <div className="grid grid-cols-[10.5rem_1fr] gap-3 pt-2">
            <div />{" "}
            <div className="relative h-5">
              {ticks.map((t, i) => (
                <Fragment key={t}>{" "}
                <span
                  className="absolute top-0 font-mono text-[11px] tabular-nums text-muted-foreground"
                  style={{
                    left: pct(t),
                    // The last tick sits at 100% and would run past the
                    // drawing by its own width. Anchoring the ends inward is
                    // the same fix the chart-tick helper makes for SVG, and it
                    // is needed here for the same reason: being inside by your
                    // anchor point is not being inside by your box.
                    transform:
                      i === ticks.length - 1
                        ? "translateX(-100%)"
                        : i === 0
                          ? "none"
                          : "translateX(-50%)",
                  }}
                >
                  {t === 0 ? "Filed" : t}
                </span>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        Days between filing and the day we observed the case at that stage. The
        bar covers the middle 80% of cases, the notch is the median.
      </figcaption>
    </figure>
  );
}

/** Hairlines at each 100-day tick, so a band can be read against the axis. */
function Rails({
  ticks,
  pct,
}: {
  ticks: number[];
  pct: (d: number) => string;
}): ReactNode {
  return (
    <>
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute inset-y-0 w-px bg-border/15"
          style={{ left: pct(t) }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

/**
 * DOL's own published figure, on the same axis as the measurements.
 *
 * THE RULE AND ITS LABEL SHARE ONE COORDINATE. The deadline diagram on this
 * site drew a rail at one date and printed its label at a fixed right-hand
 * inset, so whenever the two did not coincide the label sat 204 units from the
 * date it named, under a different date entirely. A line and its label are one
 * object. Both read `left` from the same `pct(marker.days)`.
 */
function Marker({
  marker,
  pct,
  flip,
}: {
  marker: { days: number; label: string };
  pct: (d: number) => string;
  /** Hang the label to the LEFT of the rule, for a marker past the midpoint. */
  flip: boolean;
}) {
  return (
    <div className="grid grid-cols-[10.5rem_1fr] gap-3">
      <div />{" "}
      <div className="relative h-9">
        <div
          className="absolute inset-y-0 w-[2px] bg-[var(--primary-text)]"
          style={{ left: pct(marker.days) }}
          aria-hidden="true"
        />
        {/*
          `text-primary` rather than `text-primary-text`: globals.css
          redefines the former to the accessible green (4.53:1 on paper, where
          the brand lime is 2.05:1), and `--color-primary-text` is not in the
          @theme block, so `text-primary-text` compiles to nothing at all.
        */}
        <span
          className="absolute top-1 max-w-[15rem] font-mono text-[11px] font-bold leading-tight text-primary"
          style={{
            left: pct(marker.days),
            transform: flip ? "translateX(-100%)" : "none",
            paddingRight: flip ? "0.45rem" : undefined,
            paddingLeft: flip ? undefined : "0.45rem",
          }}
        >
          {marker.label}
        </span>
      </div>
    </div>
  );
}

/**
 * The same numbers as a table, always in the served HTML.
 *
 * Not a fallback and not lazy-loaded. A crawler, an assistant reading the
 * page, and a reader with the chart open all get one copy of the figures.
 */
export function StageLadderTable({ stages }: { stages: ReviewStage[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-border text-left font-mono text-[11px] uppercase tracking-wider">
            {/*
              THE SPACE GOES INSIDE THE CELL, NOT BETWEEN CELLS. A
              whitespace-only text node is not legal as a child of <tbody> or
              <tr>: React warns "this will cause a hydration error" and the
              parser moves the node out of the table. So the separator that
              stops "StageCasesMedian day" reaching an extractor has to live
              inside the cell's own content.
            */}
            <th className="py-2 pr-3 font-bold">Stage </th>
            <th className="py-2 pr-3 text-right font-bold">Cases </th>
            <th className="py-2 pr-3 text-right font-bold">Median day </th>
            <th className="py-2 pr-3 text-right font-bold">Middle 80% </th>
            <th className="py-2 text-right font-bold">Employer names </th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => {
            const meta = stageMeta(s.status);
            const band = s.ageBand;
            return (
              <tr key={s.status} className="border-b border-border/25">
                <td className="py-2 pr-3">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 border border-border align-middle"
                    style={{ backgroundColor: GROUP_STYLE[meta.group].fill }}
                    aria-hidden="true"
                  />{" "}
                  {meta.label}{" "}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {s.cases.toLocaleString()}{" "}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {band ? band.median.toLocaleString() : withheld()}{" "}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {band
                    ? `${band.p10.toLocaleString()} to ${band.p90.toLocaleString()}`
                    : withheld()}{" "}
                </td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {s.employerNames.toLocaleString()}{" "}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * What an unmeasurable cell says.
 *
 * Not a dash and not a zero. A dash reads as "nothing here" and a zero reads
 * as a measurement of zero; both are claims. This says the figure is absent
 * and the caption underneath says why.
 */
function withheld(): ReactNode {
  return (
    <span className="text-muted-foreground" title="Too few cases to measure">
      not shown
    </span>
  );
}
