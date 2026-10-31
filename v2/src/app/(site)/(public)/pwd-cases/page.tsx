import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";

import { PageBasics } from "@/components/data/PageBasics";
import { IndexHeader, IndexLookup } from "@/components/data/IndexHeader";
import { FilingMonthBars } from "@/components/data/FilingMonthBars";
import { getProcessingTimes } from "@/lib/db/processingTimes";
import { dolPwdNow, pwdLine } from "@/lib/dolNow";
import { getPwdDayData, getPwdLine, getPwdNowDocs } from "@/lib/db/pwdDayQueue";
import { PwdNowBoard } from "@/components/pwd/PwdNowBoard";
import { waitPhrase } from "@/lib/pwdLine";
import { formatInt } from "@/lib/format";
import { FlagCaseBrowser, PWD_PROGRAM } from "@/components/tools/FlagCaseBrowser";
import { openGraphBase } from "@/lib/openGraphBase";
import { getPwdSummary, getPwdDisclosureSummary } from "@/lib/db/pwdCases";
import { SearchParamsBoundary } from "@/hooks/useUrlSearchParams";
import { longDate } from "@convex/lib/months";

/**
 * Prevailing wage requests, findable by employer before the PERM exists.
 *
 * WHY THIS PAGE. Nothing public lists PWD case numbers. The lawyer files the
 * ETA-9141, the applicant hears "the wage request is in", and months later
 * asks Reddit how to find the number so they can check it. The same trick
 * that answers that for PERM (employer, title, filing month) works here,
 * because DOL's case-status endpoint serves these and its serial counter
 * puts PWD filings in the windows the nightly prober already walks.
 *
 * TWO HALVES, ONE SEARCH. The live table (DOL's daily check) holds what the
 * prober has confirmed: status, pending included, wage never. DOL's quarterly
 * disclosure file holds every decided request with the wage DOL set, through
 * the last published quarter. The browser merges them, one row per case.
 */

const TITLE = "PWD Case Search and Status Tracking";
const DESCRIPTION =
  "Find a prevailing wage request (ETA-9141) by employer, job title and filing month: DOL's live status for pending ones, the wage DOL set for decided ones.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pwd-cases" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/pwd-cases",
  },
}, "pwd-cases");

// The table grows nightly; a day bounds the header counts' staleness under
// the data's own cadence. The lists themselves are fetched by the browser.
export const revalidate = 86400;

export default async function PwdCasesPage() {
  const [summary, disclosure, times, line, dayData, nowDocs] = await Promise.all([
    getPwdSummary(),
    getPwdDisclosureSummary(),
    getProcessingTimes().catch(() => null),
    getPwdLine(),
    getPwdDayData().catch(() => null),
    getPwdNowDocs(),
  ]);
  // DOL's own position in the PERM wage-request line: the month it is issuing
  // determinations on, from its processing-times page.
  const now = dolPwdNow(times);
  const frontier = (times?.pwdQueues ?? []).find((q) => q.program.toUpperCase() === "PERM")?.oewsReceiptDate ?? null;
  // DOL's other wage queues, the month each is on (its own table).
  const others = (times?.pwdQueues ?? [])
    .filter((q) => q.program.toUpperCase() !== "PERM")
    .map((q) => ({ program: q.program, month: q.oewsReceiptDate }));
  // Our own daily check of DOL's case status leads (src/lib/pwdLine.ts): DOL's
  // published month trails it by weeks, so it's the figure under it.
  const lineDay = line ? longDate(line.day) : null;
  const lede = line && lineDay
    ? `PERM wage requests take ${waitPhrase(line.waitDays)} at DOL now: requests filed ${lineDay} are being decided, by our daily check of DOL's case status.`
    : pwdLine(now);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <IndexHeader
        title="Find a prevailing wage request"
        lede={`${lede} Search by employer to find one: you rarely see its number.`}
        figures={[
          {
            label: "Waiting at DOL now",
            value: summary ? formatInt(summary.pending) : "—",
            note: "From DOL's case-status service",
          },
          {
            label: "Decided, with the wage set",
            value: disclosure ? formatInt(disclosure.rows) : "—",
            ...(longDate(disclosure?.latestDecision ?? null)
              ? { note: `Published through ${longDate(disclosure?.latestDecision ?? null)}` }
              : {}),
          },
          line && lineDay
            ? {
                label: "DOL is deciding requests filed on",
                value: lineDay,
                href: "/tools/pwd-calculator",
                note: `${Math.round(line.decidedShare * 100)}% of that day's ${formatInt(line.filed)} decided, our check of ${longDate(line.asOf)}${
                  now.frontier ? `. DOL's own figure${now.asOf ? ` of ${now.asOf}` : ""}: ${now.frontier}` : ""
                }`,
              }
            : {
                label: "DOL is deciding requests filed in",
                value: now.frontier ?? "—",
                href: "/tools/pwd-calculator",
                ...(now.asOf ? { note: `As of ${now.asOf}` } : {}),
              },
        ]}
        aside={
          <IndexLookup
            title="Have the number?"
            placeholder="P-100-26140-123456"
            note="DOL is asked live, and the case page can email you when it moves."
            source="pwd-cases"
          />
        }
      />{" "}

      <PwdNowBoard
        line={line}
        dayData={dayData}
        queue={nowDocs.queue}
        trend={nowDocs.trend}
        dol={{ frontier: now.frontier, asOf: now.asOf }}
        others={others}
        reviews={times?.pwdReviews ?? []}
      />{" "}

      <div className="mt-10">
        <SearchParamsBoundary>
          <FlagCaseBrowser
            summary={summary}
            disclosure={disclosure}
            program={PWD_PROGRAM}
            between={
              summary ? (
                <section >
                  <h2 className="font-heading text-xl font-bold">Where DOL is in the line</h2>{" "}
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Wage requests by the month they were filed, from DOL&apos;s case-status service.
                    {line && lineDay
                      ? ` By our check of ${longDate(line.asOf)}, DOL is deciding requests filed ${lineDay}${
                          line.before ? ` and has decided ${Math.round(line.before.decidedShare * 100)}% of ${longDate(line.before.day)}'s` : ""
                        }.`
                      : now.frontier
                        ? ` DOL is issuing determinations on ${now.frontier}.`
                        : ""}
                  </p>{" "}
                  <FilingMonthBars
                    className="mt-5"
                    months={summary.byMonth}
                    frontier={line ? line.day.slice(0, 7) : frontier}
                    nouns="wage requests"
                    label="Wage requests by filing month, decided and still waiting"
                  />
                </section>
              ) : null
            }
          />
        </SearchParamsBoundary>
      </div>

      <PageBasics page="pwd-cases" />{" "}
    </div>
  );
}
