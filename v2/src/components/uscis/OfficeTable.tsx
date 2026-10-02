"use client";

import { FilterableStatTable, type Facet, type StatColumn } from "@/components/tools/FilterableStatTable";
import { SERVICE_CENTER_STATE, quartersOfWork, type OfficeRow } from "@/lib/uscisQuarterlyShape";
import { formatInt } from "@/lib/format";

/** USCIS withholds a small cell; it prints as "withheld", as on the rest of the page, never as 0. */
const count = (n: number | null) => (n === null ? "withheld" : formatInt(n));

export const OFFICE_COLUMNS: StatColumn<OfficeRow>[] = [
  { key: "office", label: "Office", sortValue: (r) => r.office, render: (r) => <span className="font-semibold">{r.office}</span> },
  { key: "state", label: "State", sortValue: (r) => r.state, render: (r) => r.state },
  { key: "code", label: "Code", sortValue: (r) => r.code, render: (r) => <span className="font-mono">{r.code}</span>, secondary: true },
  { key: "received", label: "EB received", numeric: true, sortValue: (r) => r.empReceived, render: (r) => count(r.empReceived), secondary: true },
  { key: "approved", label: "EB approved", numeric: true, sortValue: (r) => r.empApproved, render: (r) => count(r.empApproved) },
  { key: "denied", label: "EB denied", numeric: true, sortValue: (r) => r.empDenied, render: (r) => count(r.empDenied), secondary: true },
  { key: "pending", label: "EB pending", numeric: true, sortValue: (r) => r.empPending, render: (r) => <span className="font-bold">{count(r.empPending)}</span> },
  {
    key: "quarters",
    label: "Quarters of work",
    numeric: true,
    sortValue: (r) => quartersOfWork(r),
    render: (r) => {
      const q = quartersOfWork(r);
      return q === null ? "" : q.toFixed(1);
    },
  },
  { key: "family", label: "Family pending", numeric: true, sortValue: (r) => r.famPending, render: (r) => count(r.famPending), secondary: true },
];

export const OFFICE_FACETS: Facet<OfficeRow>[] = [
  { key: "kind", label: "Kind", value: (r) => (r.state === SERVICE_CENTER_STATE ? "center" : "office"), format: (v) => (v === "center" ? "Service centers" : "Field offices") },
  { key: "state", label: "State", value: (r) => (r.state === SERVICE_CENTER_STATE ? null : r.state) },
];

/**
 * Every office and service center in one table: search by name, city or
 * code, filter by state or kind, sort on any column. Every row is on the page
 * (a page size of all), so the whole list stays readable with no script and
 * in the markup a crawler reads.
 */
export function OfficeTable({ rows }: { rows: OfficeRow[] }) {
  return (
    <FilterableStatTable
      rows={rows}
      columns={OFFICE_COLUMNS}
      searchText={(r) => `${r.office} ${r.state} ${r.code}`}
      searchPlaceholder="Office, state or code"
      initialSort="pending"
      caption="Every USCIS field office and service center, employment-based I-485 counts for the quarter"
      noun="offices"
      facets={OFFICE_FACETS}
      pageSize={0}
      csv={{
        filename: "i485-by-field-office.csv",
        header: ["office", "state", "code", "eb_received", "eb_approved", "eb_denied", "eb_pending", "family_pending"],
        row: (r) => [r.office, r.state, r.code, r.empReceived, r.empApproved, r.empDenied, r.empPending, r.famPending],
      }}
    />
  );
}
