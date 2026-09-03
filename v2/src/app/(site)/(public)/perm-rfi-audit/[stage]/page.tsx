/**
 * One review stage, on its own page.
 *
 * WHAT THIS ADDS THAT THE AUDIT PAGE DOES NOT. /perm-rfi-audit answers "what
 * is an RFI and how many are open". It cannot answer "how long have those
 * cases been sitting there, and is mine among them", because a census has no
 * rows in it. That was the gap: the stage counts were on the page and nothing
 * went anywhere.
 *
 * WHY FIVE PAGES AND NOT TWELVE. Measured 2026-08-30, pending, DOL's own test
 * fixture excluded: ANALYST REVIEW 93,219, RECONSIDERATION APPEALS 2,335,
 * APPLICATION ON HOLD 1,855, RFI ISSUED 974, BALCA APPEALS 351, NORD ISSUED
 * 108, and then four stages holding between 2 and 9 cases. That is not a
 * distribution, it is one stage and then everything else, and one listing rule
 * cannot be right across it:
 *
 *   - ANALYST REVIEW is excluded at the route level. It is the ordinary queue,
 *     /perm-queue already draws it month by month against DOL's published
 *     position, and 93,219 rows is 933 pages of a worse version of that.
 *   - Under SMALL_STAGE_MAX the rows are withheld. At that size a case number
 *     beside an employer and a job title identifies a person, and the audit
 *     page already prints these records WITHOUT case numbers on purpose. A
 *     second, more identifying copy of four people's applications is not more
 *     browsable, it is just more exposed.
 *   - In between, the cases are listed.
 *
 * WHY THERE IS NO PAGINATION, WHICH IS A DELIBERATE REFUSAL. Reading
 * `searchParams` would make all five of these dynamic, so every crawler hit
 * becomes a cold render, and the page would still be answering its weakest
 * question. A reader wants four things here: what the status means, how many
 * are in it, how long they have waited, and whether their own case is one of
 * them. The list serves the third; the fourth is already served better by
 * /perm-case-status, which asks DOL live. So the page shows the OLDEST cases -
 * the ones that answer "how long" - caps the list, and says plainly how many
 * it is not showing rather than implying it is showing everything.
 *
 * THE COUNT COMES FROM THE SAME QUERY THE AUDIT PAGE USES. `getReviewStages`
 * on both, so the number a reader clicks and the number they land on cannot
 * disagree. That costs one heavy query per stage per revalidation - five a day
 * - and is worth it: two different totals for one cohort on two linked pages
 * would discredit both.
 */

import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DataProvenance } from "@/components/data/DataProvenance";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { stageEntry } from "@/components/rfi/StageGlossary";
import {
  GROUP_STYLE,
  reviewStages,
  stageFromSlug,
  stageMeta,
} from "@/components/rfi/stageMeta";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { formatAsOf } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";
import {
  getReviewStages,
  getStageCohorts,
  listStageCases,
  stageListing,
} from "@/lib/turso/rfi";
import { getFreshness } from "@/lib/turso/publicData";

/** Same window as the audit page this is a leaf of: the mirror moves daily. */
export const revalidate = 86400;

/**
 * The slug set is closed and known at build time, so a junk slug 404s without
 * ever rendering. That is the mechanism this codebase already relies on for
 * content routes: any loading boundary above a segment makes Next commit
 * "200 OK" to the wire before page code runs, after which `notFound()` can
 * swap the UI but never the status.
 */
export const dynamicParams = false;

/**
 * How many rows the page prints.
 *
 * Bounded so the largest stage does not ship a 2,335-row RSC payload for a
 * question the first hundred rows already answer. It covers NORD ISSUED
 * entirely and most of BALCA APPEALS; on the three larger stages the page
 * states the remainder in words rather than trailing off.
 */
const MAX_ROWS = 250;

export function generateStaticParams() {
  return reviewStages().map((s) => ({ stage: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ stage: string }>;
}): Promise<Metadata> {
  const { stage } = await params;
  const status = stageFromSlug(stage);
  if (!status) notFound();
  const meta = stageMeta(status);
  const entry = stageEntry(status);

  const title = `PERM ${meta.label}`;
  // The definition's own first sentence, which is CFR-sourced where a
  // regulation defines the stage. Writing a second description here would be
  // an uncited paraphrase of a text whose whole design is that it cannot
  // contain one.
  const first = entry?.what.split(/(?<=\.)\s/)[0] ?? "";
  const description =
    `${first} How many PERM cases sit at this stage right now, how long they have waited, and which filing months they come from.`.slice(
      0,
      155,
    );

  return {
    title,
    description,
    alternates: { canonical: `/perm-rfi-audit/${stage}` },
    openGraph: {
      ...openGraphBase,
      title: `${title} | PERM Tracker`,
      description,
      url: `/perm-rfi-audit/${stage}`,
    },
  };
}

const int = (n: number) => n.toLocaleString("en-US");

export default async function StagePage({
  params,
}: {
  params: Promise<{ stage: string }>;
}) {
  const { stage } = await params;
  const status = stageFromSlug(stage);
  if (!status) notFound();

  const meta = stageMeta(status);
  const entry = stageEntry(status);

  const [stages, cohorts, fresh] = await Promise.all([
    getReviewStages(),
    getStageCohorts([status]),
    getFreshness().catch(() => ({}) as Record<string, { asOf: string | null }>),
  ]);

  const row = stages.find((s) => s.status === status) ?? null;
  const cases = row?.cases ?? 0;
  const listing = stageListing(cases);
  // Only read the rows the page is actually going to print. A stage below the
  // floor or above the ceiling never issues this query at all.
  const records =
    listing === "list" ? await listStageCases(status, MAX_ROWS, 0) : [];
  // THE FALLBACK HAS TO MATCH THE HUB'S FALLBACK, not merely exist.
  //
  // Fixing the dates for stages that have rows left this line disagreeing for
  // the one that does not. PENDING AUDIT RESPONSE holds nothing, so it has no
  // `seenTo`; the hub fell back to the latest observation across all stages
  // (August 30) and this fell back to the ingest's freshness stamp (August
  // 29). Two dates for one zero, on two pages that link to each other - the
  // same defect one level down from where it was just fixed.
  //
  // Both compute the same thing from the same array now. The freshness stamp
  // survives as the last resort for a deploy-skew window where the census
  // read returns nothing at all.
  const censusAsOf = stages.reduce<string | null>(
    (latest, st) =>
      st.seenTo && (latest === null || st.seenTo > latest) ? st.seenTo : latest,
    null,
  );
  const asOf = row?.seenTo ?? censusAsOf ?? fresh["perm-case-status"]?.asOf ?? null;

  // Filing months this stage's open cases come from, biggest first. Reuses the
  // audit page's own cohort query rather than adding a second one.
  const months = cohorts
    .map((c) => ({ month: c.month, n: c.stages[status] ?? 0 }))
    .filter((m) => m.n > 0)
    .sort((a, b) => b.n - a.n || a.month.localeCompare(b.month));
  const oldestMonth = months.length
    ? months.reduce((a, b) => (a.month <= b.month ? a : b)).month
    : null;

  return (
    <>
      <JsonLdScript
        schema={generateBreadcrumbSchema([
          { name: "Home", href: "/" },
          { name: "RFI, audits and appeals", href: "/perm-rfi-audit" },
          { name: meta.label, href: `/perm-rfi-audit/${stage}` },
        ])}
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">        <p className="mt-8 font-mono text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">
          <Link href="/perm-rfi-audit" className="underline hover:text-primary">
            RFI, audits and appeals
          </Link>
        </p>{" "}
        {/* Without this the breadcrumb welds to the heading and every
            extractor reads "RFI, audits and appealsRFI issued". */}
        <h1 className="mt-3 font-heading text-3xl font-black leading-tight sm:text-5xl">
          <span
            className="mr-3 inline-block h-4 w-4 shrink-0 border-2 border-border align-middle"
            style={{ backgroundColor: GROUP_STYLE[meta.group].fill }}
            aria-hidden="true"
          />{" "}
          {meta.label}
        </h1>{" "}
        <p className="mt-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {status}
        </p>

        {entry ? (
          <div className="mt-6 max-w-3xl grid gap-3 text-lg leading-relaxed">
            <p>{entry.what}</p>{" "}
            {entry.deadline ? (
              <p className="border-l-4 border-[var(--data-warn)] bg-[var(--data-warn)]/10 px-4 py-3 text-base">
                <b className="font-bold">Deadline.</b> {entry.deadline}
              </p>
            ) : null}{" "}
            {entry.next ? (
              <p className="text-base text-foreground/70">{entry.next}</p>
            ) : null}
          </div>
        ) : null}

        <section className="mt-10 grid gap-px border-2 border-border bg-border sm:grid-cols-3">
          {[
            {
              k: "Cases at this stage",
              v: int(cases),
              sub: asOf ? `as of ${formatAsOf(asOf) ?? asOf}` : "",
            },
            {
              k: "Typical wait so far",
              v: row?.ageBand ? `${int(row.ageBand.median)} days` : "—",
              // The withholding rule is the audit page's, and the reason
              // travels with the blank rather than leaving a bare dash.
              sub: row?.ageBand
                ? `${int(row.ageBand.p10)} to ${int(row.ageBand.p90)} days across the middle`
                : "too few cases carry both dates to draw a spread",
            },
            {
              k: "Employer names",
              v: row ? int(row.employerNames) : "—",
              sub:
                row && row.topEmployer && row.topEmployerCases > 1
                  ? `largest holds ${int(row.topEmployerCases)}`
                  : "",
            },
          ].map((d) => (
            <Fragment key={d.k}>{" "}
            <div className="bg-card p-5">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                {d.k}
              </p>{" "}
              <p className="mt-1.5 font-heading text-2xl font-black tabular-nums">
                {d.v}
              </p>{" "}
              {d.sub ? (
                <p className="mt-1 text-xs text-foreground/70">{d.sub}</p>
              ) : null}
            </div>
            </Fragment>
          ))}
        </section>

        {months.length > 0 ? (
          <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
            <h2 className="font-heading text-xl font-black sm:text-2xl">
              Which filing months these come from
            </h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
              Where cases are held today, not how often DOL issues one: a live
              status shows only where a case stands now.
            </p>
            <ol className="mt-5 space-y-1">
              {months.slice(0, 18).map((m) => {
                const share = cases > 0 ? (m.n / cases) * 100 : 0;
                return (
                  <Fragment key={m.month}>{" "}
                  <li className="grid min-h-11 grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 [&>*]:min-w-0 sm:gap-3">
                    <Link
                      href={`/perm-queue/${m.month}`}
                      className="truncate text-sm underline underline-offset-2 hover:text-primary"
                    >
                      {m.month}
                    </Link>{" "}
                    <span
                      className="h-3 border border-border"
                      style={{
                        width: `${Math.max(1, share)}%`,
                        backgroundColor: GROUP_STYLE[meta.group].fill,
                      }}
                      aria-hidden="true"
                    />{" "}
                    <span className="text-right text-sm tabular-nums text-foreground/80">
                      {int(m.n)}
                    </span>
                  </li>
                  </Fragment>
                );
              })}
            </ol>{" "}
            {months.length > 18 ? (
              <p className="mt-4 text-sm text-foreground/70">
                {int(months.length - 18)} further months hold smaller numbers.
                {oldestMonth ? ` The oldest is ${oldestMonth}.` : ""}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
          <h2 className="font-heading text-xl font-black sm:text-2xl">
            {listing === "list"
              ? records.length >= cases
                ? `All ${int(cases)} of them`
                : `The ${int(records.length)} that have waited longest`
              : "The cases themselves"}
          </h2>{" "}

          {listing === "too-large" ? (
            <p className="mt-2 max-w-3xl text-base leading-relaxed">
              {int(cases)} cases, which is the ordinary queue rather than a
              stage anyone was pulled aside into. It is drawn month by month
              on{" "}
              <Link
                href="/perm-queue"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                the backlog board
              </Link>{" "}
              draws every filing month against DOL&apos;s own published
              position, which is what a queue this size is actually asking.
            </p>
          ) : null}

          {/* The zero case gets its own sentence rather than sharing the
              small-cohort one. "See them on the audit page" printed under
              "No case is at this stage today" invited the reader to go and
              look at nothing. A stage standing empty is a real answer to a
              real question, so the page gives it plainly and sends them
              somewhere that has something on it. */}
          {listing === "too-small" ? (
            cases === 0 ? (
              <p className="mt-2 max-w-3xl text-base leading-relaxed">
                No case is at this stage today. That can change any day, and
                this page is rebuilt daily.{" "}
                <Link
                  href="/perm-rfi-audit"
                  className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  The other stages
                </Link>{" "}
                are where the pending cases are.
              </p>
            ) : (
              <p className="mt-2 max-w-3xl text-base leading-relaxed">
                Only {int(cases)} {cases === 1 ? "case is" : "cases are"} at
                this stage, and at that size a case number printed beside an
                employer and a job title identifies a person. The audit page
                lists these records without case numbers, which is as far as
                it should go.{" "}
                <Link
                  href="/perm-rfi-audit"
                  className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  See them on the audit page
                </Link>
                .
              </p>
            )
          ) : null}

          {listing === "list" ? (
            <>
              <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
                Oldest filing first. DOL&apos;s live record carries the case
                number, employer and job title; the wage, law firm and worksite
                arrive only with publication, so they are absent rather than
                blank.
              </p>
              <ul className="mt-4 divide-y divide-border/60">
                {records.map((c) => (
                  <Fragment key={c.caseNumber}>{" "}
                  <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-base">
                    <Link
                      href={`/perm-case-status?case=${encodeURIComponent(c.caseNumber)}`}
                      className="font-mono text-sm font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                    >
                      {c.caseNumber}
                    </Link>{" "}
                    {/* Linked only when the nightly rebuild resolved a slug
                        for this case. `/perm-employers?q=` was the first
                        version of this and it was wrong in the quiet way: the
                        `?q=` search is an API route, so that URL returns 200,
                        renders the plain index, and silently drops what the
                        link promised to search for. */}
                    {c.employer && c.employerSlug ? (
                      <Link
                        href={`/perm-employers/${c.employerSlug}`}
                        className="underline underline-offset-2 hover:text-primary"
                      >
                        {c.employer}
                      </Link>
                    ) : c.employer ? (
                      <span>{c.employer}</span>
                    ) : null}{" "}
                    {c.jobTitle ? (
                      <span className="text-foreground/70">{c.jobTitle}</span>
                    ) : null}{" "}
                    <span className="ml-auto text-sm tabular-nums text-foreground/70">
                      {c.filingDate ? `filed ${c.filingDate}` : ""}
                    </span>
                  </li>
                  </Fragment>
                ))}
              </ul>{" "}
              {records.length < cases ? (
                <p className="mt-5 max-w-3xl text-sm leading-relaxed text-foreground/70">
                  {int(cases - records.length)} newer cases are not listed.
                  No page two on purpose: to find one case, ask DOL directly
                  through{" "}
                  <Link
                    href="/perm-case-status"
                    className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                  >
                    the case lookup
                  </Link>
                  , which reads the live record at the moment you ask rather
                  than whenever this page was last built.
                </p>
              ) : null}
            </>
          ) : null}

          <p className="mt-5 border-t-2 border-border pt-3 font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
            {asOf
              ? `DOL live case record, as of ${formatAsOf(asOf) ?? asOf}`
              : "DOL live case record"}
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-xl font-black sm:text-2xl">
            The other stages
          </h2>{" "}
          <ul className="mt-4 flex flex-wrap gap-2">
            {/* From the STATIC vocabulary, not from the query. A stage
                holding nothing today returns no row from `getReviewStages`,
                so a data-driven list here would drop it - and since the
                glossary count is the only other link into these pages, that
                left an empty stage in the sitemap with no inbound link
                anywhere. Its count is a real zero, which is an answer. */}
            {reviewStages()
              .filter((s) => s.status !== status)
              .map((s) => (
                <Fragment key={s.status}>{" "}
                <li>
                  <Link
                    href={`/perm-rfi-audit/${s.slug}`}
                    className="inline-flex min-h-11 items-center gap-2 border-2 border-border bg-card px-3 text-sm font-bold shadow-hard-sm hover:bg-tint-primary"
                  >
                    {stageMeta(s.status).label}
                    <span className="font-mono text-xs font-normal tabular-nums text-foreground/70">
                      {int(stages.find((x) => x.status === s.status)?.cases ?? 0)}
                    </span>
                  </Link>
                </li>
                </Fragment>
              ))}
          </ul>
        </section>

        <div className="mt-10">
          <DataProvenance datasets={["perm-case-status"]} />
        </div>
      </div>
    </>
  );
}
