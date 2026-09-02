import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FlagCaseBrowser, LCA_PROGRAM } from "@/components/tools/FlagCaseBrowser";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { getLcaSummary } from "@/lib/turso/lcaCases";

/**
 * Labor condition applications, findable by employer as DOL confirms them.
 *
 * Same source and same machinery as the wage-request search. An LCA is the
 * H-1B (and H-1B1, E-3) wage attestation the employer files with DOL before
 * the USCIS petition; DOL certifies most within seven business days. The
 * number is on the certified LCA the employer must give the worker, but
 * plenty never see it, and nothing public lists them.
 */

const TITLE = "LCA Case Search";
const DESCRIPTION =
  "Find an H-1B labor condition application (ETA-9035) by employer, job title and filing month, with DOL's current status. Live from DOL's daily check.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/lca-cases" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/lca-cases",
  },
};

export const revalidate = 86400;

function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function LcaCasesPage() {
  const summary = await getLcaSummary();
  const earliest = summary?.byMonth.length
    ? [...summary.byMonth].map((m) => m.month).sort()[0] ?? null
    : null;
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Data", href: "/tools" },
    { name: "LCAs", href: "/lca-cases" },
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={breadcrumbSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Live from DOL&apos;s daily check
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Find an H-1B LCA
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          The labor condition application is what the employer files with DOL
          before the H-1B petition. Search the employer, get the number, the
          title, the filing date and DOL&apos;s status.{" "}
          {summary ? (
            <>
              {summary.total.toLocaleString("en-US")} LCAs confirmed by DOL so far
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
            job title, filing date and status. Wage, worksite and visa class
            arrive only in DOL&apos;s quarterly disclosure files. An LCA is not
            the H-1B petition; that has a USCIS receipt number and is tracked
            at USCIS.
          </p>{" "}
          <p className="mt-3 text-sm leading-relaxed text-foreground/70">
            Have the number? The{" "}
            <Link href="/perm-case-status" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              status lookup
            </Link>{" "}
            takes I- numbers and asks DOL directly.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <Suspense fallback={<p className="text-base text-foreground/60">Loading the search…</p>}>
          <FlagCaseBrowser summary={summary} program={LCA_PROGRAM} />
        </Suspense>
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">How this works</h2>{" "}
        <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground/80">
          <p>
            <b className="font-bold">Where the rows come from.</b> DOL&apos;s case
            status search covers LCAs, and DOL numbers every filing from one
            running counter. This site checks that counter nightly for new PERM
            and wage filings; LCAs sit in the same windows and are confirmed the
            same way, then re-checked until DOL decides.
          </p>{" "}
          <p>
            <b className="font-bold">Why one might be missing.</b> Watching started
            in September 2026 and works backwards through earlier filing days. A
            filing from today shows up after the next nightly check.
          </p>
        </div>
      </section>
    </div>
  );
}
