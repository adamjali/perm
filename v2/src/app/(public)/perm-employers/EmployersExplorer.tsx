"use client";

import Link from "next/link";

import { FilterableStatTable, type StatColumn } from "@/components/tools/FilterableStatTable";

/** Row shape mirrors convex/permDisclosure.ts employerStatValidator, plus the
 *  precomputed rank (by volume) so filtering never renumbers anyone. */
export interface EmployerStat {
  rank: number;
  /** Assigned by the page via withUniqueSlugs, so collisions are resolved. */
  slug: string;
  name: string;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

const COLUMNS: StatColumn<EmployerStat>[] = [
  {
    key: "rank",
    label: "#",
    numeric: true,
    sortValue: (e) => e.rank,
    render: (e) => <span className="text-foreground/50">{e.rank}</span>,
  },
  {
    key: "name",
    label: "Employer",
    sortValue: (e) => e.name,
    render: (e) => (
      <Link
        href={`/perm-employers/${e.slug}`}
        className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
      >
        {e.name}
      </Link>
    ),
  },
  {
    key: "total",
    label: "Filings",
    numeric: true,
    sortValue: (e) => e.total,
    render: (e) => fmtInt(e.total),
  },
  {
    key: "certified",
    label: "Certified",
    numeric: true,
    sortValue: (e) => e.certified,
    render: (e) => fmtInt(e.certified),
  },
  {
    key: "approval",
    label: "Approval",
    numeric: true,
    sortValue: (e) => {
      const d = e.certified + e.denied;
      return d === 0 ? -1 : e.certified / d;
    },
    render: (e) => {
      const d = e.certified + e.denied;
      return d === 0 ? "—" : `${((e.certified / d) * 100).toFixed(1)}%`;
    },
  },
  {
    key: "days",
    label: "Median days",
    numeric: true,
    sortValue: (e) => e.medianDays ?? -1,
    render: (e) => (e.medianDays == null ? "—" : fmtInt(Math.round(e.medianDays))),
  },
];

export function EmployersExplorer({ employers }: { employers: EmployerStat[] }) {
  return (
    <FilterableStatTable
      rows={employers}
      columns={COLUMNS}
      searchText={(e) => e.name}
      searchPlaceholder="Find an employer…"
      initialSort="total"
      caption="Top PERM sponsors with filings, certifications, approval rate and median processing days"
    />
  );
}
