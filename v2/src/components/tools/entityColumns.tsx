"use client";

import Link from "next/link";

import { approvalRate, type EntityRow } from "@/lib/entityPayload";
import { socGroup } from "@/lib/socGroups";
import { stateName } from "@/lib/usStateNames";

import type { CsvSpec, Facet, StatColumn } from "./FilterableStatTable";

/**
 * Column, facet and CSV definitions for the three entity indexes.
 *
 * They sit together because they are three views of one row shape and the
 * differences between them are small and worth seeing side by side. Each
 * index used to carry its own near-identical copy.
 */

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtPct(r: EntityRow): string {
  const a = approvalRate(r);
  return a === null ? "—" : `${(a * 100).toFixed(1)}%`;
}

function fmtWage(n: number | null): string {
  return n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
}

function fmtDays(n: number | null): string {
  return n == null ? "—" : fmtInt(Math.round(n));
}

const rankCol: StatColumn<EntityRow> = {
  key: "rank",
  label: "#",
  numeric: true,
  // Hidden on a phone. The table has a 560px minimum and a 390px viewport
  // shows whatever fits, so the rank column was occupying the space where
  // the filing count belongs. The list is sorted by volume by default, so
  // position is legible from the order; the count is not legible from
  // anything, and it is the number people came for.
  secondary: true,
  sortValue: (e) => e.rank,
  render: (e) => <span className="text-muted-foreground">{e.rank}</span>,
};

function nameCol(base: string, label: string): StatColumn<EntityRow> {
  return {
    key: "name",
    label,
    sortValue: (e) => e.name,
    // Every stored entity has a page now (sub-floor ones render on demand
    // and carry noindex), so every row links. The old unlinked branch existed
    // because those pages 404ed - which turned a search hit into a dead end.
    render: (e) => (
      <Link
        href={`${base}/${e.slug}`}
        className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
      >
        {e.name}
      </Link>
    ),
  };
}

const stateCol: StatColumn<EntityRow> = {
  key: "state",
  label: "State",
  secondary: true,
  sortValue: (e) => e.state,
  render: (e) =>
    e.state ? (
      <span className="font-mono text-xs font-bold">{e.state}</span>
    ) : (
      <span className="text-muted-foreground">—</span>
    ),
};

const totalCol: StatColumn<EntityRow> = {
  key: "total",
  label: "Filings",
  numeric: true,
  sortValue: (e) => e.total,
  render: (e) => fmtInt(e.total),
};

const certifiedCol: StatColumn<EntityRow> = {
  key: "certified",
  label: "Certified",
  numeric: true,
  secondary: true,
  sortValue: (e) => e.certified,
  render: (e) => fmtInt(e.certified),
};

const deniedCol: StatColumn<EntityRow> = {
  key: "denied",
  label: "Denied",
  numeric: true,
  secondary: true,
  sortValue: (e) => e.denied,
  render: (e) =>
    e.denied > 0 ? (
      <span className="font-bold text-data-bad-ink">{fmtInt(e.denied)}</span>
    ) : (
      "0"
    ),
};

const approvalCol: StatColumn<EntityRow> = {
  key: "approval",
  label: "Approval",
  numeric: true,
  sortValue: (e) => approvalRate(e),
  render: (e) => fmtPct(e),
};

const daysCol: StatColumn<EntityRow> = {
  key: "days",
  label: "Median days",
  numeric: true,
  secondary: true,
  sortValue: (e) => e.medianDays,
  render: (e) => fmtDays(e.medianDays),
};

const wageCol: StatColumn<EntityRow> = {
  key: "wage",
  label: "Median wage",
  numeric: true,
  sortValue: (e) => e.medianAnnualWage,
  render: (e) => fmtWage(e.medianAnnualWage),
};

export const stateFacet: Facet<EntityRow> = {
  key: "state",
  label: "State",
  value: (e) => e.state,
  // A middle dot, not an em-dash: house style bans the em-dash in copy and
  // an option label is copy. My own rendered audit caught this one.
  format: (v) => `${v} · ${stateName(v)}`,
};

export const socFacet: Facet<EntityRow> = {
  key: "family",
  label: "Job family",
  value: (e) => socGroup(e.code),
};

export const EMPLOYER_COLUMNS: StatColumn<EntityRow>[] = [
  rankCol,
  nameCol("/perm-employers", "Employer"),
  stateCol,
  totalCol,
  certifiedCol,
  deniedCol,
  approvalCol,
  daysCol,
];

export const ATTORNEY_COLUMNS: StatColumn<EntityRow>[] = [
  rankCol,
  nameCol("/perm-attorneys", "Law firm"),
  stateCol,
  totalCol,
  certifiedCol,
  deniedCol,
  approvalCol,
  daysCol,
];

export const OCCUPATION_COLUMNS: StatColumn<EntityRow>[] = [
  rankCol,
  {
    key: "name",
    label: "Occupation",
    sortValue: (e) => e.name,
    render: (e) => (
      <span className="font-bold">
        <Link
          href={`/perm-wages/${e.slug}`}
          className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
        >
          {e.name}
        </Link>{" "}
        <span className="font-mono text-xs font-normal text-muted-foreground">
          {e.code ?? ""}
        </span>
      </span>
    ),
  },
  totalCol,
  wageCol,
  approvalCol,
  deniedCol,
  daysCol,
];

function csvFor(
  filename: string,
  nameHeader: string,
  withWage: boolean,
): CsvSpec<EntityRow> {
  return {
    filename,
    header: [
      "rank",
      nameHeader,
      withWage ? "soc_code" : "state",
      "filings",
      "certified",
      "denied",
      "approval_rate",
      "median_days",
      ...(withWage ? ["median_annual_wage"] : []),
      "permtracker_url",
    ],
    row: (e) => {
      const a = approvalRate(e);
      const base = withWage ? "/perm-wages" : filename.includes("law") ? "/perm-attorneys" : "/perm-employers";
      return [
        e.rank,
        e.name,
        withWage ? e.code : e.state,
        e.total,
        e.certified,
        e.denied,
        a === null ? null : Number((a * 100).toFixed(2)),
        e.medianDays === null ? null : Math.round(e.medianDays),
        ...(withWage ? [e.medianAnnualWage === null ? null : Math.round(e.medianAnnualWage)] : []),
        `https://permtracker.app${base}/${e.slug}`,
      ];
    },
  };
}

export const EMPLOYER_CSV = csvFor("perm-employers.csv", "employer", false);
export const ATTORNEY_CSV = csvFor("perm-law-firms.csv", "law_firm", false);
export const OCCUPATION_CSV = csvFor("perm-occupations.csv", "occupation", true);
