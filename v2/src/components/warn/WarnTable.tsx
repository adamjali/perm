"use client";

import Link from "next/link";

import { FilterableStatTable, type Facet, type StatColumn } from "@/components/tools/FilterableStatTable";
// One line, deliberately: no-server-only-in-client.test.ts checks each import line on its own.
import type { WarnNotice } from "@/lib/turso/warn";

const long = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export const WARN_COLUMNS: StatColumn<WarnNotice>[] = [
  { key: "notice", label: "Notice", sortValue: (r) => r.noticeDate, render: (r) => long(r.noticeDate) },
  {
    key: "company",
    label: "Employer, as filed",
    sortValue: (r) => r.company,
    render: (r) => (
      <>
        {r.company}{" "}
        {r.site ? <span className="block text-foreground/70">{r.site}{" "}</span> : null}
      </>
    ),
  },
  {
    key: "sponsor",
    label: "Sponsor record",
    sortValue: (r) => r.employerSlug,
    render: (r) =>
      r.employerSlug ? (
        <Link href={`/perm-employers/${r.employerSlug}`} className={LINK}>
          PERM record
        </Link>
      ) : null,
  },
  { key: "state", label: "State", sortValue: (r) => r.state, render: (r) => r.state },
  { key: "kind", label: "Kind", sortValue: (r) => r.kind, render: (r) => r.kind ?? "", secondary: true },
  {
    key: "employees",
    label: "Employees",
    numeric: true,
    sortValue: (r) => r.employees,
    render: (r) => r.employees?.toLocaleString("en-US") ?? "",
  },
  { key: "county", label: "County", sortValue: (r) => r.county, render: (r) => r.county ?? "", secondary: true },
  {
    key: "effective",
    label: "Effective",
    sortValue: (r) => r.effectiveDate,
    render: (r) => (r.effectiveDate ? long(r.effectiveDate) : ""),
    secondary: true,
  },
];

/**
 * Size bands, so "the big ones" is one choice rather than a sort and a scroll.
 * The values sort in size order because the table lists a facet's options
 * alphabetically.
 */
export function sizeBand(n: number | null): string | null {
  if (n === null) return null;
  if (n >= 500) return "3";
  if (n >= 100) return "2";
  if (n >= 50) return "1";
  return "0";
}

const SIZE_LABEL: Record<string, string> = {
  "0": "Under 50 employees",
  "1": "50 to 99",
  "2": "100 to 499",
  "3": "500 or more",
};

export const WARN_FACETS: Facet<WarnNotice>[] = [
  { key: "state", label: "State", value: (r) => r.state },
  { key: "kind", label: "Kind", value: (r) => r.kind },
  { key: "size", label: "Size", value: (r) => sizeBand(r.employees), format: (v) => SIZE_LABEL[v] ?? v },
  { key: "year", label: "Year", value: (r) => r.noticeDate.slice(0, 4) },
];

/** The sponsor-matched notices: searchable, sortable on every column, filterable by what they carry. */
export function WarnTable({ rows }: { rows: WarnNotice[] }) {
  return (
    <FilterableStatTable
      rows={rows}
      columns={WARN_COLUMNS}
      searchText={(r) => `${r.company} ${r.site ?? ""} ${r.county ?? ""}`}
      searchPlaceholder="Employer, site or county"
      initialSort="notice"
      caption="WARN notices filed by PERM sponsors, as each state published them"
      noun="notices"
      facets={WARN_FACETS}
      csv={{
        filename: "warn-notices-perm-sponsors.csv",
        header: ["notice_date", "company", "site", "state", "kind", "employees", "county", "effective_date", "perm_employer"],
        row: (r) => [r.noticeDate, r.company, r.site, r.state, r.kind, r.employees, r.county, r.effectiveDate, r.employerSlug],
      }}
    />
  );
}
