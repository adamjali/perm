"use client";

import { Fragment, useId, useMemo, useState } from "react";

import { Label } from "@/components/ui";
import { ChartHoverLayer, type HoverPoint } from "@/components/tools/ChartHoverLayer";
import {
  PREFERENCE_OF,
  isPreference,
  quartersFor,
  totalsFor,
  type TrendRow,
} from "@/lib/i140Trends";
import { cn } from "@/lib/utils";

/**
 * USCIS's quarterly I-140 counts, by category.
 *
 * THREE DIFFERENT SHAPES FOR THREE DIFFERENT QUESTIONS, deliberately. Volume
 * over time is a bar per quarter; the split between approvals and denials is
 * one stacked track, because the comparison is within each quarter rather
 * than across them; the denial rate is a line, because a rate is a trajectory
 * and drawing it as bars invites reading its height as a quantity. Three
 * copies of the same bar chart would be the lazy answer.
 */

export interface I140TrendsProps {
  rows: readonly TrendRow[];
}

const int = (n: number) => n.toLocaleString("en-US");
const pct = (n: number | null) => (n === null ? "n/a" : `${n.toFixed(2)}%`);

export function I140Trends({ rows }: I140TrendsProps) {
  const selectId = useId();

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.category)) seen.set(r.category, r.categoryLabel);
    const all = [...seen.entries()].map(([value, label]) => ({ value, label }));
    return {
      preferences: all.filter((c) => isPreference(c.value)),
      subtypes: all.filter((c) => !isPreference(c.value)),
    };
  }, [rows]);

  const [category, setCategory] = useState("EB2");
  const points = useMemo(() => quartersFor(rows, category), [rows, category]);
  const totals = useMemo(() => totalsFor(points), [points]);
  const label =
    rows.find((r) => r.category === category)?.categoryLabel ?? category;

  /**
   * The subtypes of the selected preference, when it has any.
   *
   * `PREFERENCE_OF` already knows the hierarchy and the lib's own field note
   * already says to keep E-21 and NIW apart on the page. They ARE apart: they
   * are two entries in one dropdown. Nothing puts them next to each other, so
   * reading the largest difference in this dataset takes two selections and a
   * memory of the first, and a reader who does not already know to look never
   * finds it.
   */
  const split = useMemo(() => {
    if (!isPreference(category)) return null;
    const children = [...new Set(rows.map((r) => r.category))]
      .filter((c) => PREFERENCE_OF[c] === category)
      .map((c) => {
        const t = totalsFor(quartersFor(rows, c));
        return {
          code: c,
          label: rows.find((r) => r.category === c)?.categoryLabel ?? c,
          decided: t.approved + t.denied,
          denialRate: t.denialRate,
        };
      })
      .filter((c) => c.decided > 0 && c.denialRate !== null)
      .sort((a, z) => z.denialRate! - a.denialRate!);
    if (children.length < 2) return null;
    const hi = children[0]!;
    const lo = children[children.length - 1]!;
    return {
      children,
      hi,
      lo,
      // A ratio between two measured rates over two named populations, both
      // shown. Not a score, not a prediction, and never applied to a person.
      multiple: lo.denialRate! > 0 ? hi.denialRate! / lo.denialRate! : null,
      maxRate: Math.max(...children.map((c) => c.denialRate!)),
    };
  }, [rows, category]);

  const maxReceived = Math.max(1, ...points.map((p) => p.received));
  const maxDecided = Math.max(1, ...points.map((p) => p.approved + p.denied));

  return (
    <div className="border-2 border-border bg-card shadow-hard">
      <div className="border-b-2 border-border p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-black leading-tight">
          I-140 petitions, quarter by quarter
        </h2>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/70">
          USCIS&rsquo;s own figures, and its own category names.
        </p>

        {/* grid-cols-1 unprefixed and min-w-0 on the items: without a mobile
            column track a form control lands in a content-sized implicit
            column, which on WebKit is sized from the UA stylesheet and runs
            off the card. */}
        <div className="mt-6 grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:max-w-md">
          <div>
            <Label htmlFor={selectId} className="text-sm font-bold">
              Category
            </Label>
            <select
              id={selectId}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 block w-full min-w-0 min-h-[44px] border-2 border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {/* Grouped because the categories are a HIERARCHY: a preference
                  is the sum of its subtypes, so a flat list invites adding a
                  parent to its own children. */}
              <optgroup label="Preference (includes its subtypes)">
                {categories.preferences.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value} · {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Subtype">
                {categories.subtypes.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value} · {c.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <p className="mt-4 font-mono text-sm text-muted-foreground">
          {category} · {label} · {totals.quarters}{" "}
          {totals.quarters === 1 ? "quarter" : "quarters"} reported
        </p>
      </div>

      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap gap-3">
          {[
            { k: "Receipts", v: int(totals.received), n: "petitions filed across these quarters" },
            { k: "Approved", v: int(totals.approved), n: "across these quarters" },
            { k: "Denied", v: int(totals.denied), n: "across these quarters" },
            {
              k: "Pending",
              v: totals.pending === null ? "n/a" : int(totals.pending),
              n: "waiting at the newest quarter, not a sum",
            },
            { k: "Approval rate", v: pct(totals.approvalRate), n: "of petitions USCIS decided" },
            { k: "Denial rate", v: pct(totals.denialRate), n: "of petitions USCIS decided" },
          ].map((c) => (
            <div
              key={c.k}
              className="min-w-0 flex-1 basis-52 border-2 border-border bg-background p-4"
            >
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {c.k}
              </p>{" "}
              <p className="mt-1 font-heading text-2xl font-black leading-none tabular-nums">
                {c.v}
              </p>{" "}
              <p className="mt-1 text-sm text-foreground/70">{c.n}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-base leading-relaxed text-foreground/70">
          Both rates are over petitions USCIS actually{" "}
          <b className="font-bold text-foreground">decided</b>, not over
          receipts. A rate measured against receipts falls in a quarter where
          USCIS simply decided less, while nothing about the outcomes changed.
          Pending is a snapshot at the newest quarter for the same reason
          summing it would be wrong: it would count one waiting petition once
          per quarter.
        </p>

        {points.length > 0 ? (
          <>
            <section className="mt-10">
              <h3 className="font-heading text-xl font-black">Receipts per quarter</h3>{" "}
              <p className="mt-2 text-base text-foreground/70">
                Only quarters USCIS has reported.
              </p>
              <ol className="mt-4 space-y-1">
                {points.map((p) => (
                  <Fragment key={p.label}>
                    {" "}
                    <li
                      className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 [&>*]:min-w-0 sm:grid-cols-[7rem_1fr_5.5rem] sm:gap-3"
                      aria-label={`${p.label}: ${int(p.received)} received`}
                    >
                      <span className="text-sm tabular-nums text-foreground/70">{p.label}</span>{" "}
                      <span className="block h-6 w-full border-2 border-border bg-muted">
                        <span
                          className="block h-full bg-primary"
                          style={{ width: `${Math.max((p.received / maxReceived) * 100, 1)}%` }}
                        />
                      </span>{" "}
                      <span className="text-right text-sm tabular-nums text-foreground/70">
                        {int(p.received)}
                      </span>
                    </li>
                  </Fragment>
                ))}
              </ol>
            </section>

            <section className="mt-10">
              <h3 className="font-heading text-xl font-black">
                Approved against denied
              </h3>{" "}
              <p className="mt-2 text-base text-foreground/70">
                Bars are scaled to the busiest quarter, so a shorter track
                means fewer decisions rather than a different mix.
              </p>
              <ol className="mt-4 space-y-1">
                {points.map((p) => {
                  const decided = p.approved + p.denied;
                  const width = (decided / maxDecided) * 100;
                  const approvedShare = decided > 0 ? (p.approved / decided) * 100 : 0;
                  return (
                    <Fragment key={p.label}>
                      {" "}
                      <li
                        className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 [&>*]:min-w-0 sm:grid-cols-[7rem_1fr_5.5rem] sm:gap-3"
                        aria-label={`${p.label}: ${int(p.approved)} approved, ${int(p.denied)} denied`}
                      >
                        <span className="text-sm tabular-nums text-foreground/70">{p.label}</span>{" "}
                        <span className="block h-6 w-full border-2 border-border bg-muted">
                          <span className="flex h-full" style={{ width: `${Math.max(width, 1)}%` }}>
                            <span
                              className="block h-full bg-primary"
                              style={{ width: `${approvedShare}%` }}
                            />
                            <span
                              className="block h-full bg-data-bad"
                              style={{ width: `${100 - approvedShare}%` }}
                            />
                          </span>
                        </span>{" "}
                        <span className="text-right text-sm tabular-nums text-foreground/70">
                          {int(p.denied)}
                        </span>
                      </li>
                    </Fragment>
                  );
                })}
              </ol>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/70">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 border-2 border-border bg-primary" aria-hidden="true" />
                  Approved
                </span>{" "}
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 border-2 border-border bg-data-bad" aria-hidden="true" />
                  Denied
                </span>{" "}
                <span>The number on the right is denials.</span>
              </div>
            </section>

            <DenialRateLine points={points} />

            {split ? (
              <section className="mt-12 border-2 border-border bg-tint-primary p-6 sm:p-8">
                <h3 className="font-heading text-xl font-black">
                  What the {category} rate is an average of
                </h3>{" "}
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/70">
                  {pct(totals.denialRate)} is the blend. Nobody files under{" "}
                  {category} itself: every petition goes in under one of its
                  subtypes, and they aren&rsquo;t deciding alike.
                </p>{" "}
                <ul className="mt-6 space-y-3">
                  {split.children.map((c) => (
                    <Fragment key={c.code}>
                      {" "}
                      <li className="grid grid-cols-1 gap-1 sm:grid-cols-[16rem_1fr_5rem] sm:items-center sm:gap-4 [&>*]:min-w-0">
                        <span className="text-sm font-bold">
                          {c.code} · {c.label}
                        </span>{" "}
                        <span className="relative block h-6 border-2 border-border bg-background">
                          <span
                            className="absolute inset-y-0 left-0 block bg-data-bad"
                            style={{
                              width: `${Math.max((c.denialRate! / split.maxRate) * 100, 1)}%`,
                            }}
                          />
                        </span>{" "}
                        <span className="text-sm font-bold tabular-nums sm:text-right">
                          {pct(c.denialRate)}
                        </span>
                      </li>
                    </Fragment>
                  ))}
                </ul>{" "}
                <p className="mt-4 text-sm leading-relaxed text-foreground/70">
                  Denial rates over the{" "}
                  {int(split.children.reduce((n, c) => n + c.decided, 0))}{" "}
                  petitions USCIS decided in these {totals.quarters}{" "}
                  {totals.quarters === 1 ? "quarter" : "quarters"}, per subtype:{" "}
                  {split.children
                    .map((c) => `${c.code} ${int(c.decided)}`)
                    .join(", ")}
                  . These are rates over past petitions, not odds for a
                  particular one.
                </p>
              </section>
            ) : null}
          </>
        ) : (
          <p className="mt-8 text-base text-foreground/70">
            USCIS has not reported any quarter for this category.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The denial rate as a trajectory.
 *
 * Paint names the TOKEN `var(--primary-text)`, never the `text-primary`
 * utility. The utility is banned on a painted element and that ban is right:
 * a class named `text-*` used as paint is confusing even when its value is
 * correct. The token is a different question, and the measurement settles it.
 * `--primary` is #2ECC40 on a #FAFAFA card, about 2:1, under the 3:1 floor
 * WCAG 1.4.11 sets for a graphical object required to understand the content.
 * `--primary-text` is #1D8229 there, 4.70:1, and resolves to #2ECC40 in dark
 * mode, so it costs nothing in dark and fixes light.
 */
function DenialRateLine({
  points,
}: {
  points: readonly {
    label: string;
    denialRate: number | null;
    approved: number;
    denied: number;
  }[];
}) {
  const rates = points.map((p) => p.denialRate).filter((r): r is number => r !== null);
  if (rates.length < 2) return null;

  const W = 720;
  const H = 220;
  const PAD = { l: 52, r: 16, t: 16, b: 34 };
  const max = Math.max(...rates) * 1.15;
  const px = (i: number) =>
    PAD.l + (i / Math.max(1, points.length - 1)) * (W - PAD.l - PAD.r);
  const py = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);

  // Segments, never one polyline. Filtering the unrated quarters out and
  // joining what is left draws a straight run from the quarter before a gap
  // to the quarter after it, through a period with no measured rate at all,
  // while the axis below still prints a label for the missing quarter. Same
  // defect the priority-date chart had across closed months.
  const segments: string[] = [];
  {
    let run: string[] = [];
    points.forEach((p, i) => {
      if (p.denialRate === null) {
        if (run.length > 1) segments.push(run.join(" "));
        run = [];
      } else {
        run.push(`${px(i)},${py(p.denialRate)}`);
      }
    });
    if (run.length > 1) segments.push(run.join(" "));
  }

  // The points a reader can interrogate. ONE POINT IS ONE FISCAL QUARTER of
  // the selected category, which is the unit drawn: a quarter is what USCIS
  // publishes and there is nothing finer to report. A quarter with nothing
  // decided has no rate and no mark, so it is not offered either - the
  // readout can only name what is on the page.
  //
  // The value is `pct`, the same formatter as the Denial rate card above, so
  // one quarter cannot read 2.53% in one place and 2.5% in another. The
  // second line is the rate's own denominator: 47% over 12 decisions and 47%
  // over 47,291 are not the same fact, and the axis cannot show which it is.
  const hover: HoverPoint[] = points.flatMap((p, i) =>
    p.denialRate === null
      ? []
      : [
          {
            x: px(i),
            y: py(p.denialRate),
            label: p.label,
            value: pct(p.denialRate),
            detail: `${int(p.denied)} denied of ${int(p.approved + p.denied)} decided`,
          },
        ],
  );

  // A tick labelled to the nearest whole percent is wrong by half its own
  // value on a low-rate series: E-21 tops out near 2.53%, so the midpoint
  // gridline sits at 1.45 and printed "1%". Decimals follow the magnitude.
  const tickDecimals = max < 1 ? 2 : max < 10 ? 1 : 0;

  return (
    <section className="mt-10">
      <h3 className="font-heading text-xl font-black">Denial rate over time</h3>{" "}
      <p className="mt-2 text-base text-foreground/70">
        Denials as a share of the petitions decided in that quarter.
      </p>
      {/* min-width plus its own scroller: SVG text scales with the viewBox, so
          a 720-unit drawing squeezed into a 306px phone column renders its
          labels at about 5px. */}
      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[34rem]"
          role="img"
          aria-label={`Denial rate by quarter, from ${rates[0]!.toFixed(2)}% to ${rates[rates.length - 1]!.toFixed(2)}%`}
        >
          {[0, max / 2, max].map((v) => (
            <Fragment key={v}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={py(v)}
                y2={py(v)}
                stroke="var(--border)"
                strokeOpacity="0.35"
              />
              <text
                x={PAD.l - 8}
                y={py(v) + 4}
                textAnchor="end"
                fontSize="12"
                className="fill-muted-foreground"
              >
                {v.toFixed(tickDecimals)}%
              </text>
            {" "}
            </Fragment>
          ))}
          {segments.map((pts) => (
            <polyline
              key={pts.slice(0, 24)}
              points={pts}
              fill="none"
              stroke="var(--primary-text)"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {points.map((p, i) =>
            p.denialRate === null ? null : (
              <circle key={p.label} cx={px(i)} cy={py(p.denialRate)} r="4" fill="var(--primary-text)" />
            ),
          )}
          {points.map((p, i) => (
            <text
              key={p.label}
              x={px(i)}
              y={H - 10}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fontSize="12"
              className="fill-muted-foreground"
            >
              {p.label}
            </text>
          ))}
          {/* LAST, after every painted element: the hit area is a transparent
              rect over the plot, so anything drawn after it would take the
              pointer instead of the readout. */}
          <ChartHoverLayer
            points={hover}
            plot={{
              x: PAD.l,
              y: PAD.t,
              width: W - PAD.l - PAD.r,
              height: H - PAD.t - PAD.b,
            }}
            viewBox={{ width: W, height: H }}
            label="Denial rate by quarter. Use the arrow keys to step through the quarters."
          />
        </svg>
      </div>
    </section>
  );
}
