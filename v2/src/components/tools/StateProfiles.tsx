"use client";

import { Fragment, useMemo, useState } from "react";

import { stateName } from "@/lib/usStateNames";
import type { StateProfile } from "@/lib/turso/states";
import { CENSUS_REGION } from "./USStateMap";
import { DataView } from "./DataView";
import { FilterableStatTable, type CsvSpec, type StatColumn } from "./FilterableStatTable";

/**
 * Concentration: the fact a choropleth structurally cannot show.
 *
 * A map shaded by volume says California is big and Alabama is small, which
 * everyone already assumes. It has no channel for the shape of a state's
 * filings, and that is where the surprise lives. Nationally PERM reads as a
 * software program. State by state it often is not: 63% of Alabama's filings
 * are one occupation and it is meat cutting, 37% of Washington's are one
 * employer, and Wyoming's biggest occupation is groundskeeping.
 *
 * TWO SEPARATE MEASURES, NEVER BLENDED INTO A "CONCENTRATION SCORE". One
 * occupation dominating a state and one employer dominating it are different
 * facts with different causes: an industry clustering in a place, versus a
 * single large firm. Washington is high on both because Microsoft writes
 * software. Georgia is high on the first and low on the second because three
 * separate poultry firms compete there. A single index would hide exactly the
 * distinction that makes the pair worth reading.
 *
 * THE BARS ARE SHARES OF A WHOLE, SO THEY NEED NO POPULATION FLOOR. The floor
 * on this page's rates exists because a rate over forty decided cases is
 * noise. "Nineteen of Wyoming's 159 filings were groundskeepers" is not an
 * estimate of anything, it is a count over a census, and the count is printed
 * beside every bar so the reader can see how thin it is.
 */

export interface StateProfilesProps {
  states: StateProfile[];
  /** How many bars each ranking shows before the table takes over. */
  chartLimit?: number;
  className?: string;
}

type Axis = "occupation" | "employer";

const AXES: { key: Axis; label: string; unit: string }[] = [
  { key: "occupation", label: "One occupation", unit: "Occupation" },
  { key: "employer", label: "One employer", unit: "Employer" },
];

interface Bar {
  state: string;
  share: number;
  label: string;
  count: number;
  total: number;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function int(n: number): string {
  return n.toLocaleString("en-US");
}

function toBars(states: StateProfile[], axis: Axis): Bar[] {
  return states
    .map((s): Bar | null => {
      const share = axis === "occupation" ? s.topOccupationShare : s.topEmployerShare;
      const lead = axis === "occupation" ? s.topOccupations[0] : s.topEmployers[0];
      if (share === null || !lead) return null;
      return {
        state: s.state,
        share,
        label: lead.label,
        count: lead.count,
        total: s.total,
      };
    })
    .filter((b): b is Bar => b !== null)
    .sort((a, b) => b.share - a.share || a.state.localeCompare(b.state));
}

function Bars({ bars, unit }: { bars: Bar[]; unit: string }) {
  // Scaled against 100%, not against the largest bar. A share is already a
  // fraction of a known whole, so normalising to the leader would make a 63%
  // and a 21% look like a full bar and a third of one, and would redraw every
  // bar when the leader changed.
  return (
    <ul className="space-y-4">
      {/* Array items render with nothing between them, so each one carries its
          own leading space. A whitespace-only text node is not laid out as a
          flex or list item, so it costs nothing visually. */}
      {bars.map((b) => (
        <Fragment key={b.state}>
          {" "}
          <li>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-bold">
              {stateName(b.state)}
            </p>{" "}
            <p className="font-mono text-sm tabular-nums text-foreground/70">
              {int(b.count)} of {int(b.total)}
            </p>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <div
              className="h-4 min-w-0 flex-1 border-2 border-border bg-background"
              role="img"
              aria-label={`${pct(b.share)} of ${stateName(b.state)} filings are ${b.label}`}
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, b.share)}%` }}
              />
            </div>
            <p className="w-14 shrink-0 text-right font-heading text-lg font-black tabular-nums">
              {pct(b.share)}
            </p>
          </div>
          <p className="mt-1.5 text-sm leading-snug text-foreground/70">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {unit}
            </span>{" "}
            {b.label}
          </p>
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

function BarTable({ bars, unit }: { bars: Bar[]; unit: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-2 border-border text-left text-sm">
        <caption className="sr-only">
          Every state by the share of its filings in its single biggest {unit.toLowerCase()}
        </caption>
        <thead className="bg-foreground text-background">
          <tr>
            <th scope="col" className="p-3 font-mono text-xs font-bold uppercase tracking-wider">
              State
            {" "}</th>
            <th scope="col" className="p-3 font-mono text-xs font-bold uppercase tracking-wider">
              {unit}
            {" "}</th>
            <th scope="col" className="p-3 text-right font-mono text-xs font-bold uppercase tracking-wider">
              Cases
            {" "}</th>
            <th scope="col" className="p-3 text-right font-mono text-xs font-bold uppercase tracking-wider">
              Share
            </th>
          </tr>
        </thead>
        <tbody className="bg-card">
          {bars.map((b) => (
            <tr key={b.state} className="border-t border-border/40">
              <td className="p-3 font-bold">{stateName(b.state)}{" "}</td>
              <td className="p-3">{b.label}{" "}</td>
              <td className="p-3 text-right tabular-nums">{int(b.count)}{" "}</td>
              <td className="p-3 text-right font-bold tabular-nums">{pct(b.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The two concentration rankings, each as bars or as exact figures. */
export function StateConcentration({
  states,
  chartLimit = 12,
  className,
}: StateProfilesProps) {
  const [axis, setAxis] = useState<Axis>("occupation");
  const bars = useMemo(() => toBars(states, axis), [states, axis]);
  const active = AXES.find((a) => a.key === axis) ?? AXES[0]!;

  if (bars.length === 0) return null;

  return (
    <div className={className}>
      <DataView
        label={`Filing concentration by ${active.key}`}
        chartLabel="Bars"
        tableLabel="Every state"
        controls={
          <fieldset className="min-w-0">
            <legend className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Concentrated in
            </legend>{" "}
            {/* Buttons, not hover-select: this is a list of controls, so
                pressing one changes things. A hover-driven version fires once
                per option as the pointer travels across it. */}
            <div className="mt-2 flex flex-wrap gap-2">
              {AXES.map((a) => (
                <Fragment key={a.key}>
                  {" "}
                <button
                  type="button"
                  onClick={() => setAxis(a.key)}
                  aria-pressed={axis === a.key}
                  className={
                    "inline-flex min-h-[44px] items-center border-2 border-border px-4 py-2 text-sm font-bold transition-all duration-150 " +
                    (axis === a.key
                      ? "bg-foreground text-background shadow-hard-sm"
                      : "bg-card hover:-translate-y-[1px] hover:shadow-hard-sm active:translate-y-0")
                  }
                >
                  {a.label}
                </button>
                </Fragment>
              ))}
            </div>
          </fieldset>
        }
        chart={<Bars bars={bars.slice(0, chartLimit)} unit={active.unit} />}
        table={<BarTable bars={bars} unit={active.unit} />}
      />
    </div>
  );
}

interface LeaderRow {
  state: string;
  name: string;
  region: string | null;
  total: number;
  occupation: string;
  occupationCount: number;
  occupationShare: number | null;
  employer: string;
  employerKey: string;
  employerCount: number;
  employerShare: number | null;
}

function toLeaderRows(states: StateProfile[]): LeaderRow[] {
  return states.map((s) => {
    const occ = s.topOccupations[0];
    const emp = s.topEmployers[0];
    return {
      state: s.state,
      name: stateName(s.state),
      region: CENSUS_REGION[s.state] ?? null,
      total: s.total,
      occupation: occ?.label ?? "Not recorded",
      occupationCount: occ?.count ?? 0,
      occupationShare: s.topOccupationShare,
      employer: emp?.label ?? "Not recorded",
      employerKey: emp?.key ?? "",
      employerCount: emp?.count ?? 0,
      employerShare: s.topEmployerShare,
    };
  });
}

/** Every state's biggest occupation and biggest employer, searchable. */
export function StateLeaders({ states, className }: StateProfilesProps) {
  const rows = useMemo(() => toLeaderRows(states), [states]);

  const columns: StatColumn<LeaderRow>[] = [
    {
      key: "state",
      label: "State",
      sortValue: (r) => r.name,
      render: (r) => <span className="font-bold">{r.name}</span>,
    },
    {
      key: "total",
      label: "Filings",
      numeric: true,
      sortValue: (r) => r.total,
      render: (r) => <span className="tabular-nums">{int(r.total)}</span>,
    },
    {
      key: "occupation",
      label: "Biggest occupation",
      sortValue: (r) => r.occupation,
      render: (r) => (
        <span>
          {r.occupation}{" "}
          {r.occupationShare !== null ? (
            <span className="ml-2 font-mono text-xs tabular-nums text-foreground/60">
              {pct(r.occupationShare)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "employer",
      label: "Biggest employer",
      secondary: true,
      sortValue: (r) => r.employer,
      render: (r) => (
        <span>
          {/* The slug is the identity DOL's spellings collapse to, so the link
              works even when this row shows a different capitalisation than
              the entity page's own heading. */}
          {r.employerKey ? (
            <a
              href={`/perm-employers/${r.employerKey}`}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              {r.employer}
            </a>
          ) : (
            <span className="font-bold">{r.employer}</span>
          )}{" "}
          {r.employerShare !== null ? (
            <span className="ml-2 font-mono text-xs tabular-nums text-foreground/60">
              {pct(r.employerShare)}
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  const csv: CsvSpec<LeaderRow> = {
    filename: "perm-state-leaders.csv",
    header: [
      "state",
      "filings",
      "top_occupation",
      "top_occupation_cases",
      "top_occupation_share_pct",
      "top_employer",
      "top_employer_cases",
      "top_employer_share_pct",
    ],
    row: (r) => [
      r.name,
      r.total,
      r.occupation,
      r.occupationCount,
      r.occupationShare,
      r.employer,
      r.employerCount,
      r.employerShare,
    ],
  };

  return (
    <div className={className}>
      <FilterableStatTable
        rows={rows}
        columns={columns}
        searchText={(r) => `${r.name} ${r.state} ${r.occupation} ${r.employer}`}
        searchPlaceholder="Georgia, Software Developers, Microsoft…"
        initialSort="total"
        caption="Every state's biggest occupation and biggest employer, with each one's share of the state"
        noun="states"
        facets={[
          {
            key: "region",
            label: "Region",
            value: (r) => r.region,
          },
        ]}
        csv={csv}
        pageSize={25}
      />
    </div>
  );
}
