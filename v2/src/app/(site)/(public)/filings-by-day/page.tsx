/**
 * How many cases were filed today, yesterday, this week, or on any day since FY2020, for PERM,
 * wage requests, H-1B LCAs and the seasonal programs (owner, Nov 5 2026: "is there a way to see
 * how many FILED on a day/daily/today/yesterday ... ez simple findable"). One count a day from
 * perm_docs['filings_by_day'] (scripts/build_filings_by_day.py, after each case-status pass):
 * DOL's live case-status service and its published files together, each case counted once.
 *
 * The page carries the last PAGE_WINDOW_DAYS in its HTML; the explorer asks
 * /api/filings-by-day for an older period. Each sweep expires it (/api/revalidate-sweep); the
 * six-hour window is the backstop.
 */

import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { FilingsExplorer } from "@/components/filings/FilingsExplorer";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { SearchParamsBoundary } from "@/hooks/useUrlSearchParams";
import { SITE_URL } from "@/lib/constants/site";
import { getFilingsByDay } from "@/lib/db/filingsByDay";
import {
  dayHref,
  FILING_PROGRAMS,
  PAGE_WINDOW_DAYS,
  periodTotal,
  PROGRAM_NAMES,
  shiftDay,
  usualFor,
  type FilingDay,
  type FilingProgram,
} from "@/lib/filingsByDay";
import { formatInt } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { getDatasetSchema } from "@/lib/structuredData";
import { longDate, weekdayName } from "@convex/lib/months";

const TITLE = "PERM Cases Filed Today and Each Day";
const DESCRIPTION =
  "How many PERM cases, wage requests and H-1B LCAs were filed today, yesterday and each day since 2019, from DOL's own records.";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/filings-by-day" },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/filings-by-day" },
  },
  "filings-by-day",
);

export const revalidate = 21600;

const easternTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

function compare(n: number, usual: number | null): string | null {
  if (usual === null || usual === 0) return null;
  const share = n / usual;
  if (share >= 0.9 && share <= 1.1) return `about the usual ${formatInt(usual)} for that weekday`;
  return `against a usual ${formatInt(usual)}`;
}

export default async function FilingsByDayPage() {
  const doc = await getFilingsByDay();
  const schema = getDatasetSchema(SITE_URL, {
    name: "Immigration filings per day",
    description: DESCRIPTION,
    url: `${SITE_URL}/filings-by-day`,
    isBasedOn: "https://flag.dol.gov/case-status-search",
  });

  if (!doc) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-12">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Cases filed each day</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          The daily counts haven&apos;t been written yet. They&apos;re counted after each check of DOL&apos;s case-status service.
        </p>
      </div>
    );
  }

  const today = doc.asOf;
  const yesterday = shiftDay(today, -1);
  const windowFrom = shiftDay(today, -(PAGE_WINDOW_DAYS - 1));
  const windowed = {} as Record<FilingProgram, FilingDay[]>;
  for (const p of FILING_PROGRAMS) windowed[p] = doc.programs[p].days.filter((d) => d.day >= windowFrom);
  const at = (p: FilingProgram, d: string) => doc.programs[p].days.find((x) => x.day === d)?.filed ?? 0;
  const summary = (p: FilingProgram) => ({
    today: at(p, today),
    yesterday: at(p, yesterday),
    week: periodTotal(doc.programs[p].days, shiftDay(today, -6), today).filed,
    month: periodTotal(doc.programs[p].days, shiftDay(today, -29), today).filed,
  });
  const perm = summary("perm");
  const permDays = doc.programs.perm.days;
  const checked = easternTime(doc.computedAt);

  const tiles = [
    { key: "today", n: perm.today, claim: "PERM cases filed today so far", sub: `As of ${checked}; it grows as the day's filings are found.`, href: dayHref(today) },
    { key: "yesterday", n: perm.yesterday, claim: "Filed yesterday", sub: [weekdayName(yesterday), compare(perm.yesterday, usualFor(permDays, yesterday))].filter(Boolean).join(", "), href: dayHref(yesterday) },
    { key: "week", n: perm.week, claim: "Filed in the last 7 days", sub: `${longDate(shiftDay(today, -6))} to today` },
    { key: "month", n: perm.month, claim: "Filed in the last 30 days", sub: `${longDate(shiftDay(today, -29))} to today` },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={schema} />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Cases filed each day</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          How many PERM cases, wage requests, H-1B LCAs and H-2A, H-2B and CW-1 filings reached DOL on each day, from its
          live case-status service and its published files.
        </p>
      </header>{" "}
      <section aria-label="PERM filings now" className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4 [&>*]:min-w-0">
        {tiles.map((t) => (
          <div key={t.key} className="flex flex-col bg-tint p-5">
            <p className="font-heading text-4xl font-bold leading-none tabular-nums">{formatInt(t.n)}</p>{" "}
            <p className="mt-2 text-lg font-bold">{t.claim}</p>{" "}
            {t.sub ? <p className="mt-1 text-base text-soft">{t.sub}</p> : null}{" "}
            {t.href ? (
              <Link href={t.href} className="link mt-auto inline-flex min-h-11 items-center pt-2 text-base font-semibold">
                See each case
              </Link>
            ) : null}
          </div>
        ))}
      </section>{" "}
      <section aria-labelledby="every-program" className="mt-10">
        <h2 id="every-program" className="font-heading text-2xl font-bold">
          Every program
        </h2>{" "}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">Filings by program, today so far, yesterday, the last 7 days and the last 30 days</caption>
            <thead>
              <tr className="border-b-2 border-foreground text-sm">
                <th scope="col" className="py-2">Program{" "}</th>
                <th scope="col" className="py-2 text-right">Today so far{" "}</th>
                <th scope="col" className="py-2 text-right">Yesterday{" "}</th>
                <th scope="col" className="py-2 text-right">Last 7 days{" "}</th>
                <th scope="col" className="py-2 text-right">Last 30 days{" "}</th>
              </tr>
            </thead>
            <tbody>
              {FILING_PROGRAMS.map((p) => {
                const s = summary(p);
                return (
                  <tr key={p} className="border-b border-border">
                    <th scope="row" className="py-2 font-semibold">{PROGRAM_NAMES[p].name}{" "}</th>
                    <td className="py-2 text-right font-mono tabular-nums">
                      <Link href={dayHref(today, p)} className="link inline-flex min-h-11 items-center justify-end">{formatInt(s.today)}</Link>{" "}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      <Link href={dayHref(yesterday, p)} className="link inline-flex min-h-11 items-center justify-end">{formatInt(s.yesterday)}</Link>{" "}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatInt(s.week)}{" "}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatInt(s.month)}{" "}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>{" "}
      <section aria-labelledby="any-day" className="mt-12">
        <h2 id="any-day" className="font-heading text-2xl font-bold">
          Any day or period
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base text-soft">Pick a program and a period; each day opens its cases.</p>{" "}
        <div className="mt-5">
          <SearchParamsBoundary>
            <FilingsExplorer asOf={today} windowFrom={windowFrom} programs={windowed} />
          </SearchParamsBoundary>
        </div>
      </section>{" "}
      <FinePrint summary="How the days are counted" className="mt-12">
        <p>
          DOL holds each case twice: its live case-status service has every case it has indexed, pending ones included,
          and its quarterly files have decided cases only, reaching back further. A case is counted once, by its case
          number: on the live service&apos;s filing day when the service holds it, otherwise on the file&apos;s received day.
        </p>{" "}
        <p>
          &ldquo;Files give another day&rdquo; counts cases on a day whose published file dates them differently, most by a
          day. &ldquo;Only in DOL&apos;s published files&rdquo; counts decided cases the live service doesn&apos;t hold.
          Today&apos;s count grows through the day as new filings are found.
        </p>{" "}
        <p>
          The live record starts on{" "}
          {FILING_PROGRAMS.map((p, i) => (
            <Fragment key={p}>
              {i ? (i === FILING_PROGRAMS.length - 1 ? ", and " : ", ") : ""}
              {longDate(doc.programs[p].liveFrom) ?? "no day yet"} for {PROGRAM_NAMES[p].plural}
            </Fragment>
          ))}
          ; days before then come from the files alone.
        </p>
      </FinePrint>{" "}
      <DataProvenance datasets={["perm-case-status", "pwd-status", "lca-status", "seasonal-status", "perm-cases", "pw-disclosure", "lca-disclosure"]} />
    </div>
  );
}
