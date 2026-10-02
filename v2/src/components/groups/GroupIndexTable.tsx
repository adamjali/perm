"use client";

import Link from "next/link";

import { FilterableStatTable, type Facet, type StatColumn } from "@/components/tools/FilterableStatTable";
import { formatInt } from "@/lib/format";

/**
 * Every city, industry or country group of one kind, searchable, sortable by
 * every column and filterable by its facet, with a CSV of what is shown.
 * Rows arrive whole from the server (a few thousand at most), so a sort or a
 * search is over the full set, never a seed.
 */

export interface GroupIndexRow {
  slug: string;
  label: string;
  total: number;
  certified: number;
  denied: number;
  withdrawn: number;
  medianWage: number | null;
  fyFrom: number | null;
  fyTo: number | null;
  /** City: its state code. Industry: its sector title. Country: null. */
  facet: string | null;
}

function rate(r: GroupIndexRow): number | null {
  const decided = r.certified + r.denied;
  return decided >= 20 ? (r.certified / decided) * 100 : null;
}

export function GroupIndexTable({
  rows,
  basePath,
  noun,
  facetLabel,
  caption,
}: {
  rows: GroupIndexRow[];
  basePath: string;
  noun: string;
  facetLabel: string | null;
  caption: string;
}) {
  const columns: StatColumn<GroupIndexRow>[] = [
    {
      key: "label",
      label: "Name",
      sortValue: (r) => r.label,
      render: (r) => (
        <Link
          href={`${basePath}/${r.slug}`}
          className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
        >
          {r.label}
        </Link>
      ),
    },
    { key: "total", label: "Decisions", numeric: true, sortValue: (r) => r.total, render: (r) => formatInt(r.total) },
    {
      key: "rate",
      label: "Approved",
      numeric: true,
      sortValue: rate,
      render: (r) => {
        const v = rate(r);
        return v == null ? "too few" : `${v.toFixed(1)}%`;
      },
    },
    {
      key: "wage",
      label: "Median wage",
      numeric: true,
      sortValue: (r) => r.medianWage,
      render: (r) => (r.medianWage == null ? "n/a" : `$${formatInt(Math.round(r.medianWage))}`),
    },
    {
      key: "denied",
      label: "Denied",
      numeric: true,
      secondary: true,
      sortValue: (r) => r.denied,
      render: (r) => formatInt(r.denied),
    },
    {
      key: "years",
      label: "Years",
      secondary: true,
      sortValue: (r) => r.fyFrom,
      render: (r) => (r.fyFrom && r.fyTo ? `FY${r.fyFrom} to FY${r.fyTo}` : "n/a"),
    },
  ];
  const facets: Facet<GroupIndexRow>[] = facetLabel ? [{ key: "facet", label: facetLabel, value: (r) => r.facet }] : [];
  return (
    <FilterableStatTable
      rows={rows}
      columns={columns}
      searchText={(r) => r.label}
      searchPlaceholder={`Search ${noun}`}
      initialSort="total"
      caption={caption}
      noun={noun}
      totalCount={rows.length}
      facets={facets}
      csv={{
        filename: `perm-${noun.replace(/\s+/g, "-")}.csv`,
        header: ["name", "decisions", "certified", "denied", "withdrawn", "median_wage", "fy_from", "fy_to"],
        row: (r) => [r.label, r.total, r.certified, r.denied, r.withdrawn, r.medianWage, r.fyFrom, r.fyTo],
      }}
    />
  );
}
