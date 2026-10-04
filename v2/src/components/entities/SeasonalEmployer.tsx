import { Fragment } from "react";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { formatInt } from "@/lib/format";
import { publishedStatusLabel, wagePhrase, worksitePhrase } from "@/lib/seasonalDetails";
import { seasonalVisas } from "@/lib/seasonalForms";
import type {
  SeasonalEmployerCase,
  SeasonalEmployerFigures,
  SeasonalEmployerRecord,
} from "@/lib/turso/seasonalEmployers";

/**
 * An employer's page when its only filings are H-2A, H-2B or CW-1.
 *
 * The ordinary employer page is built from PERM's disclosure files (approval
 * rate, rank, median days), and none of that exists for an employer that never
 * filed a PERM case, so none of it appears here, not even as a dash. What it
 * shows is the record we hold: its seasonal filings by visa, the ones still
 * open, the workers DOL certified and the hourly wage offered, then each case
 * with DOL's status and, once decided, what the quarterly file printed.
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

function visaMix(r: SeasonalEmployerRecord): string {
  const parts = [
    r.h2a ? `${formatInt(r.h2a)} H-2A` : null,
    r.h2b ? `${formatInt(r.h2b)} H-2B` : null,
    r.cw1 ? `${formatInt(r.cw1)} CW-1` : null,
  ].filter(Boolean);
  return parts.join(", ");
}

function statusText(c: SeasonalEmployerCase): string {
  return c.source === "file" ? publishedStatusLabel(c.status) : c.status.charAt(0) + c.status.slice(1).toLowerCase();
}

export function SeasonalEmployer({
  record,
  figures,
  cases,
  more,
  asOf,
}: {
  record: SeasonalEmployerRecord;
  figures: SeasonalEmployerFigures;
  /** The newest cases, already capped by the caller. */
  cases: SeasonalEmployerCase[];
  /** More cases exist than are listed. */
  more: boolean;
  /** As-of date of the live seasonal record, ISO. */
  asOf: string | null;
}) {
  const first = longDate(record.firstFiled);
  const wage = wagePhrase(figures.medianHourlyWage, "HOUR");
  const stats = [
    { k: "Filings we hold", v: formatInt(record.cases), sub: visaMix(record) },
    {
      k: "Still open",
      v: formatInt(figures.pending),
      sub: figures.published ? `${formatInt(figures.published)} in DOL's published files` : "none published yet",
    },
    {
      k: "Workers certified",
      v: figures.workersCertified != null ? formatInt(figures.workersCertified) : "None yet",
      sub: "across its published decisions",
    },
    {
      k: "Typical hourly wage",
      v: wage ?? "Not published",
      sub: wage ? `median of ${formatInt(figures.hourlyN)} published filings paid by the hour` : "no hourly wage in DOL's files yet",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />

      <header className="max-w-3xl">
        <h1 translate="no" className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          {record.name}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {formatInt(record.cases)} {seasonalVisas(record)} {record.cases === 1 ? "filing" : "filings"} in DOL&apos;s
          records{first ? `, the first filed ${first}` : ""}. Name as DOL prints it on the application.
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

      <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-xl font-black sm:text-2xl">
          {more ? `The newest ${formatInt(cases.length)} filings` : `All ${formatInt(cases.length)} ${cases.length === 1 ? "filing" : "filings"}`}
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
            <Link href={`/case-search?q=${encodeURIComponent(record.name)}`} className={LINK}>
              Every filing under this name
            </Link>{" "}
            is in the case search, with filters and a CSV.
          </p>
        ) : null}{" "}
        <p className="mt-5 border-t-2 border-border pt-3 font-mono text-sm font-bold uppercase tracking-wider text-foreground/60">
          {asOf ? `DOL live case record, as of ${longDate(asOf) ?? asOf}` : "DOL live case record"}
        </p>
      </section>{" "}

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Waiting on one of these?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            The{" "}
            <Link href="/perm-case-status" className={LINK}>
              case-number lookup
            </Link>{" "}
            asks DOL live, shows when DOL usually decides, and can email you when the status changes.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Every H-2A, H-2B and CW-1 employer</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            <Link href="/seasonal-cases" className={LINK}>
              Search the seasonal filings
            </Link>{" "}
            by employer, job title or filing month.
          </p>
        </div>
      </section>{" "}

      <DataProvenance datasets={["seasonal-status", "h2a-disclosure", "h2b-disclosure", "cw1-disclosure"]} />
    </div>
  );
}
