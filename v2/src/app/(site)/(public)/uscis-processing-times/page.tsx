/**
 * USCIS processing times, the MEDIAN, by form.
 *
 * USCIS publishes two different processing-time numbers and nearly every
 * page on the internet quotes the wrong one for the question being asked.
 * The processing-times page (egov.uscis.gov) prints one figure per form and
 * subtype measured over the slow tail of recently completed cases; the
 * quarterly performance workbook prints, for every form USCIS adjudicates,
 * the MEDIAN months it took to decide the cases finished that quarter, beside
 * receipts, completions and the pending count. The first answers "how long
 * before I should ask", the second "how long did it take the typical case".
 * For an I-140 in the third quarter of FY2026 they read 3.9 months against
 * two to thirty-four.
 *
 * This page prints the quarterly median for every form, the two figures side
 * by side for the I-140, and the only history USCIS publishes for medians (a
 * FY2016 to FY2024 factsheet). Nothing here is modelled: every number is
 * USCIS's, with USCIS's own dates.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { withSocialCard } from "@/lib/socialCard";
import { openGraphBase } from "@/lib/openGraphBase";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { FaqList } from "@/components/tools/FaqList";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { FinePrint } from "@/components/data/FinePrint";
import { DataProvenance } from "@/components/data/DataProvenance";
import { PageBasics } from "@/components/data/PageBasics";
import { RecordStrip } from "@/components/home/RecordStrip";
import { BarRows, QuarterlyEmpty, type BarRow } from "@/components/data/BarRows";
import type { RecordFigure } from "@/lib/recordCounts";
import {
  getHistoricalMedians,
  getUscisFormHistory,
  getUscisFormQuarter,
  type UscisFormRow,
} from "@/lib/turso/uscisQuarterly";
import { monthsLabel, quarterLabel } from "@/lib/uscisQuarterlyShape";
import {
  PROCESSING_TIMES_AS_OF,
  PROCESSING_TIMES_SOURCE_URL,
  getI140ProcessingTime,
  type I140Category,
} from "@/lib/processing-times/i140ProcessingTimes";
import { formatAsOf } from "@/lib/dolFormat";

const TITLE = "USCIS Processing Times by Form (Median)";
const DESCRIPTION =
  "The median months USCIS took to decide every form last quarter, from its own quarterly data, with receipts, completions, pending and history to 2016.";
const PATH = "/uscis-processing-times";
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";
const USCIS_DATA_PAGE = "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/uscis-processing-times" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: PATH,
  },
}, "uscis-processing-times");

// Quarterly data on a weekly window: the file changes four times a year and
// the monthly ingest picks a new quarter up within a day of loading it.
export const revalidate = 604800;

/** The forms the employment green card runs through, in the order it meets them. */
const KEY_FORMS: ReadonlyArray<{ form: string; contains?: string; equals?: string; label: string }> = [
  { form: "I-129", label: "I-129 nonimmigrant worker petition" },
  { form: "I-140", label: "I-140 immigrant petition" },
  { form: "I-485", contains: "(Employment)", label: "I-485 adjustment, employment-based" },
  { form: "I-765", contains: "Adjustment", label: "I-765 work permit, with a pending I-485" },
  { form: "I-131", contains: "Advance Parole", label: "I-131 advance parole" },
  { form: "I-824", label: "I-824 action on an approved petition" },
  { form: "I-539", label: "I-539 extend or change status" },
  { form: "I-290B", label: "I-290B appeal or motion" },
  { form: "I-485", contains: "(Family)", label: "I-485 adjustment, family-based" },
  { form: "N-400", equals: "Application for Naturalization", label: "N-400 naturalization" },
];

function pick(forms: readonly UscisFormRow[], spec: { form: string; contains?: string; equals?: string }): UscisFormRow | null {
  return (
    forms.find((r) =>
      r.form === spec.form &&
      (spec.equals ? r.title === spec.equals : true) &&
      (spec.contains ? r.title.includes(spec.contains) : true)) ?? null
  );
}

const FAQS = [
  {
    q: "Is this the same number as the USCIS processing-times page?",
    a: "No. USCIS's processing-times page publishes, per form and subtype, a figure measured over the slow tail of recently completed cases, and the page itself tells you to wait until that many months have passed before asking about your case. The quarterly performance data publishes the median: the months it took to decide half of the cases finished in the quarter. For an I-140 the two currently read about four months against two to thirty-four, and both are USCIS's own figures.",
  },
  {
    q: "Which number should I plan around?",
    a: "The median tells you what the typical case took last quarter. The processing-times figure tells you when USCIS will accept an inquiry about a case that is taking longer. A case that has passed the median is not late; a case that has passed the processing-times figure is one USCIS itself calls outside normal processing.",
  },
  {
    q: "Why do some forms show n/a?",
    a: "Because USCIS printed N/A. Its note says a processing time may be unavailable because the form is pending a calculation or because one cannot be computed. This site prints nothing rather than a number USCIS did not.",
  },
  {
    q: "Why are there several I-485 and I-765 rows?",
    a: "USCIS reports each basis separately: six I-485 lines (family, employment, asylum, refugee, Cuban, other) and four I-765 lines (asylum, adjustment of status, DACA, all other). They finish at very different speeds, so one I-485 number would hide a threefold spread. USCIS's own note says the lines sum to the form's total.",
  },
  {
    q: "How often does this update?",
    a: "USCIS posts a quarter's file roughly three months after the quarter ends, and this site reads its data page on the 15th of every month and loads any quarter it does not already hold. The date on every figure is the quarter it describes, not the day it was read.",
  },
];

const FACTSHEET_SERIES: ReadonlyArray<{ form: string; basisContains: string; label: string }> = [
  { form: "I-485", basisContains: "Employment", label: "I-485, employment-based" },
  { form: "I-485", basisContains: "Family", label: "I-485, family-based" },
  { form: "I-765", basisContains: "pending I-485", label: "I-765, pending I-485" },
  { form: "I-131", basisContains: "Advance Parole", label: "I-131 advance parole" },
  { form: "N-400", basisContains: "Naturalization", label: "N-400" },
];
const SERIES_CLASSES = ["stroke-primary", "stroke-foreground", "stroke-foreground/60", "stroke-foreground/35", "stroke-primary/50"] as const;

/**
 * The factsheet's medians drawn as lines, FY2016 to FY2024. One `<text>` per
 * tick and a trailing space inside each, because SVG text glues like any
 * text. The drawing keeps a 720px minimum width and scrolls in its own box,
 * so the 14px labels never render smaller than 14px on a phone.
 */
function MedianHistoryChart({ years, series }: { years: number[]; series: Array<{ label: string; months: number[] }> }) {
  const W = 720, H = 300, L = 44, R = 16, T = 16, B = 36;
  const maxMonths = Math.ceil(Math.max(1, ...series.flatMap((s) => s.months)) / 5) * 5;
  const x = (i: number) => L + (i / Math.max(1, years.length - 1)) * (W - L - R);
  const y = (m: number) => T + (1 - m / maxMonths) * (H - T - B);
  const ticks = Array.from({ length: maxMonths / 5 + 1 }, (_, i) => i * 5);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[720px] w-full" role="img" aria-label="Median months by fiscal year, one line per form">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={L - 8} y={y(t) + 5} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={14}>{t}{" "}</text>
          </g>
        ))}
        {years.map((yr, i) => (
          <text key={yr} x={x(i)} y={H - 10} textAnchor={i === 0 ? "start" : i === years.length - 1 ? "end" : "middle"} className="fill-muted-foreground font-mono" fontSize={14}>FY{yr}{" "}</text>
        ))}
        {series.map((s, si) => (
          <g key={s.label}>
            <polyline
              fill="none"
              strokeWidth={si === 0 ? 4 : 2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={SERIES_CLASSES[si % SERIES_CLASSES.length]}
              points={s.months.map((m, i) => `${x(i)},${y(m)}`).join(" ")}
            >
              {/* ONE string child, with the anti-glue space inside it. As
                  `{s.label}{" "}` (two children) React 19 rendered this <title>
                  differently on the server and the client: React error #418 on
                  every load (outside audit, 2026-09-23; the dev overlay named
                  this node). */}
              <title>{`${s.label} `}</title>
            </polyline>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default async function UscisProcessingTimesPage() {
  const [quarter, historical, i140History, i485History] = await Promise.all([
    getUscisFormQuarter(),
    getHistoricalMedians(),
    getUscisFormHistory("I-140"),
    getUscisFormHistory("I-485"),
  ]);

  const breadcrumb = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: TITLE, href: PATH },
  ]);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: FAQS.map((f) => ({
      "@type": "Question" as const,
      name: f.q,
      acceptedAnswer: { "@type": "Answer" as const, text: f.a },
    })),
  };
  // USCIS's own table, transcribed: a work of the United States Government,
  // so the license is usa.gov's, as on /perm-processing-times, not this
  // site's terms. The creator is the bare "Organization" type on purpose:
  // Google's Dataset parser matches the type literally.
  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "USCIS quarterly form performance data: median processing times",
    description:
      "Receipts, approvals, denials, completions, pending counts and median months to a decision for every USCIS form, per fiscal quarter, from USCIS's quarterly performance workbooks.",
    url: `${SITE}${PATH}`,
    ...(quarter ? { dateModified: quarter.quarterEnd, temporalCoverage: `${quarter.quarterStart}/${quarter.quarterEnd}` } : {}),
    isBasedOn: USCIS_DATA_PAGE,
    creator: { "@type": "Organization", name: "U.S. Citizenship and Immigration Services", url: "https://www.uscis.gov" },
    isAccessibleForFree: true,
    license: "https://www.usa.gov/government-works",
    variableMeasured: ["forms received", "approved", "denied", "total completions", "pending", "median processing months"],
  };

  const forms = quarter?.forms ?? [];
  const keyRows = KEY_FORMS.map((spec) => ({ spec, row: pick(forms, spec) })).filter((k) => k.row !== null) as Array<{ spec: (typeof KEY_FORMS)[number]; row: UscisFormRow }>;
  const i140 = pick(forms, { form: "I-140" });
  const i485eb = pick(forms, { form: "I-485", contains: "(Employment)" });
  const i765aos = pick(forms, { form: "I-765", contains: "Adjustment" });
  const i131ap = pick(forms, { form: "I-131", contains: "Advance Parole" });

  const ledgerCandidates: Array<RecordFigure | null> = quarter
    ? [
        i140?.medianMonths !== null && i140 ? { href: "#green-card-forms", value: i140.medianMonths!, label: "months to decide an I-140, the median that quarter", asOf: quarter.quarterEnd, asOfKind: "through" as const } : null,
        i485eb?.medianMonths !== null && i485eb ? { href: "#green-card-forms", value: i485eb.medianMonths!, label: "months for an employment-based I-485", asOf: quarter.quarterEnd, asOfKind: "through" as const } : null,
        i765aos?.medianMonths !== null && i765aos ? { href: "#green-card-forms", value: i765aos.medianMonths!, label: "months for a work permit filed with a pending I-485", asOf: quarter.quarterEnd, asOfKind: "through" as const } : null,
        i131ap?.medianMonths !== null && i131ap ? { href: "#green-card-forms", value: i131ap.medianMonths!, label: "months for advance parole", asOf: quarter.quarterEnd, asOfKind: "through" as const } : null,
        quarter.total?.pending != null ? { href: "#every-form", value: quarter.total.pending, label: "applications and petitions pending at USCIS, every form", asOf: quarter.quarterEnd, asOfKind: "through" as const } : null,
      ]
    : [];
  const ledger = ledgerCandidates.filter((f): f is RecordFigure => f !== null);

  const barRows: BarRow[] = keyRows.map(({ spec, row }) => ({
    key: `${row.form}|${row.title}`,
    label: spec.label,
    sub: row.pending !== null ? `${row.pending.toLocaleString("en-US")} pending, ${(row.completed ?? 0).toLocaleString("en-US")} decided in the quarter` : undefined,
    value: row.medianMonths,
    text: `${monthsLabel(row.medianMonths)} mo`,
    tone: row.form === "I-140" || row.title.includes("(Employment)") ? "primary" : "ink",
  }));

  // The processing-times page's figures for the I-140, beside the one median.
  const egovSubtypes = (["EB-1", "EB-2", "EB-2-NIW", "EB-3"] as I140Category[])
    .flatMap((c) => getI140ProcessingTime(c)?.subtypes ?? []);

  const categories = [...new Set(forms.map((r) => r.category))].filter(Boolean);
  const factsheetSeries = historical
    ? FACTSHEET_SERIES.map((s) => {
        const row = historical.rows.find((r) => r.form === s.form && r.basis.includes(s.basisContains));
        return row ? { label: s.label, months: row.months } : null;
      }).filter((s): s is { label: string; months: number[] } => s !== null)
    : [];
  const i485ebHistory = i485History.filter((p) => p.title.includes("(Employment)"));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={breadcrumb} />

      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          USCIS quarterly data{quarter ? ` · ${quarterLabel(quarter.fy, quarter.quarter)}` : ""}
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          USCIS processing times, the median, by form
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          How many months USCIS took to decide the typical case of every form
          last quarter, from its own quarterly workbook. It&apos;s a different
          number from the one on USCIS&apos;s processing-times page, and this
          page shows both.
        </p>
      </header>

      {!quarter ? (
        <QuarterlyEmpty file="quarterly_all_forms" />
      ) : (
        <>
          <RecordStrip record={ledger} />

          <section id="green-card-forms" className="mt-12 scroll-mt-24">
            <FigurePlate
              n="01"
              title="Median months to a decision"
              subject={`The employment green card's forms, ${quarterLabel(quarter.fy, quarter.quarter)}`}
              caption={
                <>
                  Each bar is the median USCIS printed for that form line: half the
                  cases decided in the quarter took less, half took more. The
                  employment-based I-485 and the I-140 are drawn in the accent.
                </>
              }
              source={<>USCIS, {quarter.sourceFile}, received to completion, cases decided in the quarter.</>}
            >
              <BarRows rows={barRows} />
            </FigurePlate>
          </section>

          {i140 && i140.medianMonths !== null ? (
            <section id="median-or-80" className="mt-12 scroll-mt-24">
              <FigurePlate
                n="02"
                title="Two USCIS numbers for one form"
                subject="The I-140: the quarterly median beside the processing-times page"
                caption={
                  <>
                    The processing-times page publishes one figure per subtype: the time
                    USCIS took to finish 80% of the petitions it decided over the past six
                    months, and it tells you to wait that long before asking about a case. The quarterly file
                    publishes one median over every I-140 decided in the quarter. Both
                    are USCIS&apos;s. Only the second says what the typical case took.
                  </>
                }
                source={
                  <>
                    Left: USCIS quarterly data, {quarterLabel(quarter.fy, quarter.quarter)}. Right:{" "}
                    <a href={PROCESSING_TIMES_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      USCIS processing times
                    </a>{" "}
                    as of {formatAsOf(PROCESSING_TIMES_AS_OF)}.
                  </>
                }
              >
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] [&>*]:min-w-0">
                  <div className="border-2 border-border bg-tint-primary p-5">
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/70">Quarterly median, all I-140s</p>{" "}
                    <p className="mt-2 font-heading text-5xl font-black leading-none tabular-nums">{monthsLabel(i140.medianMonths)}</p>{" "}
                    <p className="mt-2 text-sm text-foreground/70">
                      months, over {(i140.completed ?? 0).toLocaleString("en-US")} petitions decided in the quarter
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Processing-times page, 80% within</p>{" "}
                    <ul className="mt-2 divide-y divide-border">
                      {egovSubtypes.map((s) => (
                        <Fragment key={s.code}>{" "}
                        <li className="flex items-baseline justify-between gap-4 py-2">
                          <span className="text-base">{s.label} <span className="font-mono text-sm text-muted-foreground">({s.code})</span></span>{" "}
                          <span className="whitespace-nowrap font-mono text-base font-bold tabular-nums">{`${s.months80} mo`}</span>
                        </li>
                        </Fragment>
                      ))}
                    </ul>
                  </div>
                </div>
              </FigurePlate>
            </section>
          ) : null}

          {factsheetSeries.length > 0 && historical ? (
            <section id="history" className="mt-12 scroll-mt-24">
              <FigurePlate
                n="03"
                title="Median months, FY2016 to FY2024"
                subject="The only history USCIS publishes for medians"
                caption={
                  <>
                    Five of the sixteen lines in USCIS&apos;s historical factsheet. The
                    employment-based I-485 peaked at 11 months in FY2022 and read 7.2 in
                    the part of FY2024 the sheet covers. {historical.note}
                  </>
                }
                source={<>USCIS historical processing times factsheet, data as of {formatAsOf(historical.asOf)}.</>}
              >
                <MedianHistoryChart years={historical.years} series={factsheetSeries} />
                <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  {factsheetSeries.map((s, i) => (
                    <Fragment key={s.label}>{" "}
                    <li className="flex items-center gap-1.5">
                      <span className={`inline-block h-1 w-5 ${["bg-primary", "bg-foreground", "bg-foreground/60", "bg-foreground/35", "bg-primary/50"][i % 5]}`} aria-hidden="true" />{" "}
                      <span>{s.label}</span>{" "}
                      <span className="font-mono font-bold tabular-nums">{monthsLabel(s.months[s.months.length - 1] ?? null)}</span>
                    </li>
                    </Fragment>
                  ))}
                </ul>
                {i140History.length > 0 || i485ebHistory.length > 0 ? (
                  <div className="mt-6 border-t border-border/60 pt-4">
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Since the factsheet, by quarter</p>{" "}
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-[420px] text-sm">
                        <thead>
                          <tr className="border-b-2 border-border text-left">
                            <th className="py-1.5 pr-4 font-bold">Quarter{" "}</th>
                            <th className="py-1.5 pr-4 text-right font-bold">I-140{" "}</th>
                            <th className="py-1.5 text-right font-bold">I-485, employment{" "}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...new Set([...i140History, ...i485ebHistory].map((p) => `${p.fy}-${p.quarter}`))].sort().map((k) => {
                            const [fy, qn] = k.split("-").map(Number) as [number, number];
                            const a = i140History.find((p) => p.fy === fy && p.quarter === qn);
                            const b = i485ebHistory.find((p) => p.fy === fy && p.quarter === qn);
                            return (
                              <tr key={k} className="border-b border-border/60">
                                <td className="py-1.5 pr-4">{quarterLabel(fy, qn)}{" "}</td>
                                <td className="py-1.5 pr-4 text-right font-mono tabular-nums">{a ? `${monthsLabel(a.medianMonths)} mo` : "n/a"}{" "}</td>
                                <td className="py-1.5 text-right font-mono tabular-nums">{b ? `${monthsLabel(b.medianMonths)} mo` : "n/a"}{" "}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </FigurePlate>
            </section>
          ) : null}

          <section id="every-form" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-black">Every form USCIS reports</h2>{" "}
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
              {forms.length} form lines in {categories.length} categories, as USCIS
              groups them. Open a category for its table; the figures are the
              quarter&apos;s, and the median is the months from receipt to decision.
            </p>{" "}
            <div className="mt-4 space-y-3">
              {categories.map((cat) => {
                const rowsIn = forms.filter((r) => r.category === cat);
                return (
                  <Fragment key={cat}>{" "}
                  <details className="group border-2 border-border bg-card">
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 font-heading text-lg font-bold [&::-webkit-details-marker]:hidden">
                      <span>{cat}</span>{" "}
                      <span className="font-mono text-sm font-bold text-muted-foreground">{rowsIn.length} lines</span>
                    </summary>{" "}
                    <div className="overflow-x-auto border-t-2 border-border">
                      <table className="min-w-[760px] w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="px-4 py-2 font-bold">Form{" "}</th>
                            <th className="px-2 py-2 font-bold">Title{" "}</th>
                            <th className="px-2 py-2 text-right font-bold">Received{" "}</th>
                            <th className="px-2 py-2 text-right font-bold">Decided{" "}</th>
                            <th className="px-2 py-2 text-right font-bold">Pending{" "}</th>
                            <th className="px-4 py-2 text-right font-bold">Median{" "}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rowsIn.map((r) => (
                            <tr key={`${r.form}|${r.title}`} className="border-b border-border/50">
                              <td className="px-4 py-1.5 font-mono font-bold">{r.form}{" "}</td>
                              <td className="px-2 py-1.5">{r.title}{" "}</td>
                              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.received === null ? "n/a" : r.received.toLocaleString("en-US")}{" "}</td>
                              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.completed === null ? "n/a" : r.completed.toLocaleString("en-US")}{" "}</td>
                              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.pending === null ? "n/a" : r.pending.toLocaleString("en-US")}{" "}</td>
                              <td className="px-4 py-1.5 text-right font-mono font-bold tabular-nums">{monthsLabel(r.medianMonths)}{" "}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                  </Fragment>
                );
              })}
            </div>{" "}
            <FinePrint summary="How USCIS defines these columns" className="mt-4">
              <p>
                Received is new filings entered in the quarter; decided is approvals
                plus denials, with a few forms also counting administrative closures;
                pending is what was awaiting a decision on the quarter&apos;s last day.
                The median is the months from receipt to completion for the cases
                completed that quarter, so a quarter that cleared old cases reads
                slower than one that cleared new ones. USCIS&apos;s own notes on the
                sheet say the counts can differ from earlier reports as cases are
                re-queried.
              </p>
            </FinePrint>
          </section>
        </>
      )}

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <section className="mt-12 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black">Read next</h2>{" "}
        <ul className="mt-4 space-y-2">
          <li>
            <Link href="/guides/uscis-processing-times-median-vs-80-percent" className="font-bold underline underline-offset-2 hover:text-primary">
              Median or 80 percent: which USCIS processing time is which
            </Link>
          </li>{" "}
          <li>
            <Link href="/tools/i140-calculator" className="font-bold underline underline-offset-2 hover:text-primary">
              The I-140 queue by category
            </Link>
          </li>{" "}
          <li>
            <Link href="/i485-by-field-office" className="font-bold underline underline-offset-2 hover:text-primary">
              The I-485 by field office
            </Link>
          </li>
        </ul>
      </section>

      <PageBasics page="uscis-processing-times" />{" "}
      <DataProvenance datasets={["uscis-form-quarters"]} />
    </div>
  );
}
