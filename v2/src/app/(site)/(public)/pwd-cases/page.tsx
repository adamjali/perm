import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FlagCaseBrowser, PWD_PROGRAM } from "@/components/tools/FlagCaseBrowser";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { getPwdSummary, getPwdDisclosureSummary } from "@/lib/turso/pwdCases";

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

const TITLE = "PWD Case Search";
const DESCRIPTION =
  "Find a prevailing wage request (ETA-9141) by employer, job title and filing month: DOL's live status for pending ones, the wage DOL set for decided ones.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pwd-cases" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/pwd-cases",
  },
};

// The table grows nightly; a day bounds the header counts' staleness under
// the data's own cadence. The lists themselves are fetched by the browser.
export const revalidate = 86400;

function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function PwdCasesPage() {
  const [summary, disclosure] = await Promise.all([getPwdSummary(), getPwdDisclosureSummary()]);
  // byMonth is busiest-first from the doc; the earliest month is the oldest
  // filing the table has reached, which is what "since when" means here.
  const earliest = summary?.byMonth.length
    ? [...summary.byMonth].map((m) => m.month).sort()[0] ?? null
    : null;
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Data", href: "/tools" },
    { name: "Wage requests", href: "/pwd-cases" },
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={breadcrumbSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Live from DOL&apos;s daily check
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Find a prevailing wage request
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          The employer files the wage request months before the PERM. You
          rarely see its number. Search the employer to get it, with the job
          title, filing date, DOL&apos;s status and, once decided, the wage DOL set.
        </p>{" "}
        <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
          <div className="border-2 border-border bg-card p-4 shadow-hard">
            <dt className="text-sm font-bold text-foreground/70">Pending, from DOL&apos;s daily check</dt>{" "}
            <dd className="mt-1 font-heading text-3xl font-black">{summary ? summary.pending.toLocaleString("en-US") : "—"}</dd>
          </div>{" "}
          <div className="border-2 border-border bg-card p-4 shadow-hard">
            <dt className="text-sm font-bold text-foreground/70">Decided, with the wage set</dt>{" "}
            <dd className="mt-1 font-heading text-3xl font-black">{disclosure ? disclosure.rows.toLocaleString("en-US") : "—"}</dd>
          </div>{" "}
          <div className="border-2 border-border bg-tint-primary p-4 shadow-hard">
            <dt className="text-sm font-bold text-foreground/70">Decisions through</dt>{" "}
            <dd className="mt-1 font-heading text-2xl font-black">{longDate(disclosure?.latestDecision ?? null) ?? "—"}</dd>
          </div>
        </dl>{" "}
        {summary && earliest ? (
          <p className="mt-3 text-sm text-foreground/70">
            Live rows reach back to filings from {longDate(`${earliest}-01`) ?? earliest}; the backfill keeps walking earlier days.
          </p>
        ) : null}
      </header>

      <section className="pop mt-8 max-w-3xl">
        <div className="border-2 border-border bg-tint-primary p-5 sm:p-6">
          <h2 className="font-heading text-lg font-black">What&apos;s in here, and what isn&apos;t</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/80">
            Pending requests come from DOL&apos;s own case system, checked daily:
            number, employer, job title, filing date, status. Decided ones come
            from DOL&apos;s quarterly disclosure files with the wage, occupation and
            worksite DOL used. H-1B and H-2B wage requests are left out; this is
            the PERM queue.
          </p>{" "}
          <p className="mt-3 text-sm leading-relaxed text-foreground/70">
            Have the number? The{" "}
            <Link href="/perm-case-status" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              status lookup
            </Link>{" "}
            takes P- numbers and asks DOL directly. The{" "}
            <Link href="/tools/pwd-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              PWD queue calculator
            </Link>{" "}
            shows DOL&apos;s position month by month.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <Suspense fallback={<p className="text-base text-foreground/60">Loading the search…</p>}>
          <FlagCaseBrowser summary={summary} disclosure={disclosure} program={PWD_PROGRAM} />
        </Suspense>
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">How this works</h2>{" "}
        <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground/80">
          <p>
            <b className="font-bold">Where the rows come from.</b> DOL numbers wage
            requests and PERM cases from one running counter. This site checks it
            nightly for new filings, then re-checks each request daily until DOL
            decides.
          </p>{" "}
          <p>
            <b className="font-bold">Why a request might be missing.</b> A request
            filed today appears after the next nightly check. A pending one from
            before the backfill&apos;s reach is absent until the walk gets there. A
            decided one older than the quarterly files loaded here, or newer than
            the last file, has no wage yet. A number DOL&apos;s system doesn&apos;t
            return can&apos;t be listed.
          </p>
        </div>
      </section>
    </div>
  );
}
