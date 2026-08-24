"use client";

import { FilterableStatTable, type StatColumn } from "@/components/tools/FilterableStatTable";

/** Row shape mirrors convex/permDisclosure.ts socStatValidator. */
export interface OccupationStat {
  code: string;
  title: string;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
  medianAnnualWage: number | null;
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

const COLUMNS: StatColumn<OccupationStat>[] = [
  {
    key: "title",
    label: "Occupation",
    sortValue: (o) => o.title,
    render: (o) => (
      <span className="font-bold">
        {o.title} <span className="font-mono text-xs font-normal text-foreground/50">{o.code}</span>
      </span>
    ),
  },
  {
    key: "total",
    label: "Filings",
    numeric: true,
    sortValue: (o) => o.total,
    render: (o) => fmtInt(o.total),
  },
  {
    key: "wage",
    label: "Median wage",
    numeric: true,
    sortValue: (o) => o.medianAnnualWage ?? -1,
    render: (o) =>
      o.medianAnnualWage == null ? "—" : `$${Math.round(o.medianAnnualWage).toLocaleString("en-US")}`,
  },
  {
    key: "approval",
    label: "Approval",
    numeric: true,
    sortValue: (o) => {
      const d = o.certified + o.denied;
      return d === 0 ? -1 : o.certified / d;
    },
    render: (o) => {
      const d = o.certified + o.denied;
      return d === 0 ? "—" : `${((o.certified / d) * 100).toFixed(1)}%`;
    },
  },
  {
    key: "days",
    label: "Median days",
    numeric: true,
    sortValue: (o) => o.medianDays ?? -1,
    render: (o) => (o.medianDays == null ? "—" : fmtInt(Math.round(o.medianDays))),
  },
];

export function WagesExplorer({ occupations }: { occupations: OccupationStat[] }) {
  return (
    <FilterableStatTable
      rows={occupations}
      columns={COLUMNS}
      searchText={(o) => `${o.title} ${o.code}`}
      searchPlaceholder="Software developers, 15-1252…"
      initialSort="total"
      caption="Top PERM occupations with filings, median wage, approval rate and median processing days"
    />
  );
}
