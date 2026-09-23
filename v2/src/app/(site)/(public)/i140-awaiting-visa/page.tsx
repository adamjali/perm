/**
 * Approved employment-based petitions awaiting a visa number.
 *
 * USCIS counts, each quarter, the approved I-140, I-360 and I-526 petitions
 * whose beneficiary cannot yet file for a green card because the visa
 * bulletin has not reached their priority date, by preference and country
 * of birth. It is the India wait as a number rather than an argument:
 * 356,360 approved EB-2 petitions for India-born beneficiaries in the June
 * 2026 count, against a category that issues a few thousand visas a year to
 * that country.
 *
 * The page prints the count, the split by country, the movement since the
 * previous count, and, from a second USCIS workbook, how many I-140s were
 * filed and approved for India each year. It does not print a "years to
 * wait": the honest arithmetic needs the annual limit per country, the
 * dependents USCIS excludes here, and the attrition nobody publishes, and a
 * number built on three guesses is not a measurement.
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
import { BarRows, QuarterlyEmpty, StackedBar, type BarRow } from "@/components/data/BarRows";
import type { RecordFigure } from "@/lib/recordCounts";
import { getEbAwaitingVisa, getI140ClassCountry } from "@/lib/turso/uscisQuarterly";
import {
  AWAITING_CATEGORY_LABELS,
  asOfQuarterLabel,
  awaitingMoves,
  classApprovals,
  countryOrder,
  monthLabel,
  pivotAwaiting,
  shareOf,
  yearsFor,
} from "@/lib/uscisQuarterlyShape";

const TITLE = "Approved I-140s Waiting for a Visa Number";
const DESCRIPTION =
  "How many approved I-140, I-360 and I-526 petitions are waiting for a visa number, by preference and country of birth, from USCIS's quarterly count.";
const PATH = "/i140-awaiting-visa";
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";
const USCIS_DATA_PAGE = "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/i140-awaiting-visa" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: PATH,
  },
}, "i140-awaiting-visa");

export const revalidate = 604800;

const FAQS = [
  {
    q: "What does 'awaiting visa availability' mean?",
    a: "The petition is approved, so USCIS agrees the person qualifies, but the visa bulletin's final action date for their category and country has not reached their priority date. Until it does they cannot file the I-485 or, if they filed early under a dates-for-filing chart, cannot be approved. This count is those people, primary beneficiaries only.",
  },
  {
    q: "Is this the same as the I-485 inventory?",
    a: "No, and the two sit on either side of one line. This page counts approved petitions whose beneficiary is still waiting to file. USCIS's monthly I-485 inventory counts applications already filed and pending. The queue position calculator on this site reads the inventory; this page reads the stage before it.",
  },
  {
    q: "Why does the page not say how many years the wait is?",
    a: "Because the honest arithmetic needs figures nobody publishes: how many of these beneficiaries will still want the visa when their date comes, how many dependents each brings (USCIS excludes them here, the visa limit does not), and how the annual limit will be split. A years figure built on three guesses would read as a measurement. The count is the measurement; the visa bulletin page on this site shows how the cutoffs have actually moved.",
  },
  {
    q: "Why is India so large and Mexico so small?",
    a: "Each country is limited to about seven percent of the employment-based visas in a year regardless of demand, and India's demand in EB-2 and EB-3 is many times that share, so approved petitions accumulate. Mexico's employment-based demand is mostly in EB-3 other workers and EB-4, which is what its row shows.",
  },
  {
    q: "Where does the fiscal-year table come from?",
    a: "From a second USCIS workbook: I-140 petitions by the fiscal year they were received and their current status, all countries and the top five. A recent year is mostly still pending because USCIS has not decided it yet, not because approvals fell.",
  },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(AWAITING_CATEGORY_LABELS.map((c) => [c.code, c.label]));

function n(v: number | null | undefined): string {
  return v === null || v === undefined ? "n/a" : v.toLocaleString("en-US");
}

export default async function I140AwaitingVisaPage() {
  const [awaiting, classCountry] = await Promise.all([getEbAwaitingVisa(), getI140ClassCountry()]);

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
  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "USCIS approved employment-based petitions awaiting visa availability",
    description:
      "Approved Form I-140, I-360 and I-526 petitions awaiting a visa number, by employment preference category and country of birth, as counted by USCIS each quarter, with I-140 receipts by fiscal year, class and country.",
    url: `${SITE}${PATH}`,
    ...(awaiting ? { dateModified: `${awaiting.asOf}-01` } : {}),
    isBasedOn: USCIS_DATA_PAGE,
    creator: { "@type": "Organization", name: "U.S. Citizenship and Immigration Services", url: "https://www.uscis.gov" },
    isAccessibleForFree: true,
    license: "https://www.usa.gov/government-works",
    variableMeasured: ["approved petitions awaiting visa availability", "preference category", "country of birth", "I-140 receipts by fiscal year"],
  };

  const table = awaiting ? pivotAwaiting(awaiting.cells) : null;
  const totalAll = table?.cells.TOTAL?.TOTAL ?? null;
  const india = table?.cells.India?.TOTAL ?? null;
  const china = table?.cells.China?.TOTAL ?? null;
  const indiaEb2Share = table ? shareOf(table, "India", "EB2") : null;
  const indiaEb2 = table?.cells.India?.EB2 ?? null;

  const ledgerCandidates: Array<RecordFigure | null> = awaiting && table
    ? [
        totalAll !== null ? { href: "#by-country", value: totalAll, label: "approved petitions waiting for a visa number, every category", asOf: awaiting.asOf, asOfKind: "newest" as const } : null,
        india !== null ? { href: "#by-country", value: india, label: "of them for beneficiaries born in India", asOf: awaiting.asOf, asOfKind: "newest" as const } : null,
        indiaEb2 !== null ? { href: "#by-country", value: indiaEb2, label: `India-born in EB-2 alone${indiaEb2Share !== null ? `, ${Math.round(indiaEb2Share * 100)}% of the category` : ""}`, asOf: awaiting.asOf, asOfKind: "newest" as const } : null,
        china !== null ? { href: "#by-country", value: china, label: "for beneficiaries born in China", asOf: awaiting.asOf, asOfKind: "newest" as const } : null,
      ]
    : [];
  const ledger = ledgerCandidates.filter((f): f is RecordFigure => f !== null);

  const moves = awaiting?.previous ? awaitingMoves(awaiting.cells, awaiting.previous.cells) : [];
  const totalMove = moves.find((m) => m.country === "TOTAL" && m.category === "TOTAL") ?? null;
  const cellMoves = moves.filter((m) => m.country !== "TOTAL" && m.category !== "TOTAL" && m.delta !== 0).slice(0, 10);
  const moveRows: BarRow[] = cellMoves.map((m) => ({
    key: `${m.country}|${m.category}`,
    label: `${m.country}, ${CATEGORY_LABEL[m.category] ?? m.category}`,
    sub: `${n(m.from)} to ${n(m.to)}`,
    value: Math.abs(m.delta),
    text: `${m.delta > 0 ? "+" : "−"}${Math.abs(m.delta).toLocaleString("en-US")}`,
    tone: m.delta > 0 ? "ink" : "primary",
  }));

  const countries = classCountry ? countryOrder(classCountry.countries) : [];
  const indiaYears = classCountry ? yearsFor(classCountry.cells, "India", "ALL") : [];
  const allYears = classCountry ? yearsFor(classCountry.cells, "All Countries", "ALL") : [];
  const latestFullFy = allYears.length ? Math.max(...allYears.map((y) => y.fy)) - 1 : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={breadcrumb} />

      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          USCIS quarterly data{awaiting ? ` · as of ${monthLabel(awaiting.asOf)}` : ""}
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Approved, and waiting for a visa number
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          USCIS&apos;s own count of approved I-140, I-360 and I-526 petitions whose
          beneficiary can&apos;t file for the green card yet, by category and country
          of birth, and how the count moved since the last one. The India wait,
          measured rather than argued.
        </p>
      </header>

      {!awaiting || !table ? (
        <QuarterlyEmpty file="eb_i140_i360_i526_performancedata" />
      ) : (
        <>
          <RecordStrip record={ledger} />

          <section id="by-country" className="mt-12 scroll-mt-24">
            <FigurePlate
              n="01"
              title="Who is waiting, by category"
              subject={`Approved petitions awaiting a visa number, as of ${monthLabel(awaiting.asOf)}`}
              caption={
                <>
                  Each bar is one preference category, split by the beneficiary&apos;s
                  country of birth. Every country is capped at about seven percent of
                  the year&apos;s visas, so a category where one country holds most of
                  the bar is a category where that country waits.
                </>
              }
              source={<>USCIS, {awaiting.sourceFile}, primary beneficiaries only, dependents excluded.</>}
            >
              <div className="space-y-6">
                {table.categories.filter((c) => c !== "TOTAL").map((cat) => {
                  const total = table.cells.TOTAL?.[cat] ?? 0;
                  const segments = table.countries
                    .filter((c) => c !== "TOTAL")
                    .map((c) => ({ key: c, label: c, value: table.cells[c]?.[cat] ?? 0 }))
                    .filter((s) => s.value > 0);
                  return (
                    <div key={cat}>
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="text-base font-semibold">{CATEGORY_LABEL[cat] ?? cat}</p>{" "}
                        <p className="font-mono text-base font-bold tabular-nums">{total.toLocaleString("en-US")}</p>
                      </div>
                      {total > 0 ? (
                        <StackedBar segments={segments} total={total} className="mt-1.5" />
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">Nobody waiting: the category is current for every country.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </FigurePlate>
          </section>

          {awaiting.previous ? (
            <section id="movement" className="mt-12 scroll-mt-24">
              <FigurePlate
                n="02"
                title="What moved since the last count"
                subject={`${monthLabel(awaiting.previous.asOf)} to ${monthLabel(awaiting.asOf)}`}
                caption={
                  <>
                    {totalMove ? (
                      <>
                        The whole count went from {n(totalMove.from)} to {n(totalMove.to)}, a change of{" "}
                        <b className="font-bold text-foreground">{totalMove.delta > 0 ? "+" : ""}{totalMove.delta.toLocaleString("en-US")}</b>.{" "}
                      </>
                    ) : null}
                    A cell falls when the visa bulletin advances past those beneficiaries
                    and they file, or when petitions are withdrawn or revoked; it rises
                    as new approvals join the wait. Dark bars rose, accent bars fell.
                  </>
                }
                source={<>USCIS, two consecutive quarterly counts.</>}
              >
                {moveRows.length > 0 ? <BarRows rows={moveRows} /> : (
                  <p className="text-base text-muted-foreground">No cell moved between the two counts.</p>
                )}
              </FigurePlate>
            </section>
          ) : null}

          <section id="every-cell" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-black">The whole table</h2>{" "}
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
              USCIS&apos;s nine columns and six rows, as printed. The TOTAL row is USCIS&apos;s,
              and this site refuses the file if the countries don&apos;t sum to it.
            </p>{" "}
            <div className="mt-4 overflow-x-auto border-2 border-border bg-card">
              <table className="min-w-[880px] w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-left">
                    <th className="px-4 py-2 font-bold">Country of birth{" "}</th>
                    {table.categories.map((cat) => (
                      <th key={cat} className="px-2 py-2 text-right font-bold">{CATEGORY_LABEL[cat] ?? cat}{" "}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.countries.map((c) => (
                    <tr key={c} className={c === "TOTAL" ? "border-t-2 border-border font-bold" : "border-b border-border/50"}>
                      <td className="px-4 py-1.5 font-semibold">{c === "TOTAL" ? "All countries" : c}{" "}</td>
                      {table.categories.map((cat) => (
                        <td key={cat} className="px-2 py-1.5 text-right font-mono tabular-nums">{n(table.cells[c]?.[cat])}{" "}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>{" "}
            <FinePrint summary="What USCIS says about this count" className="mt-4">
              <p>
                Priority dates are judged against the final action dates chart of the
                visa bulletin for the month named. A petitioner can file more than one
                petition, so one person can appear twice. Petitions for people who have
                since become permanent residents or citizens are excluded. Dependents are
                not counted, and the annual visa limit counts them, so the visas these
                petitions will consume is larger than the count.
              </p>
            </FinePrint>
          </section>
        </>
      )}

      {classCountry && indiaYears.length > 0 ? (
        <section id="by-year" className="mt-12 scroll-mt-24">
          <FigurePlate
            n="03"
            title="I-140 petitions by the year filed"
            subject={`India against all countries, FY${indiaYears[0]!.fy} to FY${indiaYears[indiaYears.length - 1]!.fy}, as of ${asOfQuarterLabel(classCountry.asOf)}`}
            caption={
              <>
                How many I-140s USCIS received each fiscal year and where they stand
                now. The bar is India&apos;s receipts; the figure beside it is India&apos;s
                share of every country&apos;s. A recent year is mostly pending because it
                has not been decided yet, not because approvals fell.
              </>
            }
            source={<>USCIS, {classCountry.sourceFile}, by fiscal year received; the newest year is partial.</>}
          >
            <BarRows
              rows={indiaYears.map((y) => {
                const all = allYears.find((a) => a.fy === y.fy);
                return {
                  key: String(y.fy),
                  label: `FY${y.fy}`,
                  sub: `${n(y.approved)} approved, ${n(y.denied)} denied, ${n(y.pending)} pending${y.denialRate !== null ? ` · ${(y.denialRate * 100).toFixed(1)}% of decided denied` : ""}`,
                  value: y.total,
                  text: all && all.total > 0 ? `${n(y.total)} (${Math.round((y.total / all.total) * 100)}%)` : n(y.total),
                  tone: "ink" as const,
                };
              })}
            />
            {latestFullFy !== null ? (
              <div className="mt-6 border-t border-border/60 pt-4">
                <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Approvals by class, FY{latestFullFy}, petitions received that year
                </p>{" "}
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-[560px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-1.5 pr-4 font-bold">Class{" "}</th>
                        {countries.map((c) => (
                          <th key={c} className="py-1.5 pr-3 text-right font-bold">{c === "All Countries" ? "All" : c}{" "}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classApprovals(classCountry.cells, "All Countries", latestFullFy).map((cls) => (
                        <tr key={cls.code} className="border-b border-border/50">
                          <td className="py-1.5 pr-4">{cls.label} <span className="font-mono text-muted-foreground">({cls.code})</span>{" "}</td>
                          {countries.map((c) => {
                            const v = classApprovals(classCountry.cells, c, latestFullFy).find((x) => x.code === cls.code)?.approved;
                            return (
                              <td key={c} className="py-1.5 pr-3 text-right font-mono tabular-nums">{v === undefined ? "n/a" : v.toLocaleString("en-US")}{" "}</td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </FigurePlate>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <section className="mt-12 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black">Read next</h2>{" "}
        <ul className="mt-4 space-y-2">
          <li>
            <Link href="/guides/approved-i140-no-visa-number-eb2-india" className="font-bold underline underline-offset-2 hover:text-primary">
              Approved I-140, no visa number: what the India wait actually is
            </Link>
          </li>{" "}
          <li>
            <Link href="/visa-bulletin" className="font-bold underline underline-offset-2 hover:text-primary">
              What the next visa bulletin could do, from the last 84
            </Link>
          </li>{" "}
          <li>
            <Link href="/tools/i485-queue-position" className="font-bold underline underline-offset-2 hover:text-primary">
              The I-485 inventory ahead of a priority date
            </Link>
          </li>
        </ul>
      </section>

      <PageBasics page="i140-awaiting-visa" />{" "}
      <DataProvenance datasets={["uscis-eb-awaiting-visa", "uscis-i140-class-country"]} />
    </div>
  );
}
