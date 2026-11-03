"use client";

import Link from "next/link";
import { useMemo } from "react";

import { FilterableStatTable, type CsvSpec, type Facet, type StatColumn } from "@/components/tools/FilterableStatTable";
import { SITE_URL } from "@/lib/constants/site";
import { entityHref } from "@/lib/entityPayload";
import { formatInt, formatShareOf } from "@/lib/format";
import { yesBand, type LayoffEmployer } from "@/lib/layoffDisclosures";

/**
 * Every employer whose decided PERM applications reported a layoff at least
 * once in the newest fiscal year, from the doc the page already read, so search
 * and sort are local. The default order is applications that said yes, most first.
 */

const COLUMNS: StatColumn<LayoffEmployer>[] = [
  {
    key: "name",
    label: "Employer",
    sortValue: (r) => r.name,
    render: (r) =>
      r.slug ? (
        <Link href={entityHref("employer", r.slug)} className="link">
          {r.name}
        </Link>
      ) : (
        <span className="font-bold">{r.name}</span>
      ),
  },
  {
    key: "yes",
    label: "Said yes",
    numeric: true,
    sortValue: (r) => r.yes,
    render: (r) => <span className="font-bold tabular-nums">{formatInt(r.yes)}</span>,
  },
  {
    key: "answered",
    label: "Applications",
    numeric: true,
    sortValue: (r) => r.answered,
    render: (r) => <span className="tabular-nums">{formatInt(r.answered)}</span>,
  },
  {
    key: "share",
    label: "Share yes",
    numeric: true,
    sortValue: (r) => r.yes / r.answered,
    render: (r) => <span className="tabular-nums">{formatShareOf(r.yes, r.answered)}</span>,
  },
  {
    key: "certified",
    label: "Yes, certified",
    numeric: true,
    secondary: true,
    sortValue: (r) => r.certified,
    render: (r) => <span className="tabular-nums">{formatInt(r.certified)}</span>,
  },
];

const FACETS: Facet<LayoffEmployer>[] = [{ key: "band", label: "How many said yes", value: (r) => yesBand(r) }];

export function LayoffAnswersTable({ rows, fy, through }: { rows: LayoffEmployer[]; fy: number; through: string }) {
  const csv: CsvSpec<LayoffEmployer> = useMemo(
    () => ({
      filename: `perm-layoff-answers-fy${fy}-${through}.csv`,
      header: ["employer", "said_yes", "applications_answered", "share_yes", "yes_certified", "permtracker_url"],
      row: (r) => [
        r.name,
        r.yes,
        r.answered,
        Math.round((r.yes / r.answered) * 10000) / 10000,
        r.certified,
        r.slug ? `${SITE_URL}/perm-employers/${r.slug}` : null,
      ],
    }),
    [fy, through],
  );
  return (
    <FilterableStatTable<LayoffEmployer>
      rows={rows}
      columns={COLUMNS}
      searchText={(r) => r.name}
      searchPlaceholder="Search by employer"
      initialSort="yes"
      caption={`Employers whose PERM applications decided in fiscal year ${fy} reported a layoff, through ${through}`}
      noun="employers"
      facets={FACETS}
      csv={csv}
      pageSize={25}
      queryFromUrl
      suggestText={(r) => r.name}
    />
  );
}
