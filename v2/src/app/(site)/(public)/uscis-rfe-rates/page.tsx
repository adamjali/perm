/**
 * How often USCIS sends a request for evidence (an RFE) before deciding an
 * I-129 work visa petition, month by month, from the counts USCIS publishes
 * each quarter (scripts/ingest_uscis_rfe.py, every file checked against its
 * own totals before a row is written).
 *
 * Every share on the page is computed from USCIS's counts in
 * `src/lib/uscisRfe.ts`; nothing is typed into the copy. The file covers the
 * I-129 alone, which is the page's first caveat: there's no published RFE
 * count for the I-140 or the I-485.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { ChartHit } from "@/components/data/ChartHit";
import { ChartTips } from "@/components/data/ChartTips";
import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { PageBasics } from "@/components/data/PageBasics";
import { QuarterlyEmpty } from "@/components/data/BarRows";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { CaveatBox } from "@/components/ui/note";
import { ScrollBox } from "@/components/ui/scroll-box";
import { SITE_URL } from "@/lib/constants/site";
import { formatAsOf } from "@/lib/dolFormat";
import { getRfeMonths, getRfeSummary } from "@/lib/db/uscisRfe";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import {
  fiscalYears,
  monthLabel,
  monthSeries,
  monthShort,
  pct,
  peakMonth,
  sameMonths,
  visaYears,
  yearsFor,
  type RfeMonthPoint,
  type RfeYear,
} from "@/lib/uscisRfe";

const TITLE = "USCIS RFE Rates: H-1B, L-1, O-1 and More";
const DESCRIPTION =
  "How often USCIS sent a request for evidence on H-1B, L-1, O-1 and other work visa petitions, by month since FY2015, from USCIS's own quarterly files.";
const PATH = "/uscis-rfe-rates";
const USCIS_DATA_PAGE = "https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: PATH },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
  },
  "uscis-rfe-rates",
);

// Quarterly data on a weekly window, like the other USCIS quarterly pages.
export const revalidate = 604800;

const int = (n: number) => n.toLocaleString("en-US");

/**
 * H-1B decisions with an RFE, one column a month. The column's height is the
 * share of the month's decisions that had an RFE (blue); the green part at its
 * foot is the ones approved after it. One `<text>` per label with a trailing
 * space inside, because SVG text glues like any text. The drawing keeps a
 * 960px minimum and scrolls in its own box, so its 14px labels stay 14px.
 */
function MonthChart({ points, label }: { points: RfeMonthPoint[]; label: string }) {
  const W = 960, H = 300, L = 48, R = 8, T = 12, B = 40;
  const top = Math.max(10, Math.ceil(Math.max(0, ...points.map((p) => (p.rfeShare ?? 0) * 100)) / 10) * 10);
  const plotH = H - T - B;
  const bw = (W - L - R) / Math.max(points.length, 1);
  const y = (share: number) => T + (1 - (share * 100) / top) * plotH;
  const ticks = Array.from({ length: top / 10 + 1 }, (_, i) => i * 10);
  const octobers = points.map((p, i) => ({ p, i })).filter(({ p }) => p.month === 10);
  return (
    <ChartTips label={label} scroll="" startAtEnd>
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[960px] w-full" role="group" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t / 100)} y2={y(t / 100)} className="stroke-chart-sage" strokeWidth={1} />
            <text x={L - 8} y={y(t / 100) + 5} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={14}>{`${t}%`}{" "}</text>
          </g>
        ))}
        {octobers.map(({ p, i }) => (
          <g key={`fy-${p.fy}`}>
            <line x1={L + i * bw} x2={L + i * bw} y1={T} y2={H - B} className="stroke-chart-sage" strokeWidth={1} />
            <text x={L + i * bw + 3} y={H - 14} className="fill-muted-foreground font-mono" fontSize={14}>{`FY${String(p.fy).slice(2)}`}{" "}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const share = p.rfeShare ?? 0;
          const ok = p.approvedAfterRfeOfAll ?? 0;
          const x = L + i * bw + 0.5;
          const w = Math.max(bw - 1, 1);
          const tip = [
            monthLabel(p.fy, p.month),
            `${pct(p.rfeShare)} of ${int(p.completions)} decisions had an RFE`,
            p.rfeCompletions > 0
              ? `${int(p.rfeApproved)} of those ${int(p.rfeCompletions)} were approved (${pct(p.rfeApproved / p.rfeCompletions)})`
              : "none had an RFE",
          ].join("\n");
          return (
            <ChartHit key={p.key} tip={tip} x={L + i * bw} width={bw} y={T} height={plotH}>
              <rect x={x} y={y(share)} width={w} height={(share * 100 * plotH) / top} className="fill-chart-blue" />
              <rect x={x} y={y(ok)} width={w} height={(ok * 100 * plotH) / top} className="fill-chart-green" />
              {/* Ink caps: the soft fills sit near 1.2:1 on paper, under WCAG 1.4.11's 3:1 for a mark; the caps pass. */}
              {share > 0 ? <rect x={x} y={y(share)} width={w} height={CAP} className="fill-data-info-ink" /> : null}
              {ok > 0 ? <rect x={x} y={y(ok)} width={w} height={CAP} className="fill-data-good-ink" /> : null}
            </ChartHit>
          );
        })}
      </svg>
    </ChartTips>
  );
}

/** A bar's ink cap, in the drawing's own units: the 2px edge the site's column chart gives its soft fills. */
const CAP = 2;

/** One visa's RFE share by fiscal year, on the scale every card shares. */
function YearBars({ label, years, top }: { label: string; years: RfeYear[]; top: number }) {
  const W = 320, H = 96, B = 22;
  const bw = W / Math.max(years.length, 1);
  return (
    <ChartTips label={`${label}: RFE share by fiscal year`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="group" aria-label={`${label}: RFE share by fiscal year`}>
        {years.map((yr, i) => {
          const share = yr.rfeShare ?? 0;
          const h = top > 0 ? ((H - B) * share) / top : 0;
          const tip = [
            `${label}, FY${yr.fy}${yr.complete ? "" : ` (${yr.months} months)`}`,
            `${pct(yr.rfeShare)} of ${int(yr.completions)} decisions had an RFE`,
            yr.rfeCompletions > 0 ? `${pct(yr.approvedAfterRfe)} of those approved` : "none had an RFE",
          ].join("\n");
          return (
            <ChartHit key={yr.fy} tip={tip} x={i * bw} width={bw} y={0} height={H - B}>
              <rect x={i * bw + 1} y={H - B - h} width={Math.max(bw - 2, 1)} height={h} className="fill-chart-blue" />
              {h > 0 ? <rect x={i * bw + 1} y={H - B - h} width={Math.max(bw - 2, 1)} height={CAP} className="fill-data-info-ink" /> : null}
            </ChartHit>
          );
        })}
        {years.length > 0 ? (
          <>
            <text x={0} y={H - 4} className="fill-muted-foreground font-mono" fontSize={14}>{`FY${years[0]!.fy}`}{" "}</text>
            <text x={W} y={H - 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={14}>{`FY${years[years.length - 1]!.fy}`}{" "}</text>
          </>
        ) : null}
      </svg>
    </ChartTips>
  );
}

/** What the H-1B record shows around FY2018 and FY2019, from the years held, or null. */
function spikeSentence(years: RfeYear[], peak: RfeMonthPoint | null): string | null {
  const at = (fy: number) => years.find((y) => y.fy === fy && y.complete);
  const [a, b, c, d] = [at(2017), at(2018), at(2019), at(2021)];
  if (!a || !b || !c || !d || !peak) return null;
  const newest = [...years].reverse().find((y) => y.complete);
  return (
    `The H-1B share was ${pct(a.rfeShare)} in FY2017, ${pct(b.rfeShare)} in FY2018 and ${pct(c.rfeShare)} in FY2019, ` +
    `and its highest month was ${monthLabel(peak.fy, peak.month)}, at ${pct(peak.rfeShare)}. ` +
    `It was ${pct(d.rfeShare)} in FY2021` +
    (newest && newest.fy > 2021 ? ` and ${pct(newest.rfeShare)} in FY${newest.fy}.` : ".")
  );
}

export default async function UscisRfeRatesPage() {
  const [months, summary] = await Promise.all([getRfeMonths(), getRfeSummary()]);
  const h1b = sameMonths(months, "h1b");

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "USCIS I-129 requests for evidence, by month and visa classification",
    description:
      "Petitions received, initially approved and denied, completions, and completions with a request for evidence, per month and I-129 visa classification, from USCIS's quarterly request-for-evidence files.",
    url: `${SITE_URL}${PATH}`,
    ...(summary ? { dateModified: summary.asOf } : {}),
    isBasedOn: USCIS_DATA_PAGE,
    creator: { "@type": "Organization", name: "U.S. Citizenship and Immigration Services", url: "https://www.uscis.gov" },
    isAccessibleForFree: true,
    license: "https://www.usa.gov/government-works",
    variableMeasured: ["petitions received", "initially approved", "initially denied", "total completions", "completions with an RFE", "approved with an RFE"],
  };

  if (months.length === 0 || !h1b) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="pt-10 sm:pt-12" />
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">USCIS RFE rates for work visa petitions</h1>{" "}
        <QuarterlyEmpty file="i129_quarterly_request_for_evidence" />
      </div>
    );
  }

  const fys = fiscalYears(months);
  const series = monthSeries(months, "h1b");
  const peak = peakMonth(series);
  const h1bYears = yearsFor(months, "h1b");
  const spike = spikeSentence(h1bYears, peak);
  const visas = visaYears(months);
  const cardTop = Math.max(0.1, ...visas.flatMap((v) => v.years.map((y) => y.rfeShare ?? 0)));
  const h1bFiles = [...new Set(series.map((p) => p.sourceFile))].filter(Boolean);
  const span = `${monthShort(h1b.first.fy, h1b.first.month)} to ${monthShort(h1b.last.fy, h1b.last.month)}`;
  const before = h1b.yearBefore;
  const spanBefore = before ? `${monthShort(before.fy, h1b.first.month)} to ${monthShort(before.fy, h1b.last.month)}` : "";
  const firstMonth = series[0]!;

  const figures = {
    h1bApprovedAfterRfe: h1b.now.approvedAfterRfe !== null ? pct(h1b.now.approvedAfterRfe) : undefined,
    h1bApprovalRate: h1b.now.approvalRate !== null ? pct(h1b.now.approvalRate) : undefined,
    h1bFy: `FY${h1b.fy}`,
    h1bSpan: span,
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />

      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
          USCIS RFE rates for H-1B, L-1, O-1 and other work visas
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          How often USCIS asked for more evidence before deciding an I-129 work visa petition, every month since{" "}
          {monthLabel(firstMonth.fy, firstMonth.month)}, from the counts USCIS publishes each quarter.
        </p>
      </header>

      <section id="h1b-now" className="mt-10 scroll-mt-24" aria-labelledby="h1b-now-title">
        <h2 id="h1b-now-title" className="font-heading text-2xl font-bold">
          H-1B, FY{h1b.fy} so far
        </h2>{" "}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <div className="border-2 border-border bg-sage p-5">
            <p className="text-sm font-bold text-muted-foreground">{span}</p>{" "}
            <p className="mt-2 font-heading text-5xl font-bold leading-none tabular-nums">{pct(h1b.now.rfeShare)}</p>{" "}
            <p className="mt-2 text-base">
              of the {int(h1b.now.completions)} H-1B petitions USCIS decided had an RFE ({int(h1b.now.rfeCompletions)}).
            </p>
          </div>{" "}
          {before ? (
            <div className="border-2 border-border bg-card p-5">
              <p className="text-sm font-bold text-muted-foreground">The same months a year earlier, {spanBefore}</p>{" "}
              <p className="mt-2 font-heading text-5xl font-bold leading-none tabular-nums">{pct(before.rfeShare)}</p>{" "}
              <p className="mt-2 text-base">
                of {int(before.completions)} decided had an RFE ({int(before.rfeCompletions)}).
              </p>
            </div>
          ) : null}
        </div>{" "}
        {h1b.now.approvedAfterRfe !== null && h1b.now.approvalRate !== null ? (
          <p className="mt-4 max-w-3xl text-base leading-relaxed">
            Of the H-1B petitions decided with an RFE in FY{h1b.fy} so far,{" "}
            <b className="font-bold">{pct(h1b.now.approvedAfterRfe)} were approved</b>, against{" "}
            {pct(h1b.now.approvalRate)} of all H-1B petitions decided. Data through{" "}
            {summary ? formatAsOf(summary.asOf) : monthLabel(h1b.last.fy, h1b.last.month)}.
          </p>
        ) : null}
      </section>

      <section id="h1b-by-month" className="mt-12 scroll-mt-24">
        <FigurePlate
          title="H-1B decisions with an RFE, by month"
          subject={`${monthShort(firstMonth.fy, firstMonth.month)} to ${monthShort(h1b.last.fy, h1b.last.month)}, share of the month's decisions`}
          caption={
            <>
              Each column is the share of the H-1B petitions USCIS decided that month that had an RFE. The green
              part at its foot is the ones approved after it.
            </>
          }
          source={
            <>
              USCIS&apos;s quarterly I-129 request-for-evidence files ({h1bFiles.length}), each checked against its own
              totals.
            </>
          }
        >
          <MonthChart points={series} label="H-1B decisions with an RFE, by month" />{" "}
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block size-3 border border-foreground/40 bg-chart-blue" />{" "}
              <span>Had an RFE</span>
            </li>{" "}
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block size-3 border border-foreground/40 bg-chart-green" />{" "}
              <span>Had an RFE and was approved</span>
            </li>
          </ul>{" "}
          {spike ? <p className="mt-4 max-w-3xl text-base leading-relaxed">{spike}</p> : null}
        </FigurePlate>
      </section>

      <section id="by-visa" className="mt-12 scroll-mt-24">
        <h2 className="font-heading text-2xl font-bold">Every I-129 visa, by fiscal year</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
          The share of each visa&apos;s decisions that had an RFE, FY{fys[0]} to FY{fys[fys.length - 1]}, every card on the
          same scale.
        </p>{" "}
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {visas.map((v) => {
            const latest = v.years[v.years.length - 1]!;
            return (
              <Fragment key={v.key}>
                {" "}
                <li className="border-2 border-border bg-card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-heading text-lg font-bold">{v.label}</h3>{" "}
                    <p className="font-mono text-sm text-muted-foreground">
                      FY{latest.fy}
                      {latest.complete ? "" : " so far"}
                    </p>
                  </div>{" "}
                  <p className="mt-1 font-heading text-3xl font-bold tabular-nums">{pct(latest.rfeShare)}</p>{" "}
                  <p className="text-sm text-soft">
                    of {int(latest.completions)} decided had an RFE
                    {latest.approvedAfterRfe !== null ? `, ${pct(latest.approvedAfterRfe)} of those approved` : ""}
                  </p>{" "}
                  <div className="mt-3">
                    <YearBars label={v.label} years={v.years} top={cardTop} />
                  </div>{" "}
                  {v.key === "l1" ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      FY{v.years[0]!.fy} to FY{latest.fy} only: the files that reach those years print L-1A and L-1B as
                      one table.
                    </p>
                  ) : null}
                </li>
              </Fragment>
            );
          })}
        </ul>{" "}
        <FinePrint summary="Every visa and year as a table" className="mt-4">
          <ScrollBox label="RFE share by visa and fiscal year">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left">
                  <th className="py-1.5 pr-3 font-bold">Visa{" "}</th>
                  {fys.map((fy) => (
                    <th key={fy} className="px-1.5 py-1.5 text-right font-bold">{`FY${String(fy).slice(2)}`}{" "}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visas.map((v) => (
                  <tr key={v.key} className="border-b border-border/60">
                    <td className="py-1.5 pr-3 font-bold">{v.label}{" "}</td>
                    {fys.map((fy) => {
                      const yr = v.years.find((x) => x.fy === fy);
                      return (
                        <td key={fy} className="px-1.5 py-1.5 text-right font-mono tabular-nums">
                          {yr ? pct(yr.rfeShare) : ""}{" "}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBox>{" "}
          <p className="mt-2">
            FY{fys[fys.length - 1]} runs to {monthLabel(h1b.last.fy, h1b.last.month)}. A blank cell is a year USCIS&apos;s files
            don&apos;t carry for that visa.
          </p>
        </FinePrint>
      </section>

      <section id="limits" className="mt-12 scroll-mt-24">
        <CaveatBox title="What this can't tell you">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              RFE rates for the I-140, the I-485 or any one employer. USCIS publishes these counts for the I-129 alone,
              and for no petitioner by name.
            </li>{" "}
            <li>
              How many RFEs were sent. A petition with several RFEs counts once, as one completion that had an RFE.
            </li>{" "}
            <li>
              What happened to petitions filed in a month. A month counts the petitions USCIS decided in it, many filed
              months earlier, and the RFE may have gone out in yet another month.
            </li>{" "}
            <li>
              Why the H-1B share rose in FY2018 and FY2019. The files count RFEs; they give no reason for them.
            </li>{" "}
            <li>
              Final outcomes. Approved and denied are USCIS&apos;s initial decisions; a later revocation or reopening
              isn&apos;t in them. Extensions and new petitions are counted together.
            </li>
          </ul>
        </CaveatBox>
      </section>

      <section className="mt-12 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-bold">Read next</h2>{" "}
        <ul className="mt-4 space-y-2">
          <li>
            <Link href="/uscis-processing-times" className="link">
              USCIS processing times, the median, by form
            </Link>
          </li>{" "}
          <li>
            <Link href="/h1b-employers" className="link">
              The busiest H-1B employers each year
            </Link>
          </li>{" "}
          <li>
            <Link href="/lca-cases" className="link">
              H-1B LCAs, the step before the petition
            </Link>
          </li>
        </ul>
      </section>

      <PageBasics page="uscis-rfe-rates" title="FAQs" figures={figures} />{" "}
      <DataProvenance datasets={["uscis-rfe"]} />
    </div>
  );
}
