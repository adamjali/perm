"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";

import { FilterableStatTable, type CsvSpec, type Facet, type StatColumn } from "@/components/tools/FilterableStatTable";
import type { StageCase } from "@/lib/turso/rfi";

/**
 * Every case at a review stage, browsable.
 *
 * The static page seeds this with the oldest rows so the list reads before
 * hydration and crawlers see real cases; the whole cohort arrives from
 * `/api/stage-cases` the first time someone searches, sorts, filters or pages
 * past the seed. Search covers the case number, the employer and the job
 * title; every column sorts; the one facet is the filing year, because
 * "which year's filings are stuck here" is the question the page answers.
 * "Days waiting" is filing date to today, the same arithmetic the stage
 * summary uses, so the table and the figure above it cannot disagree.
 */

export interface StageBrowserProps {
  slug: string;
  status: string;
  seed: StageCase[];
  totalCount: number;
  /** ISO date of the sweep that confirmed these statuses. */
  asOf: string | null;
}

interface StageFeed {
  rows: StageCase[];
}

const DAY_MS = 86_400_000;

function daysWaiting(filingDate: string | null): number | null {
  if (!filingDate || !/^\d{4}-\d{2}-\d{2}/.test(filingDate)) return null;
  const t = Date.parse(`${filingDate.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

const int = (n: number) => n.toLocaleString("en-US");

const LINK = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

const COLUMNS: StatColumn<StageCase>[] = [
  {
    key: "case",
    label: "Case number",
    sortValue: (r) => r.caseNumber,
    render: (r) => (
      <Link href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`} className={`font-mono text-sm font-bold ${LINK}`}>
        {r.caseNumber}
      </Link>
    ),
  },
  {
    key: "employer",
    label: "Employer",
    sortValue: (r) => r.employer,
    render: (r) =>
      r.employer && r.employerSlug ? (
        <Link href={`/perm-employers/${r.employerSlug}`} className={LINK}>
          {r.employer}
        </Link>
      ) : (
        <span>{r.employer ?? ""}</span>
      ),
  },
  {
    key: "title",
    label: "Job title",
    sortValue: (r) => r.jobTitle,
    render: (r) => <span className="text-foreground/80">{r.jobTitle ?? ""}</span>,
    secondary: true,
  },
  {
    key: "filed",
    label: "Filed",
    sortValue: (r) => r.filingDate,
    render: (r) => <span className="tabular-nums">{r.filingDate ?? ""}</span>,
  },
  {
    key: "days",
    label: "Days waiting",
    numeric: true,
    sortValue: (r) => daysWaiting(r.filingDate),
    render: (r) => {
      const d = daysWaiting(r.filingDate);
      return <span className="tabular-nums">{d === null ? "" : int(d)}</span>;
    },
  },
];

const FACETS: Facet<StageCase>[] = [
  {
    key: "year",
    label: "Filed in",
    value: (r) => (r.filingDate ? r.filingDate.slice(0, 4) : null),
  },
];

export function StageCaseBrowser({ slug, status, seed, totalCount, asOf }: StageBrowserProps) {
  const loadAll = useCallback(async () => {
    const res = await fetch(`/api/stage-cases?stage=${encodeURIComponent(slug)}`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`stage feed ${res.status}`);
    const body = (await res.json()) as StageFeed;
    return body.rows;
  }, [slug]);

  const csv: CsvSpec<StageCase> = useMemo(
    () => ({
      filename: `perm-${slug}${asOf ? `-${asOf}` : ""}.csv`,
      header: ["case_number", "filing_date", "employer", "job_title", "status", "days_waiting", "permtracker_url"],
      row: (r) => [
        r.caseNumber,
        r.filingDate,
        r.employer,
        r.jobTitle,
        status,
        daysWaiting(r.filingDate),
        `https://permtracker.app/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`,
      ],
    }),
    [slug, status, asOf],
  );

  return (
    <FilterableStatTable<StageCase>
      rows={seed}
      totalCount={totalCount}
      loadAll={loadAll}
      columns={COLUMNS}
      searchText={(r) => `${r.caseNumber} ${r.employer ?? ""} ${r.jobTitle ?? ""}`}
      searchPlaceholder="Search by case number, employer or job title"
      initialSort="days"
      caption={`Every PERM case at ${status.toLowerCase()}, from DOL's live record${asOf ? ` as of ${asOf}` : ""}`}
      noun="cases"
      facets={FACETS}
      csv={csv}
      pageSize={50}
    />
  );
}
