/**
 * The State Department's immigrant visa waiting list at the National Visa
 * Center, November 1 of each year from 2016, by category. Read from
 * `perm_docs['nvc_waiting_list']` (scripts/ingest_nvc_waiting_list.py), which
 * reconciles every report against itself and against the report before it.
 */

import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import {
  EMPLOYMENT_ROWS,
  FAMILY_ROWS,
  categorySeries,
  changeLabel,
  type CategorySeries,
} from "@/lib/nvcWaitingList";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { getNvcWaitingList } from "@/lib/turso/nvcWaitingList";

export const revalidate = 86400;

const TITLE = "NVC Immigrant Visa Waiting List";
const DESCRIPTION =
  "The State Department's count of immigrant visa applicants waiting at the National Visa Center, by family and employment category, each November since 2016.";
const PATH = "/nvc-waiting-list";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "nvc-waiting-list");

function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

function dateLabel(iso: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
}

/** One category's years as small bars, the newest filled in the brand's ink. */
function Spark({ row, max }: { row: CategorySeries; max: number }) {
  const W = 240;
  const H = 48;
  const bw = W / Math.max(row.points.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full max-w-[240px] text-foreground" role="img" aria-label={`${row.label}, ${row.points.map((p) => `${yearOf(p.asOf)} ${p.n.toLocaleString("en-US")}`).join("; ")}`}>
      {row.points.map((p, i) => {
        const h = max > 0 ? (H * p.n) / max : 0;
        const last = i === row.points.length - 1;
        return (
          <rect key={p.asOf} x={i * bw + 1} y={H - h} width={Math.max(bw - 2, 1)} height={h} className={last ? "fill-foreground" : "fill-foreground/35"}>
            <title>{`November ${yearOf(p.asOf)}: ${p.n.toLocaleString("en-US")} `}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function CategoryTable({ rows, caption }: { rows: CategorySeries[]; caption: string }) {
  const max = Math.max(...rows.flatMap((r) => r.points.map((p) => p.n)), 1);
  return (
    <div className="mt-4 overflow-x-auto border-2 border-border bg-card shadow-hard">
      <table className="w-full min-w-[640px] text-left text-base">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b-2 border-border bg-muted/40">
          <tr>
            <th scope="col" className="px-4 py-3 font-bold">Category{" "}</th>
            <th scope="col" className="px-4 py-3 font-bold">Each November, oldest to newest{" "}</th>
            <th scope="col" className="px-4 py-3 text-right font-bold">Newest{" "}</th>
            <th scope="col" className="px-4 py-3 text-right font-bold">In a year{" "}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-4 py-3 font-bold">{r.label}{" "}</th>
              <td className="px-4 py-2">
                <Spark row={r} max={max} />{" "}
              </td>
              <td className="px-4 py-3 text-right font-bold tabular-nums">{r.latest.toLocaleString("en-US")}{" "}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.change === null ? "not measured" : changeLabel(r.change)}{" "}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function NvcWaitingListPage() {
  const wl = await getNvcWaitingList().catch(() => null);
  const breadcrumb = generateBreadcrumbSchema([
    { name: "Visa bulletin", href: "/visa-bulletin" },
    { name: "NVC waiting list", href: PATH },
  ]);

  const series = wl ? [...wl.series].sort((a, z) => a.asOf.localeCompare(z.asOf)) : [];
  const newest = series[series.length - 1];
  const before = series[series.length - 2];
  const employment = wl ? categorySeries(wl, EMPLOYMENT_ROWS) : [];
  const family = wl ? categorySeries(wl, FAMILY_ROWS) : [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={breadcrumb} />

      <header>
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Link href="/visa-bulletin" className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary">
            Visa bulletin
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">The immigrant visa waiting list</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          The State Department&apos;s yearly count of people with approved petitions waiting for an immigrant visa at the
          National Visa Center, by category.
        </p>
      </header>

      <div className="mt-8 border-l-4 border-primary bg-card p-5 shadow-hard">
        <p className="text-base leading-relaxed">
          <b className="font-bold">Consular cases only, families included.</b> It counts people whose visas will be
          processed at an embassy or consulate, with their spouses and children. Everyone adjusting status inside the US
          is left out, so for employment categories it understates demand, in State&apos;s own words
          &ldquo;significantly&rdquo;. Consulates also remove cases unlikely to move, so the list shrinks for reasons
          other than visas issued.
        </p>
      </div>

      {!wl || !newest ? (
        <p className="mt-10 max-w-2xl text-base text-foreground/80">
          The waiting list hasn&apos;t been loaded yet. The State Department publishes it on its{" "}
          <a
            href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-statistics/immigrant-visa-statistics.html"
            className="font-semibold underline underline-offset-2 hover:text-primary"
            rel="noopener"
            target="_blank"
          >
            immigrant visa statistics page
          </a>
          .
        </p>
      ) : (
        <>
          <section className="mt-10" aria-labelledby="totals">
            <h2 id="totals" className="sr-only">
              Totals
            </h2>
            <dl className="grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-3">
              {[
                { label: "Employment-based", now: newest.E, prev: before?.E },
                { label: "Family-sponsored", now: newest.F, prev: before?.F },
                { label: "Everyone on the list", now: newest.ALL, prev: before?.ALL },
              ].map((t) => (
                <Fragment key={t.label}>
                  {" "}
                  <div className="border-2 border-border bg-card p-5 shadow-hard">
                    <dt className="text-base text-foreground/75">{t.label}</dt>{" "}
                    <dd className="mt-1 font-heading text-3xl font-black tabular-nums">{t.now.toLocaleString("en-US")}</dd>{" "}
                    <dd className="font-mono text-sm text-muted-foreground">
                      {dateLabel(newest.asOf)}
                      {t.prev ? `, ${changeLabel((t.now - t.prev) / t.prev)} in a year` : ""}
                    </dd>
                  </div>
                </Fragment>
              ))}
            </dl>
          </section>

          <section className="mt-12" aria-labelledby="employment">
            <h2 id="employment" className="font-heading text-2xl font-black">
              Employment-based, by category
            </h2>{" "}
            <p className="mt-2 max-w-3xl text-base text-foreground/75">
              November {yearOf(series[0]!.asOf)} to November {yearOf(newest.asOf)}, one bar a year, all categories on one
              scale. People counted here are waiting abroad; the{" "}
              <Link href="/tools/green-card-line" className="font-semibold underline underline-offset-2 hover:text-primary">
                green card line
              </Link>{" "}
              counts the line as a whole.
            </p>{" "}
            <CategoryTable rows={employment} caption="Employment-based applicants at the National Visa Center, each November" />
          </section>

          {wl.employmentByCountry.length ? (
            <section className="mt-12" aria-labelledby="countries">
              <h2 id="countries" className="font-heading text-2xl font-black">
                Employment-based, by country, {dateLabel(newest.asOf)}
              </h2>{" "}
              <ul className="mt-4 grid grid-cols-1 gap-2 [&>*]:min-w-0 sm:grid-cols-2">
                {wl.employmentByCountry.map((c) => (
                  <Fragment key={c.country}>
                    {" "}
                    <li className="flex items-baseline justify-between gap-3 border-b border-border py-2">
                      <span>{c.country}</span>{" "}
                      <span className="font-bold tabular-nums">{c.applicants.toLocaleString("en-US")}</span>
                    </li>
                  </Fragment>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-12" aria-labelledby="family">
            <h2 id="family" className="font-heading text-2xl font-black">
              Family-sponsored, by category
            </h2>{" "}
            <CategoryTable rows={family} caption="Family-sponsored applicants at the National Visa Center, each November" />
          </section>

          <details className="group mt-12 border-2 border-border p-6 sm:p-8">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center font-heading text-lg font-black marker:content-none">
              How it&apos;s read, and what it can&apos;t tell you
            </summary>
            <div className="mt-3 max-w-3xl space-y-3 text-base leading-relaxed text-foreground/80">
              <p>
                Each report prints two Novembers. Every report is checked against itself (each sub-total and total adds
                up) and against the report before it (its earlier column must match that report&apos;s own figures).
                {wl.revisions.length === 0
                  ? " Every year matched exactly."
                  : ` ${wl.revisions.length} year${wl.revisions.length === 1 ? " was" : "s were"} restated by a later report; the later figure is shown.`}
              </p>{" "}
              <ul className="list-disc space-y-2 pl-5">
                <li>How long anyone waits. The list is a count, not a queue position, and the adjusting half is missing.</li>{" "}
                <li>Anything after {dateLabel(newest.asOf)}. That&apos;s the newest report this site holds.</li>{" "}
                <li>How many people were culled rather than issued visas between two Novembers.</li>
              </ul>{" "}
              <p>
                Reports as read:{" "}
                {Object.entries(wl.sources)
                  .sort(([a], [z]) => a.localeCompare(z))
                  .map(([asOf, url], i, all) => (
                    <Fragment key={asOf}>
                      <a href={url} className="font-semibold underline underline-offset-2 hover:text-primary" rel="noopener" target="_blank">
                        {yearOf(asOf)}
                      </a>
                      {i < all.length - 1 ? ", " : "."}
                    </Fragment>
                  ))}
              </p>
            </div>
          </details>
        </>
      )}

      <DataProvenance datasets={["nvc-waiting-list"]} />

      <ToolPageFooter
        currentHref={PATH}
        reading={[
          { href: "/tools/green-card-line", label: "The green card line", note: "everyone ahead of a priority date, adjusting and abroad" },
          { href: "/i140-awaiting-visa", label: "Approved I-140s waiting for a visa", note: "USCIS's count of the same wait, by petition" },
          { href: "/guides/eb3-other-workers", label: "EB-3 Other Workers", note: "the line that finishes mostly abroad" },
        ]}
      />
    </div>
  );
}
