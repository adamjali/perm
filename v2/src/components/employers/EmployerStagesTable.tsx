"use client";

import Link from "next/link";
import { useMemo } from "react";

import { FilterableStatTable, type CsvSpec, type StatColumn } from "@/components/tools/FilterableStatTable";
import type { EmployerStageRow } from "@/lib/employerStages";

/**
 * Every employer with pending PERM cases, by what DOL has pulled aside.
 *
 * The rows are the whole document the sweep wrote (employers with five or
 * more pending cases), so search and sort are local and instant. The default
 * order is cases pulled aside, most first, which is the "who's next" reading;
 * the share column sorts too, and the page above ranks share separately with
 * its floor stated, because a column sort would put two-of-two at the top.
 */

const HOLD = "APPLICATION ON HOLD";
const RFI = "RFI ISSUED";
const APPEALS = ["RECONSIDERATION APPEALS", "BALCA APPEALS", "REQUEST FOR REVIEW"];

const int = (n: number) => n.toLocaleString("en-US");
const pct = (x: number) => `${(x * 100).toFixed(x >= 0.1 ? 0 : 1)}%`;
const at = (r: EmployerStageRow, s: string) => r.byStatus[s] ?? 0;
const appeals = (r: EmployerStageRow) => APPEALS.reduce((a, s) => a + at(r, s), 0);
const other = (r: EmployerStageRow) => r.review - at(r, HOLD) - at(r, RFI) - appeals(r);

const LINK = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

const COLUMNS: StatColumn<EmployerStageRow>[] = [
  {
    key: "name",
    label: "Employer",
    sortValue: (r) => r.name,
    render: (r) =>
      r.slug ? (
        <Link href={`/perm-employers/${r.slug}`} className={`font-bold ${LINK}`}>
          {r.name}
        </Link>
      ) : (
        <span className="font-bold">{r.name}</span>
      ),
  },
  { key: "pending", label: "Pending", numeric: true, sortValue: (r) => r.pending, render: (r) => <span className="tabular-nums">{int(r.pending)}</span> },
  {
    key: "review",
    label: "Pulled aside",
    numeric: true,
    sortValue: (r) => r.review,
    render: (r) => <span className="font-bold tabular-nums">{int(r.review)}</span>,
  },
  { key: "hold", label: "On hold", numeric: true, sortValue: (r) => at(r, HOLD), render: (r) => <span className="tabular-nums">{int(at(r, HOLD))}</span> },
  { key: "rfi", label: "RFI", numeric: true, sortValue: (r) => at(r, RFI), render: (r) => <span className="tabular-nums">{int(at(r, RFI))}</span> },
  { key: "appeals", label: "Appeals", numeric: true, sortValue: (r) => appeals(r), render: (r) => <span className="tabular-nums">{int(appeals(r))}</span>, secondary: true },
  { key: "other", label: "Other review", numeric: true, sortValue: (r) => other(r), render: (r) => <span className="tabular-nums">{int(other(r))}</span>, secondary: true },
  { key: "share", label: "Share of pending", numeric: true, sortValue: (r) => r.share, render: (r) => <span className="tabular-nums">{pct(r.share)}</span> },
];

export function EmployerStagesTable({ rows, asOf }: { rows: EmployerStageRow[]; asOf: string }) {
  const csv: CsvSpec<EmployerStageRow> = useMemo(
    () => ({
      filename: `perm-employers-under-review-${asOf}.csv`,
      header: ["employer", "pending", "pulled_aside", "on_hold", "rfi", "appeals", "other_review", "share_of_pending", "permtracker_url"],
      row: (r) => [
        r.name,
        r.pending,
        r.review,
        at(r, HOLD),
        at(r, RFI),
        appeals(r),
        other(r),
        r.share,
        r.slug ? `https://permtracker.app/perm-employers/${r.slug}` : null,
      ],
    }),
    [asOf],
  );
  return (
    <FilterableStatTable<EmployerStageRow>
      rows={rows}
      columns={COLUMNS}
      searchText={(r) => r.name}
      searchPlaceholder="Search by employer"
      initialSort="review"
      caption={`Employers with five or more pending PERM cases, by cases DOL has pulled aside, as of ${asOf}`}
      noun="employers"
      csv={csv}
      pageSize={50}
    />
  );
}
