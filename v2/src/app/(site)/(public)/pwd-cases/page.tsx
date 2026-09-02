import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FlagCaseBrowser, PWD_PROGRAM } from "@/components/tools/FlagCaseBrowser";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { getPwdSummary } from "@/lib/turso/pwdCases";

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
 * COVERAGE IS HONEST ABOUT ITS START. The table holds what DOL has confirmed
 * since this began watching (a backfill walks earlier filing days). Issued
 * determinations also appear in DOL's quarterly disclosure files with the
 * wage set; that ingest lands separately.
 */

const TITLE = "PWD Case Search";
const DESCRIPTION =
  "Find a prevailing wage request (ETA-9141) by employer, job title and filing month, and check where it sits in DOL's wage queue. Live from DOL's daily check.";

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
  const summary = await getPwdSummary();
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
          The wage request is the first step of a PERM, filed by the employer
          months before the PERM itself, and you usually never see its number.
          Search the employer here, and the number, the job title, the filing
          date and DOL&apos;s current status come back.{" "}
          {summary ? (
            <>
              {summary.total.toLocaleString("en-US")} requests confirmed by DOL so far
              {earliest ? `, from filings since ${longDate(`${earliest}-01`) ?? earliest}` : ""}.
            </>
          ) : null}
        </p>
      </header>

      <section className="pop mt-8 max-w-3xl">
        <div className="border-2 border-border bg-tint-primary p-5 sm:p-6">
          <h2 className="font-heading text-lg font-black">What&apos;s in here, and what isn&apos;t</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/80">
            Every row is a case DOL&apos;s own system confirmed: number, employer,
            job title, filing date and status. It does not carry the wage DOL
            set, which appears only in DOL&apos;s quarterly disclosure files
            once the determination is issued. Requests filed for H-1B or H-2B
            wages are left out; this is the PERM queue.
          </p>{" "}
          <p className="mt-3 text-sm leading-relaxed text-foreground/70">
            Have the number already? The{" "}
            <Link href="/perm-case-status" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              status lookup
            </Link>{" "}
            takes P- numbers and asks DOL directly. Wondering how long the queue
            is? The{" "}
            <Link href="/tools/pwd-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              PWD queue calculator
            </Link>{" "}
            shows DOL&apos;s position month by month.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <Suspense fallback={<p className="text-base text-foreground/60">Loading the search…</p>}>
          <FlagCaseBrowser summary={summary} program={PWD_PROGRAM} />
        </Suspense>
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">How this works</h2>{" "}
        <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground/80">
          <p>
            <b className="font-bold">Where the rows come from.</b> DOL&apos;s case status
            search covers prevailing wage requests as well as PERM, and DOL numbers
            both from one running counter. This site already checks the counter
            every night for new PERM filings; the wage requests sit in the same
            windows, so they&apos;re confirmed the same way, one batch of numbers at
            a time, and re-checked daily until DOL issues the determination.
          </p>{" "}
          <p>
            <b className="font-bold">Why a request might be missing.</b> Watching
            started in September 2026 and works backwards through earlier filing
            days, so an older request can be absent for a while. A request filed
            today shows up after the next nightly check. Anything DOL&apos;s
            system doesn&apos;t return for a number can&apos;t be listed.
          </p>{" "}
          <p>
            <b className="font-bold">What &ldquo;in process&rdquo; means.</b> DOL works
            wage requests in the order it received them, in two lines: wages taken
            from the OEWS survey, and everything else. The status stays &ldquo;in
            process&rdquo; until the determination is issued, and the queue
            calculator says which month DOL is on.
          </p>
        </div>
      </section>
    </div>
  );
}
