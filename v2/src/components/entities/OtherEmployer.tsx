import { Fragment, type ReactNode } from "react";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { formatInt } from "@/lib/format";
import { hasSeasonal, otherEmployerDatasets, programsMix } from "@/lib/otherEmployers";
import { publishedStatusLabel, wagePhrase, worksitePhrase } from "@/lib/seasonalDetails";
import type { OtherEmployerRecord } from "@/lib/turso/otherEmployers";
import type { SeasonalEmployerCase } from "@/lib/turso/seasonalEmployers";

/**
 * An employer's page when it has no PERM record: its filings are H-1B LCAs,
 * wage requests, or H-2A, H-2B and CW-1 applications.
 *
 * The PERM employer page is built from PERM's disclosure files (approval
 * rate, rank, median days), and none of that exists here, so none of it
 * appears, not even as a dash. What it shows is the record we hold: what it
 * files, what is still open, the program ledger, its newest filings, and what
 * its LCAs were for and what USCIS then decided. The sections come in as
 * slots, so each is the same component the PERM page renders.
 */

const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

function longDate(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function statusText(c: SeasonalEmployerCase): string {
  return c.source === "file" ? publishedStatusLabel(c.status) : c.status.charAt(0) + c.status.slice(1).toLowerCase();
}

/** The H-2A, H-2B and CW-1 cases, live status beside what DOL's file printed. */
function SeasonalCaseList({
  record,
  cases,
  more,
  asOf,
}: {
  record: OtherEmployerRecord;
  cases: SeasonalEmployerCase[];
  more: boolean;
  asOf: string | null;
}) {
  if (cases.length === 0) return null;
  return (
    <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
      <h2 className="font-heading text-xl font-black sm:text-2xl">
        {more
          ? `Its newest ${formatInt(cases.length)} H-2A, H-2B and CW-1 filings`
          : `Its ${formatInt(cases.length)} H-2A, H-2B and CW-1 ${cases.length === 1 ? "filing" : "filings"}`}
      </h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
        DOL&apos;s live status on each, and, once a case is decided, the wage, workers and worksite from its
        quarterly file. Each number opens the case.
      </p>
      <ul className="mt-4 divide-y divide-border/60">
        {cases.map((c) => {
          const pay = wagePhrase(c.wage, c.wageUnit);
          const place = worksitePhrase(c.worksiteCity, null, c.worksiteState);
          const workers =
            c.workersCertified != null
              ? `${formatInt(c.workersCertified)} of ${formatInt(c.workers ?? c.workersCertified)} workers certified`
              : c.workers != null
                ? `${formatInt(c.workers)} workers requested`
                : null;
          const detail = [
            c.filed ? `filed ${longDate(c.filed)}` : null,
            c.decided ? `decided ${longDate(c.decided)}` : null,
            workers,
            pay,
            place,
          ].filter(Boolean);
          return (
            <Fragment key={c.caseNumber}>
              {" "}
              <li className="py-3 text-base">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <Link
                    href={`/perm-case-status?case=${encodeURIComponent(c.caseNumber)}`}
                    className={`-my-3 inline-block py-3 font-mono text-sm ${LINK}`}
                  >
                    {c.caseNumber}
                  </Link>{" "}
                  {c.form ? <span className="text-sm text-foreground/70">{c.form}</span> : null}{" "}
                  <span className="ml-auto text-sm font-bold">{statusText(c)}</span>
                </div>{" "}
                {c.jobTitle ? <p className="mt-0.5 text-foreground/80">{c.jobTitle}</p> : null}{" "}
                {detail.length ? <p className="mt-0.5 text-sm text-foreground/70">{detail.join(" · ")}</p> : null}
              </li>
            </Fragment>
          );
        })}
      </ul>{" "}
      {more ? (
        <p className="mt-4 text-base text-foreground/80">
          <Link href={`/seasonal-cases?q=${encodeURIComponent(record.name)}`} className={LINK}>
            Every seasonal filing under this name
          </Link>{" "}
          is in the seasonal search.
        </p>
      ) : null}{" "}
      <p className="mt-5 border-t-2 border-border pt-3 font-mono text-sm font-bold uppercase tracking-wider text-foreground/60">
        {asOf ? `DOL live case record, as of ${longDate(asOf) ?? asOf}` : "DOL live case record"}
      </p>
    </section>
  );
}

export function OtherEmployer({
  record,
  pending,
  ledger,
  filings,
  seasonalCases,
  seasonalMore,
  seasonalAsOf,
  h1b,
}: {
  record: OtherEmployerRecord;
  /** Open cases across its programs in DOL's live record; null when the live record couldn't be read. */
  pending: number | null;
  /** The program ledger (EmployerPrograms), already built by the caller. */
  ledger: ReactNode;
  /** Its newest wage requests and LCAs (WageAndLcaFilings). */
  filings: ReactNode;
  seasonalCases: SeasonalEmployerCase[];
  seasonalMore: boolean;
  /** As-of date of the live seasonal record, ISO. */
  seasonalAsOf: string | null;
  /** What its LCAs were for, what USCIS decided, the lottery: the PERM page's own sections. */
  h1b: ReactNode;
}) {
  const first = longDate(record.firstFiled);
  const last = longDate(record.lastChanged);
  const mix = programsMix(record, formatInt);
  const stats = [
    { k: "Filings we hold", v: formatInt(record.cases), sub: mix },
    {
      k: "Still open",
      v: pending === null ? "Unknown" : formatInt(pending),
      sub: pending === null ? "DOL's live record couldn't be read just now" : "in DOL's live record",
    },
    { k: "First filed", v: record.firstFiled?.slice(0, 4) ?? "Unknown", sub: first ?? "no filing date published" },
    { k: "Latest activity", v: record.lastChanged?.slice(0, 4) ?? "Unknown", sub: last ?? "no date published" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />

      <header className="max-w-3xl">
        <h1 translate="no" className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          {record.name}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {mix} in DOL&apos;s records{first ? `, the first filed ${first}` : ""}.{" "}
          {record.perm > 0
            ? `It also filed ${formatInt(record.perm)} PERM ${record.perm === 1 ? "case" : "cases"} in DOL's FY2016 to FY2023 files, and none since.`
            : "No PERM green-card case under this name is in DOL's files or its live record."}{" "}
          Name as DOL prints it on the forms.
        </p>
      </header>{" "}

      <section className="pop mt-8">
        <div className="grid grid-cols-1 gap-px border-2 border-border bg-border sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          {stats.map((d) => (
            <Fragment key={d.k}>
              {" "}
              <div className="bg-card p-5">
                <p className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/60">{d.k}</p>{" "}
                <p className="mt-1.5 font-heading text-2xl font-black tabular-nums">{d.v}</p>{" "}
                {d.sub ? <p className="mt-1 text-sm text-foreground/70">{d.sub}</p> : null}
              </div>
            </Fragment>
          ))}
        </div>
      </section>{" "}

      {ledger}{" "}
      {filings}{" "}
      {hasSeasonal(record) ? (
        <SeasonalCaseList record={record} cases={seasonalCases} more={seasonalMore} asOf={seasonalAsOf} />
      ) : null}{" "}
      {h1b}{" "}

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Waiting on one of these?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            The{" "}
            <Link href="/perm-case-status" className={LINK}>
              case-number lookup
            </Link>{" "}
            asks DOL live and can email you when the status changes.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Every filing under this name</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            <Link href={`/case-search?q=${encodeURIComponent(record.name)}`} className={LINK}>
              The case search
            </Link>{" "}
            holds them all, live and published together, with filters and a CSV.
          </p>
        </div>
      </section>{" "}

      <DataProvenance datasets={otherEmployerDatasets(record)} />
    </div>
  );
}
