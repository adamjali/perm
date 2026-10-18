import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { longDate } from "@convex/lib/months";
import { FILING_WINDOW_CLOSE_DAYS, FILING_WINDOW_WAIT_DAYS } from "@convex/lib/perm/constants";
import { BarRows } from "@/components/data/BarRows";
import { ChartTips } from "@/components/data/ChartTips";
import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { getRecruitmentSummary, type Paper, type RecruitmentSummary, type Spread } from "@/lib/db/recruitment";
import { formatInt, formatShareOf } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { LEAD_BANDS, NOTICE_METHODS, RECRUITMENT_STEPS } from "@/lib/recruitmentRecord";
import { withSocialCard } from "@/lib/socialCard";
import { stateName } from "@/lib/usStateNames";

/**
 * Where and when PERM employers recruit, nationally: DOL's Form 9089 Section H
 * over every decided case filed on its current form, from
 * perm_docs['recruitment_summary']. Each employer's, law firm's and job's own
 * figures are on its page (`RecruitmentMix`).
 */

const TITLE = "PERM Recruitment: Ads, Steps and Timing";
const DESCRIPTION =
  "Where PERM employers advertise and how far ahead of filing they recruit: Sunday ads, newspapers by state, extra steps and the notice, from DOL's records.";
const PATH = "/perm-recruitment";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: PATH },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
  },
  "perm-recruitment",
);

// Rebuilt with each quarterly disclosure load, which expires the page.
export const revalidate = 604800;

/** The rows of the timing chart: when each recorded step ran, in days before filing. */
const TIMING: { key: keyof RecruitmentSummary["lead"]; label: string }[] = [
  { key: "firstStep", label: "First recruitment step" },
  { key: "secondAd", label: "Second Sunday ad" },
  { key: "jobOrderEnd", label: "Job order's last day" },
  { key: "lastStep", label: "Last recruitment step" },
];

/** The chart's reach, in days before filing: past the rule's limit, so cases outside it show. */
const AXIS_DAYS = 210;
const AXIS_TICKS = [180, 150, 120, 90, 60, 30, 0];

/** Left edge is the earliest day, right edge the filing: time runs toward the filing. */
const at = (days: number) => `${(1 - Math.min(days, AXIS_DAYS) / AXIS_DAYS) * 100}%`;

function TimingChart({ lead }: { lead: RecruitmentSummary["lead"] }) {
  const rows = TIMING.flatMap((t) => (lead[t.key] ? [{ ...t, s: lead[t.key] as Spread }] : []));
  const windowLeft = at(FILING_WINDOW_CLOSE_DAYS);
  const windowWidth = `${((FILING_WINDOW_CLOSE_DAYS - FILING_WINDOW_WAIT_DAYS) / AXIS_DAYS) * 100}%`;
  return (
    <>
      <ChartTips label="Days before filing each step ran">
        <ol className="mt-6 space-y-5">
          {rows.map(({ key, label, s }) => (
            <Fragment key={key}>
              {" "}
              <li
                className="grid grid-cols-1 gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center sm:gap-4"
                data-tip={`${label}\nHalf the cases: ${s.p75} to ${s.p25} days before filing\nMedian ${s.p50} days\n${formatInt(s.n)} cases`}
              >
                <span className="text-base font-semibold">{label}</span>{" "}
                <span className="relative block h-6" aria-hidden="true">
                  <span className="absolute inset-y-0 bg-sage" style={{ left: windowLeft, width: windowWidth }} />
                  <span className="absolute top-1/2 h-px bg-input" style={{ left: at(s.p90), right: `calc(100% - ${at(s.p10)})` }} />
                  <span className="absolute inset-y-1 bg-chart-blue" style={{ left: at(s.p75), right: `calc(100% - ${at(s.p25)})` }} />
                  <span className="absolute inset-y-0 w-1 -translate-x-1/2 bg-foreground" style={{ left: at(s.p50) }} />
                </span>
              </li>
            </Fragment>
          ))}
        </ol>
      </ChartTips>{" "}
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4" aria-hidden="true">
        <span />
        <span className="relative block h-5 text-sm text-muted-foreground">
          {AXIS_TICKS.map((d) => (
            <span key={d} className="absolute -translate-x-1/2 tabular-nums" style={{ left: at(d) }}>
              {d === 0 ? "Filing " : `${d} `}
            </span>
          ))}
        </span>
      </div>{" "}
      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 bg-sage border border-input" aria-hidden="true" />
          {`The rule's window, ${FILING_WINDOW_CLOSE_DAYS} to ${FILING_WINDOW_WAIT_DAYS} days before filing`}
        </span>{" "}
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 bg-chart-blue" aria-hidden="true" />
          Half the cases
        </span>{" "}
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-1 bg-foreground" aria-hidden="true" />
          Median
        </span>{" "}
        <span className="flex items-center gap-2">
          <span className="inline-block h-px w-5 bg-input" aria-hidden="true" />
          Eight in ten
        </span>
      </p>{" "}
      <div className="sr-only">
        <table>
          <caption>Days before filing each step ran </caption>
          <thead>
            <tr>
              <th scope="col">Step </th>
              <th scope="col">Median days </th>
              <th scope="col">Middle half </th>
              <th scope="col">Cases </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label, s }) => (
              <tr key={key}>
                <th scope="row">{`${label} `}</th>
                <td>{`${s.p50} `}</td>
                <td>{`${s.p75} to ${s.p25} `}</td>
                <td>{`${formatInt(s.n)} `}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PaperList({ papers, className }: { papers: Paper[]; className?: string }) {
  return (
    <ol className={className}>
      {papers.map((p, i) => (
        <Fragment key={p.key}>
          {" "}
          <li className="flex items-baseline gap-3 py-2 text-base">
            <span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground">{`${i + 1} `}</span>{" "}
            <span className="min-w-0">{p.label}</span>{" "}
            <span className="ml-auto font-mono text-sm tabular-nums">{formatInt(p.n)}</span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

export default async function PermRecruitmentPage() {
  const doc = await getRecruitmentSummary();
  const n = (rows: { id: string; n: number }[], id: string) => rows.find((r) => r.id === id)?.n ?? 0;
  const sunday = doc ? (doc.sundayEdition.Y ?? 0) : 0;
  const sundayKnown = doc ? sunday + (doc.sundayEdition.N ?? 0) : 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Where PERM employers recruit, and when</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          {doc
            ? `From the ${formatInt(doc.cases)} decided PERM cases filed on DOL's current form${doc.asOf ? `, through ${longDate(doc.asOf)}` : ""}: the newspapers, the additional steps, the notice of filing and how long before filing the recruiting began.`
            : "From DOL's own record of each PERM case's recruitment: the newspapers, the additional steps, the notice of filing and the timing."}
        </p>
      </header>

      {!doc ? (
        <p className="mt-8 border-2 border-border bg-sage p-5 text-base">These figures are being built. Try again tomorrow.</p>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y-2 border-border py-5 lg:grid-cols-4">
            {[
              { value: doc.lead.firstStep ? `${doc.lead.firstStep.p50} days` : "None", label: "median from the first step to filing" },
              { value: formatShareOf(sunday, sundayKnown), label: "said the newspaper was a Sunday edition" },
              { value: formatShareOf(n(doc.steps, "job_search_website"), doc.cases), label: "used a job search website" },
              { value: formatShareOf(n(doc.notice, "posted"), doc.cases), label: "posted the notice at the workplace" },
            ].map((f) => (
              // The figure reads first on screen; the label stays first for a screen reader.
              <div key={f.label} className="flex flex-col-reverse justify-end">
                <dt className="text-base text-muted-foreground">{f.label}</dt>{" "}
                <dd className="font-heading text-3xl font-bold tabular-nums">{f.value}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-12" aria-labelledby="timing">
            <h2 id="timing" className="font-heading text-2xl font-bold">How long before filing</h2>{" "}
            <p className="mt-2 max-w-3xl text-base text-muted-foreground">
              {`The job order and the two Sunday ads must run ${FILING_WINDOW_WAIT_DAYS} to ${FILING_WINDOW_CLOSE_DAYS} days before filing `}
              (<span className="whitespace-nowrap">20 C.F.R. § 656.17(e)</span>).
            </p>
            <TimingChart lead={doc.lead} />
            <h3 className="mt-10 font-heading text-lg font-bold">When the first step ran</h3>{" "}
            <BarRows
              className="mt-4 max-w-3xl"
              label="Cases by days from the first step to filing"
              rows={LEAD_BANDS.map((b) => {
                const v = n(doc.leadBands, b.id);
                const total = doc.leadBands.reduce((a, r) => a + r.n, 0);
                return { key: b.id, label: `${b.label} before filing`, value: v, text: formatShareOf(v, total), tone: "blue" as const };
              })}
            />
          </section>

          <section className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2 [&>*]:min-w-0" aria-label="Steps and notice">
            <div>
              <h2 className="font-heading text-2xl font-bold">Additional steps</h2>{" "}
              <p className="mt-2 text-base text-muted-foreground">
                A professional job needs three of these beyond the job order and the ads. Share of cases using each.
              </p>
              <BarRows
                className="mt-4"
                label="Share of cases using each additional step"
                rows={[...RECRUITMENT_STEPS]
                  .map((s) => ({ s, v: n(doc.steps, s.id) }))
                  .sort((a, b) => b.v - a.v)
                  .map(({ s, v }) => ({ key: s.id, label: s.label, value: v, text: formatShareOf(v, doc.cases) }))}
              />
            </div>{" "}
            <div>
              <h2 className="font-heading text-2xl font-bold">Notice of filing</h2>{" "}
              <p className="mt-2 text-base text-muted-foreground">How the notice reached the workers. A case can use several.</p>
              <BarRows
                className="mt-4"
                label="Share of cases using each notice method"
                rows={[...NOTICE_METHODS]
                  .map((m) => ({ m, v: n(doc.notice, m.id) }))
                  .sort((a, b) => b.v - a.v)
                  .map(({ m, v }) => ({ key: m.id, label: m.label, value: v, text: formatShareOf(v, doc.cases), tone: "green" as const }))}
              />
            </div>
          </section>

          <section className="mt-12" aria-labelledby="papers">
            <h2 id="papers" className="font-heading text-2xl font-bold">The newspapers</h2>{" "}
            <p className="mt-2 max-w-3xl text-base text-muted-foreground">
              Cases naming each paper for their print ads, one count per paper per case.
            </p>
            <PaperList papers={doc.papers} className="mt-4 columns-1 gap-10 divide-y divide-border/60 md:columns-2 [&>li]:break-inside-avoid" />{" "}
            <h3 className="mt-10 font-heading text-lg font-bold">By state</h3>{" "}
            <ul className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
              {Object.entries(doc.byState)
                .sort(([a], [b]) => stateName(a).localeCompare(stateName(b)))
                .map(([st, papers]) => (
                <Fragment key={st}>
                  {" "}
                  <li>
                    <details className="border-b border-border/60">
                      <summary className="flex min-h-11 cursor-pointer items-center gap-2 py-2 text-base">
                        <span className="font-semibold">{stateName(st)}</span>{" "}
                        <span className="ml-auto truncate text-sm text-muted-foreground">{papers[0]?.label ?? ""}</span>
                      </summary>
                      <PaperList papers={papers} className="pb-3" />
                    </details>
                  </li>
                </Fragment>
              ))}
            </ul>
          </section>

          <section className="mt-12 max-w-3xl" aria-labelledby="more">
            <h2 id="more" className="font-heading text-2xl font-bold">The rules, step by step</h2>{" "}
            <ul className="mt-3 space-y-1 text-base">
              <li>
                <Link href="/guides/perm-recruitment-checklist" className="link">
                  PERM recruitment requirements checklist
                </Link>
              </li>{" "}
              <li>
                <Link href="/guides/perm-sunday-ads-additional-recruitment-steps" className="link">
                  Sunday ads and additional recruitment steps
                </Link>
              </li>{" "}
              <li>
                <Link href="/guides/how-long-perm-recruitment-stays-valid" className="link">
                  How long recruitment stays valid
                </Link>
              </li>{" "}
              <li>
                <Link href="/guides/perm-notice-of-filing-sample" className="link">
                  The notice of filing, with a sample
                </Link>
              </li>
            </ul>
          </section>

          <FinePrint summary="How these are counted" className="mt-10">
            <p>
              {`DOL's PERM disclosure files print each case's recruitment as the employer entered it on Form 9089 Section H: the job order's dates, the two print ads with their papers and dates, the additional steps and how the notice of filing was given. Only the form in use since June 2023 carries this, so the figures cover the ${formatInt(doc.cases)} decided cases filed on it. A case still waiting at DOL isn't in the files.`}
            </p>{" "}
            <p>
              {`Newspaper names are grouped across ${formatInt(doc.paperSpellings)} spellings ("The Seattle Times" and "Seattle Times" are one paper), and a case naming one paper for both ads counts once. Days before filing run from each step's start to the date DOL received the case. Each employer's, law firm's and job's own figures are on its page.`}
            </p>
          </FinePrint>
        </>
      )}

      <DataProvenance datasets={["perm-cases"]} />
    </div>
  );
}
