"use client";

/**
 * A denial-rate bar row set, with the baseline drawn through it — and the same
 * numbers as a table, because a rate is a shape and a figure at once.
 *
 * The baseline line is the point of the drawing: a rate means nothing on its
 * own, and "above or below the field" is the only reading that survives
 * without a statistics lecture. Bars scale to the largest rate in the set, so
 * a 54% flag does not squash a 1.5% one into invisibility, and every row
 * carries its own denominator because a rate over 300 cases and a rate over
 * 80,000 are not the same claim.
 *
 * THE FLOOR IS A TRUTH CONTROL, NOT A CONVENIENCE. Ranking hundreds of groups
 * by a rate puts the smallest populations at the top, every time: a group with
 * four decided cases and one denial reads as 25%, which is ten times the field
 * and means nothing. `RankedRateViews` refuses to rank below a minimum
 * population, says how many groups that removed, and prints the 95% interval
 * beside every rate so the reader can see what each one is actually worth.
 */

import { useMemo, useState } from "react";

import { BaselineMultiple } from "./Insight";
import { DataView, ScopeSelect } from "./DataView";
import { FilterableStatTable, type CsvSpec, type Facet, type StatColumn } from "./FilterableStatTable";

export interface RateRow {
  label: string;
  /** Optional one-line explanation of what the bucket means. */
  note?: string;
  /** Percent, e.g. 3.53. */
  rate: number;
  decided: number;
  /** Numerator. Needed for an interval; the rate alone cannot give one. */
  denied?: number;
  /** Optional grouping value, offered as a facet by `RankedRateViews`. */
  group?: string;
}

/**
 * Wilson score interval for a proportion, in percent.
 *
 * The normal approximation is wrong exactly where these rates live — small
 * counts and proportions near zero — and produces negative lower bounds, so a
 * "denial rate of 0.6% plus or minus 1.2%" would print a negative floor. The
 * Wilson interval stays inside 0 to 100 by construction and is the standard
 * answer for this shape of data.
 *
 * Returns null when there is nothing to bound.
 */
export function wilsonInterval(
  denied: number,
  decided: number,
  z = 1.96,
): { lo: number; hi: number } | null {
  if (!Number.isFinite(denied) || !Number.isFinite(decided) || decided <= 0) return null;
  const p = denied / decided;
  const denom = 1 + (z * z) / decided;
  const centre = (p + (z * z) / (2 * decided)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p)) / decided + (z * z) / (4 * decided * decided))) / denom;
  return {
    lo: Math.max(0, (centre - half) * 100),
    hi: Math.min(100, (centre + half) * 100),
  };
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

export function RateBars({ rows, baseline }: { rows: RateRow[]; baseline: number }) {
  if (rows.length === 0) return null;
  const max = Math.max(baseline, ...rows.map((r) => r.rate)) * 1.08;

  return (
    <div className="border-2 border-border bg-card p-5 shadow-hard-sm sm:p-6">
      <div className="space-y-5">
        {rows.map((r) => {
          const ratio = baseline > 0 ? r.rate / baseline : 1;
          // Three bands, not two: at the field, above it, and far above it.
          // A lime/black binary made a 1.2x and a 21x look identical.
          const fill =
            ratio >= 2
              ? "var(--data-bad)"
              : ratio >= 1.2
                ? "var(--data-warn)"
                : "var(--primary)";
          return (
            <div key={r.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-bold">{r.label}</p>{" "}
                <p className="flex items-baseline gap-2 font-mono text-sm font-bold tabular-nums">
                  <BaselineMultiple rate={r.rate} baseline={baseline} />{" "}
                  <span>
                    {r.rate.toFixed(2)}%{" "}
                    <span className="font-normal text-foreground/50">
                      of {fmtInt(r.decided)}
                    </span>
                  </span>
                </p>
              </div>
              {/* The track carries the baseline marker, so every bar is read
                  against the field rather than against itself. */}
              <div className="relative mt-2 h-6 border-2 border-border bg-background">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(1.5, (r.rate / max) * 100)}%`,
                    background: fill,
                  }}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 w-0.5 bg-foreground/40"
                  style={{ left: `${(baseline / max) * 100}%` }}
                />
              </div>
              {r.note ? (
                <p className="mt-1.5 text-xs leading-relaxed text-foreground/60">{r.note}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/60">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-foreground/40" />
          Field baseline, {baseline.toFixed(2)}%
        </span>{" "}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 border border-border" style={{ background: "var(--data-warn)" }} />
          Above the field
        </span>{" "}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 border border-border" style={{ background: "var(--data-bad)" }} />
          Twice the field or more
        </span>
      </p>
    </div>
  );
}

type SortKey = "label" | "rate" | "decided" | "denied";

/**
 * The same rows as exact figures, sortable. For a set small enough that a
 * search box and a pager would be furniture rather than help.
 */
export function RateTable({
  rows,
  baseline,
  caption,
  unitLabel = "Group",
}: {
  rows: RateRow[];
  baseline: number;
  caption: string;
  unitLabel?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rate");
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      let cmp: number;
      if (sortKey === "label") cmp = a.label.localeCompare(b.label);
      else if (sortKey === "decided") cmp = a.decided - b.decided;
      else if (sortKey === "denied") cmp = (a.denied ?? 0) - (b.denied ?? 0);
      else cmp = a.rate - b.rate;
      return desc ? -cmp : cmp;
    });
    return out;
  }, [rows, sortKey, desc]);

  if (rows.length === 0) return null;

  const head = (key: SortKey, label: string, numeric = true) => (
    <th
      scope="col"
      aria-sort={sortKey === key ? (desc ? "descending" : "ascending") : "none"}
      className={"p-0 " + (numeric ? "text-right" : "text-left")}
    >
      <button
        type="button"
        onClick={() => {
          if (key === sortKey) setDesc((d) => !d);
          else {
            setSortKey(key);
            setDesc(key !== "label");
          }
        }}
        className={
          "min-h-[44px] w-full px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary " +
          (numeric ? "text-right" : "text-left") +
          (sortKey === key ? " text-primary" : "")
        }
      >
        {label}
        {sortKey === key ? (desc ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-2 border-border text-left text-sm shadow-hard-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-foreground text-background">
          <tr>
            {/* No whitespace between these: a text node whose parent is
                <tr> is invalid HTML and React warns it breaks hydration.
                Each head() already carries its own trailing separator. */}
            {head("label", unitLabel, false)}
            {head("rate", "Denial rate")}
            <th
              scope="col"
              className="hidden px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider sm:table-cell"
            >
              95% range
            {" "}</th>
            {head("denied", "Denied")}
            {head("decided", "Decided")}
            <th
              scope="col"
              className="hidden px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider sm:table-cell"
            >
              vs field
            </th>
          </tr>
        </thead>
        <tbody className="bg-card">
          {sorted.map((r) => {
            const ci = r.denied === undefined ? null : wilsonInterval(r.denied, r.decided);
            return (
              <tr key={r.label} className="border-t border-border/40">
                <td className="px-3 py-2.5 font-bold">
                  {r.label}
                  {r.note ? (
                    <span className="block text-xs font-normal leading-relaxed text-foreground/60">
                      {r.note}
                    </span>
                  ) : null}
                {" "}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.rate.toFixed(2)}%{" "}</td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums text-foreground/60 sm:table-cell">
                  {ci ? `${ci.lo.toFixed(2)}–${ci.hi.toFixed(2)}%` : "—"}
                {" "}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {r.denied === undefined ? "—" : fmtInt(r.denied)}
                {" "}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(r.decided)}{" "}</td>
                <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                  <BaselineMultiple rate={r.rate} baseline={baseline} />
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
 * A fixed set of buckets: bars, or the exact figures. No floor control,
 * because the buckets are the whole population cut a few ways rather than a
 * ranking that a thin group could climb.
 */
export function RateViews({
  label,
  rows,
  baseline,
  caption,
  unitLabel,
}: {
  label: string;
  rows: RateRow[];
  baseline: number;
  caption: string;
  unitLabel?: string;
}) {
  return (
    <DataView
      label={label}
      chart={<RateBars rows={rows} baseline={baseline} />}
      table={
        <RateTable rows={rows} baseline={baseline} caption={caption} unitLabel={unitLabel} />
      }
    />
  );
}

/** Population floors offered wherever groups are ranked by rate. */
export const RATE_FLOORS = [25, 50, 100, 250, 500, 1000] as const;
export const DEFAULT_RATE_FLOOR = 100;

export interface RankedRow extends RateRow {
  denied: number;
  rank: number;
}

/**
 * Hundreds of groups ranked by denial rate: the worst of them as bars, all of
 * them as a searchable table, and a population floor over both.
 */
export function RankedRateViews({
  label,
  rows,
  baseline,
  noun,
  unitLabel,
  searchPlaceholder,
  csvFilename,
  chartLimit = 12,
  facetLabel,
  defaultFloor = DEFAULT_RATE_FLOOR,
  pageSize = 50,
}: {
  label: string;
  rows: RateRow[];
  baseline: number;
  /** Plural, for the counts. */
  noun: string;
  /** Column heading for the thing being ranked. */
  unitLabel: string;
  searchPlaceholder: string;
  csvFilename: string;
  chartLimit?: number;
  /** When set, `row.group` becomes a facet with this label. */
  facetLabel?: string;
  defaultFloor?: number;
  /**
   * Rows the table renders per page. It is a crawler setting as much as a
   * layout one: only the first page is in the served HTML, so a set small
   * enough to fit in one page should be given one.
   */
  pageSize?: number;
}) {
  const [floor, setFloor] = useState(defaultFloor);

  const kept = useMemo<RankedRow[]>(() => {
    const above = rows
      .filter((r) => r.decided >= floor && r.denied !== undefined)
      .sort((a, b) => b.rate - a.rate);
    return above.map((r, i) => ({ ...r, denied: r.denied ?? 0, rank: i + 1 }));
  }, [rows, floor]);

  const hidden = rows.length - kept.length;

  const columns: StatColumn<RankedRow>[] = useMemo(
    () => [
      {
        key: "rank",
        label: "#",
        numeric: true,
        sortValue: (r) => r.rank,
        render: (r) => <span className="text-foreground/50">{r.rank}</span>,
      },
      {
        key: "label",
        label: unitLabel,
        sortValue: (r) => r.label,
        render: (r) => <span className="font-bold">{r.label}</span>,
      },
      {
        key: "rate",
        label: "Denial rate",
        numeric: true,
        sortValue: (r) => r.rate,
        render: (r) => `${r.rate.toFixed(2)}%`,
      },
      {
        key: "ci",
        label: "95% range",
        numeric: true,
        secondary: true,
        // Sorted by how wide the interval is, which is the same as sorting by
        // how much the rate is worth. Nulls last, never substituted.
        sortValue: (r) => {
          const ci = wilsonInterval(r.denied, r.decided);
          return ci === null ? null : ci.hi - ci.lo;
        },
        render: (r) => {
          const ci = wilsonInterval(r.denied, r.decided);
          return ci ? `${ci.lo.toFixed(2)}–${ci.hi.toFixed(2)}%` : "—";
        },
      },
      {
        key: "denied",
        label: "Denied",
        numeric: true,
        sortValue: (r) => r.denied,
        render: (r) => fmtInt(r.denied),
      },
      {
        key: "decided",
        label: "Decided",
        numeric: true,
        sortValue: (r) => r.decided,
        render: (r) => fmtInt(r.decided),
      },
      {
        key: "multiple",
        label: "vs field",
        numeric: true,
        secondary: true,
        sortValue: (r) => r.rate,
        render: (r) => <BaselineMultiple rate={r.rate} baseline={baseline} />,
      },
    ],
    [baseline, unitLabel],
  );

  const csv: CsvSpec<RankedRow> = useMemo(
    () => ({
      filename: csvFilename,
      header: [
        unitLabel.toLowerCase().replace(/\s+/g, "_"),
        "denied",
        "decided",
        "denial_rate_pct",
        "ci95_low_pct",
        "ci95_high_pct",
        "field_baseline_pct",
      ],
      row: (r) => {
        const ci = wilsonInterval(r.denied, r.decided);
        return [
          r.label,
          r.denied,
          r.decided,
          r.rate.toFixed(2),
          ci ? ci.lo.toFixed(2) : "",
          ci ? ci.hi.toFixed(2) : "",
          baseline.toFixed(2),
        ];
      },
    }),
    [baseline, csvFilename, unitLabel],
  );

  const facets: Facet<RankedRow>[] = useMemo(
    () =>
      facetLabel
        ? [{ key: "group", label: facetLabel, value: (r) => r.group ?? null }]
        : [],
    [facetLabel],
  );

  const floorControl = (
    <>
      <ScopeSelect
        label="Min cases"
        value={String(floor)}
        onChange={(v) => setFloor(Number(v))}
        hint={`Hides ${noun} with fewer decided cases than this, because a rate over a handful of cases is noise.`}
        options={RATE_FLOORS.map((n) => ({
          value: String(n),
          label: `${n.toLocaleString("en-US")}+ decided`,
        }))}
      />{" "}
      <p className="text-sm text-foreground/70">
        {kept.length.toLocaleString("en-US")} {noun} clear this floor
        {hidden > 0 ? (
          <>
            {" "}
            <span className="text-foreground/50">
              ({hidden.toLocaleString("en-US")} below it, not ranked)
            </span>
          </>
        ) : null}
      </p>
    </>
  );

  const shown = kept.slice(0, chartLimit);
  const showingAll = shown.length === kept.length;
  const empty = (
    <p className="border-2 border-border bg-card p-6 text-base text-foreground/70 shadow-hard-sm">
      No {noun} clear a floor of {floor.toLocaleString("en-US")} decided cases in this
      window. Lower the floor to see what the files hold.
    </p>
  );

  return (
    <DataView
      label={label}
      controls={floorControl}
      chartLabel={showingAll ? "Chart" : `Top ${shown.length}`}
      tableLabel={`All ${kept.length.toLocaleString("en-US")}`}
      chart={
        shown.length === 0 ? (
          empty
        ) : (
          <div>
            <RateBars rows={shown} baseline={baseline} />
            <p className="mt-3 text-sm text-foreground/60">
              {showingAll ? (
                <>
                  All {kept.length.toLocaleString("en-US")} {noun} with at least{" "}
                  {floor.toLocaleString("en-US")} decided cases, ranked by denial rate.
                </>
              ) : (
                <>
                  The {shown.length} highest denial rates among the{" "}
                  {kept.length.toLocaleString("en-US")} {noun} with at least{" "}
                  {floor.toLocaleString("en-US")} decided cases. The full ranking carries
                  a 95% range on every rate.
                </>
              )}
            </p>
          </div>
        )
      }
      table={
        kept.length === 0 ? (
          empty
        ) : (
        <FilterableStatTable<RankedRow>
          rows={kept}
          columns={columns}
          facets={facets}
          csv={csv}
          searchText={(r) => `${r.label} ${r.group ?? ""}`}
          searchPlaceholder={searchPlaceholder}
          initialSort="rate"
          caption={`${unitLabel} denial rates with their decided-case counts and 95% ranges`}
          noun={noun}
          pageSize={pageSize}
        />
        )
      }
    />
  );
}
