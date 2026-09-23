/**
 * The I-485 by USCIS field office and service center.
 *
 * USCIS publishes, every quarter, how many I-485 applications each field
 * office received, approved, denied and had pending, split into family,
 * employment, humanitarian and other. It is the only public answer to "which
 * office is slowest", and nobody else prints it as a page. This one does,
 * employment-based first because that is the half a PERM leads to.
 *
 * What the page will not do: rank offices by a wait it cannot measure. The
 * file gives a pending pile and a quarter's output per office; dividing one
 * by the other is quarters of work at that pace, and it is labelled as that,
 * never as "months to your interview". A cell USCIS withholds (1 to 9 cases,
 * printed as D) stays withheld, not zero.
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
import { getI485Offices } from "@/lib/turso/uscisQuarterly";
import {
  groupByState,
  quarterLabel,
  quartersOfWork,
  rankOffices,
  splitOffices,
  sumMeasure,
  type OfficeRow,
} from "@/lib/uscisQuarterlyShape";

const TITLE = "I-485 Processing by USCIS Field Office";
const DESCRIPTION =
  "Employment-based I-485s received, approved, denied and pending at every USCIS field office and service center last quarter, from USCIS's own data.";
const PATH = "/i485-by-field-office";
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";
const USCIS_DATA_PAGE = "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/i485-by-field-office" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: PATH,
  },
}, "i485-by-field-office");

export const revalidate = 604800;

const FAQS = [
  {
    q: "Which USCIS field office is fastest for an employment-based I-485?",
    a: "USCIS does not publish a wait per office, so no page can say it honestly. What it publishes is each office's pending pile and its quarter's approvals and denials. This page divides the two into quarters of work at that quarter's pace: an office with 5,000 pending that decided 1,000 in the quarter has five quarters of work in front of it. That is a comparison between offices, not a prediction of your interview date.",
  },
  {
    q: "Why does my field office show so few employment-based approvals?",
    a: "Most employment-based I-485s are decided without an interview, at the National Benefits Center and the service centers, which is why those rows carry the large approval counts. A field office decides the cases USCIS routed to it for an interview. USCIS's own column heading says employment-based applications are received at a service center first.",
  },
  {
    q: "What does 'withheld' mean?",
    a: "USCIS prints a D where a cell holds between one and nine cases, because a count that small could identify a person. This page shows the cell as withheld rather than as zero, and the state and national totals are USCIS's own printed figures, so a withheld cell never makes a total wrong.",
  },
  {
    q: "Can I choose my field office?",
    a: "No. USCIS assigns the office by the applicant's address, and moving during the case moves the case. This page is for understanding where a case stands and how busy that office is, not for picking one.",
  },
  {
    q: "How current is this?",
    a: "It is the quarter USCIS published most recently, named on every figure. USCIS posts a quarter roughly three months after it ends; this site checks monthly and loads a new quarter the day it appears.",
  },
];

function fmt(n: number | null): string {
  return n === null ? "withheld" : n.toLocaleString("en-US");
}

export default async function I485ByFieldOfficePage() {
  const data = await getI485Offices();

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
  // USCIS's own table, transcribed; usa.gov's licence, a bare Organization
  // creator (Google's Dataset parser matches the type literally).
  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "USCIS I-485 applications by field office and service center",
    description:
      "I-485 applications received, approved, denied and pending at each USCIS field office and service center per fiscal quarter, by family, employment, humanitarian and other basis, from USCIS's quarterly performance data.",
    url: `${SITE}${PATH}`,
    ...(data ? { dateModified: data.quarterEnd } : {}),
    isBasedOn: USCIS_DATA_PAGE,
    creator: { "@type": "Organization", name: "U.S. Citizenship and Immigration Services", url: "https://www.uscis.gov" },
    isAccessibleForFree: true,
    license: "https://www.usa.gov/government-works",
    variableMeasured: ["applications received", "approved", "denied", "pending", "field office", "category of admission"],
  };

  const { fieldOffices, serviceCenters } = data ? splitOffices(data.offices) : { fieldOffices: [], serviceCenters: [] };
  const total = data?.total ?? null;
  const decidedNational = total && total.empApproved !== null && total.empDenied !== null ? total.empApproved + total.empDenied : null;
  const workNational = total && total.empPending !== null && decidedNational ? total.empPending / decidedNational : null;

  const ledgerCandidates: Array<RecordFigure | null> = data && total
    ? [
        total.empPending !== null ? { href: "#busiest", value: total.empPending, label: "employment-based I-485 applications pending, every office", asOf: data.quarterEnd, asOfKind: "through" as const } : null,
        total.empApproved !== null ? { href: "#service-centers", value: total.empApproved, label: "employment-based I-485 approvals in the quarter", asOf: data.quarterEnd, asOfKind: "through" as const } : null,
        total.empDenied !== null ? { href: "#service-centers", value: total.empDenied, label: "employment-based denials in the quarter", asOf: data.quarterEnd, asOfKind: "through" as const } : null,
        total.empReceived !== null ? { href: "#every-office", value: total.empReceived, label: "employment-based applications received", asOf: data.quarterEnd, asOfKind: "through" as const } : null,
      ]
    : [];
  const ledger = ledgerCandidates.filter((f): f is RecordFigure => f !== null);

  const busiest = rankOffices(fieldOffices, "empPending", 15);
  const prev = data?.previous ?? null;
  const busiestRows: BarRow[] = busiest.map((o) => {
    const before = prev ? prev.empPendingByCode[o.code] : undefined;
    const delta = before !== undefined && before !== null && o.empPending !== null ? o.empPending - before : null;
    return {
      key: o.code,
      label: `${o.office}, ${o.state}`,
      sub: delta === null
        ? `${fmt(o.empApproved)} approved, ${fmt(o.empDenied)} denied in the quarter`
        : `${delta >= 0 ? "+" : ""}${delta.toLocaleString("en-US")} since ${prev ? quarterLabel(prev.fy, prev.quarter).split(" (")[0] : "last quarter"} · ${fmt(o.empApproved)} approved, ${fmt(o.empDenied)} denied`,
      value: o.empPending,
      text: fmt(o.empPending),
    };
  });

  const WORK_FLOOR = 1000;
  const workRows: BarRow[] = fieldOffices
    .filter((o) => (o.empPending ?? 0) >= WORK_FLOOR)
    .map((o) => ({ o, q: quartersOfWork(o) }))
    .filter((x): x is { o: OfficeRow; q: number } => x.q !== null)
    .sort((a, b) => b.q - a.q)
    .slice(0, 15)
    .map(({ o, q }) => ({
      key: o.code,
      label: `${o.office}, ${o.state}`,
      sub: `${fmt(o.empPending)} pending against ${((o.empApproved ?? 0) + (o.empDenied ?? 0)).toLocaleString("en-US")} decided in the quarter`,
      value: q,
      text: `${q.toFixed(1)} qtrs`,
      tone: "ink" as const,
    }));

  const centerRows: BarRow[] = [...serviceCenters]
    .sort((a, b) => (b.empApproved ?? 0) - (a.empApproved ?? 0))
    .map((o) => ({
      key: o.code,
      label: `${o.office} (${o.code})`,
      sub: `${fmt(o.empDenied)} denied, ${fmt(o.empPending)} pending`,
      value: o.empApproved,
      text: fmt(o.empApproved),
    }));
  const fieldApproved = sumMeasure(fieldOffices, "empApproved");
  const centerApproved = sumMeasure(serviceCenters, "empApproved");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={breadcrumb} />

      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          USCIS quarterly data{data ? ` · ${quarterLabel(data.fy, data.quarter)}` : ""}
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          The I-485 by field office
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          What each USCIS office received, approved, denied and still holds,
          employment-based first, from USCIS&apos;s own quarterly count. The
          busiest offices, how many quarters of work each has in front of it at
          last quarter&apos;s pace, and the service centers that decide most cases
          without an interview.
        </p>
      </header>

      {!data || !total ? (
        <QuarterlyEmpty file="i485_performance_data" />
      ) : (
        <>
          <RecordStrip record={ledger} />
          {workNational !== null ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/80">
              Nationally, that pending pile is{" "}
              <b className="font-bold text-foreground">{workNational.toFixed(1)} quarters of work</b>{" "}
              at the quarter&apos;s pace of {decidedNational!.toLocaleString("en-US")} decisions, every
              office and service center together.
            </p>
          ) : null}

          <section id="busiest" className="mt-12 scroll-mt-24">
            <FigurePlate
              n="01"
              title="Employment-based I-485 pending"
              subject="The fifteen field offices holding the most"
              caption={
                <>
                  Applications awaiting a decision at each office on the quarter&apos;s
                  last day, with the change since the previous quarter where this site
                  holds it. Field offices only; the service centers are Fig 03.
                </>
              }
              source={<>USCIS, {data.sourceFile}, employment-based, pending as of {data.quarterEnd}.</>}
            >
              <BarRows rows={busiestRows} />
            </FigurePlate>
          </section>

          {workRows.length > 0 ? (
            <section id="quarters-of-work" className="mt-12 scroll-mt-24">
              <FigurePlate
                n="02"
                title="Quarters of work in the pile"
                subject={`Offices with ${WORK_FLOOR.toLocaleString("en-US")} or more employment-based pending`}
                caption={
                  <>
                    Pending divided by the quarter&apos;s approvals plus denials: how many
                    quarters the office would need at that pace to clear what it holds.
                    A comparison of workload, not a wait for any one case, and an office
                    that cleared old cases in a burst reads better than it will next
                    quarter.
                  </>
                }
                source={<>Arithmetic on USCIS&apos;s pending, approved and denied columns, {quarterLabel(data.fy, data.quarter)}.</>}
              >
                <BarRows rows={workRows} />
              </FigurePlate>
            </section>
          ) : null}

          <section id="service-centers" className="mt-12 scroll-mt-24">
            <FigurePlate
              n="03"
              title="Where employment-based I-485s are approved"
              subject="Service centers against the field offices"
              caption={
                <>
                  The service centers and the National Benefits Center approved{" "}
                  {centerApproved.total.toLocaleString("en-US")} employment-based I-485s in the
                  quarter; every field office together approved{" "}
                  {fieldApproved.total.toLocaleString("en-US")}
                  {fieldApproved.withheld ? ` (${fieldApproved.withheld} cells withheld)` : ""}. Most
                  employment-based cases are decided without an interview, which is why the
                  field-office rows above carry small approval counts beside large piles.
                </>
              }
              source={<>USCIS, {data.sourceFile}, approved in the quarter.</>}
            >
              <BarRows rows={centerRows} />
            </FigurePlate>
          </section>

          <section id="every-office" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-black">Every office, by state</h2>{" "}
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
              {fieldOffices.length} field offices and {serviceCenters.length} service
              centers. Open a state for its offices; every column is USCIS&apos;s, for
              the employment-based half, and the family-based pending count is beside
              it for scale.
            </p>{" "}
            <div className="mt-4 space-y-3">
              {groupByState(data.offices).map(({ state, offices }) => (
                <Fragment key={state}>{" "}
                <details className="group border-2 border-border bg-card">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 font-heading text-lg font-bold [&::-webkit-details-marker]:hidden">
                    <span>{state}</span>{" "}
                    <span className="font-mono text-sm font-bold text-muted-foreground">
                      {offices.length} {offices.length === 1 ? "office" : "offices"} · {sumMeasure(offices, "empPending").total.toLocaleString("en-US")} EB pending
                    </span>
                  </summary>{" "}
                  <div className="overflow-x-auto border-t-2 border-border">
                    <table className="min-w-[720px] w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="px-4 py-2 font-bold">Office{" "}</th>
                          <th className="px-2 py-2 font-bold">Code{" "}</th>
                          <th className="px-2 py-2 text-right font-bold">EB received{" "}</th>
                          <th className="px-2 py-2 text-right font-bold">EB approved{" "}</th>
                          <th className="px-2 py-2 text-right font-bold">EB denied{" "}</th>
                          <th className="px-2 py-2 text-right font-bold">EB pending{" "}</th>
                          <th className="px-4 py-2 text-right font-bold">Family pending{" "}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offices.map((o) => (
                          <tr key={o.code} className="border-b border-border/50">
                            <td className="px-4 py-1.5 font-semibold">{o.office}{" "}</td>
                            <td className="px-2 py-1.5 font-mono">{o.code}{" "}</td>
                            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{fmt(o.empReceived)}{" "}</td>
                            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{fmt(o.empApproved)}{" "}</td>
                            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{fmt(o.empDenied)}{" "}</td>
                            <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums">{fmt(o.empPending)}{" "}</td>
                            <td className="px-4 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{fmt(o.famPending)}{" "}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                </Fragment>
              ))}
            </div>{" "}
            <FinePrint summary="What the columns mean, in USCIS's words" className="mt-4">
              <p>
                Received is new applications entered in the quarter; approved and denied
                are decisions issued in the quarter; pending is what awaited a decision
                on its last day. USCIS notes that transfers between offices and
                administrative closures are not in the report, so a pending count cannot
                be computed from earlier periods. The office location is where the case
                sits, not the whole area the office covers. Employment-based
                applications are received at a service center and routed from there.
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
            <Link href="/guides/fastest-field-office-eb-i485" className="font-bold underline underline-offset-2 hover:text-primary">
              Which field office is fastest for an employment-based I-485
            </Link>
          </li>{" "}
          <li>
            <Link href="/tools/i485-queue-position" className="font-bold underline underline-offset-2 hover:text-primary">
              Your place in USCIS&apos;s I-485 inventory by priority date
            </Link>
          </li>{" "}
          <li>
            <Link href="/guides/i485-vs-i485j-supplement-j" className="font-bold underline underline-offset-2 hover:text-primary">
              I-485 and Supplement J, told apart
            </Link>
          </li>
        </ul>
      </section>

      <PageBasics page="i485-by-field-office" />{" "}
      <DataProvenance datasets={["uscis-i485-offices"]} />
    </div>
  );
}
