"use client";

import Link from "next/link";

import { FilterableStatTable, type StatColumn } from "@/components/tools/FilterableStatTable";

/** Row shape mirrors convex/permDisclosure.ts attorneyStatValidator plus rank. */
export interface AttorneyStat {
  rank: number;
  /** Assigned by the page via withUniqueSlugs, so collisions are resolved. */
  slug: string;
  name: string;
  state: string;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

const COLUMNS: StatColumn<AttorneyStat>[] = [
  {
    key: "rank",
    label: "#",
    numeric: true,
    sortValue: (a) => a.rank,
    render: (a) => <span className="text-foreground/50">{a.rank}</span>,
  },
  {
    key: "name",
    label: "Firm",
    sortValue: (a) => a.name,
    render: (a) => (
      <Link
        href={`/perm-attorneys/${a.slug}`}
        className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
      >
        {a.name}
        {a.state ? (
          <span className="ml-2 font-mono text-xs font-normal text-foreground/50">{a.state}</span>
        ) : null}
      </Link>
    ),
  },
  {
    key: "total",
    label: "Cases",
    numeric: true,
    sortValue: (a) => a.total,
    render: (a) => fmtInt(a.total),
  },
  {
    key: "certified",
    label: "Certified",
    numeric: true,
    sortValue: (a) => a.certified,
    render: (a) => fmtInt(a.certified),
  },
  {
    key: "approval",
    label: "Approval",
    numeric: true,
    sortValue: (a) => {
      const d = a.certified + a.denied;
      return d === 0 ? -1 : a.certified / d;
    },
    render: (a) => {
      const d = a.certified + a.denied;
      return d === 0 ? "—" : `${((a.certified / d) * 100).toFixed(1)}%`;
    },
  },
  {
    key: "days",
    label: "Median days",
    numeric: true,
    sortValue: (a) => a.medianDays ?? -1,
    render: (a) => (a.medianDays == null ? "—" : fmtInt(Math.round(a.medianDays))),
  },
];

export function AttorneysExplorer({ attorneys }: { attorneys: AttorneyStat[] }) {
  return (
    <FilterableStatTable
      rows={attorneys}
      columns={COLUMNS}
      searchText={(a) => `${a.name} ${a.state}`}
      searchPlaceholder="Find a firm…"
      initialSort="total"
      caption="Top PERM law firms with case volume, certifications, approval rate and median processing days"
    />
  );
}
