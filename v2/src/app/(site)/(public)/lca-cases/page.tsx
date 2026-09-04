import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { PageBasics } from "@/components/data/PageBasics";
import { FinePrint } from "@/components/data/FinePrint";
import { FlagCaseBrowser, LCA_PROGRAM } from "@/components/tools/FlagCaseBrowser";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { getLcaSummary, getLcaDisclosureSummary } from "@/lib/turso/lcaCases";

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
  const [summary, disclosure] = await Promise.all([getLcaSummary(), getLcaDisclosureSummary()]);
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
          The employer files it with DOL before the H-1B petition. Search the
          employer to get the number, title, filing date and status.{" "}
        </p>{" "}
        <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
          <div className="border-2 border-border bg-card p-4 shadow-hard">
            <dt className="text-sm font-bold text-foreground/70">Confirmed by DOL&apos;s daily check</dt>{" "}
            <dd className="mt-1 font-heading text-3xl font-black">{summary ? summary.total.toLocaleString("en-US") : "—"}</dd>
          </div>{" "}
          <div className="border-2 border-border bg-card p-4 shadow-hard">
            <dt className="text-sm font-bold text-foreground/70">Decided, with the wage offered</dt>{" "}
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
            Pending LCAs come from DOL&apos;s case system, checked daily.
            Decided ones come from DOL&apos;s quarterly files, with the wage
            offered and the worksite.
          </p>{" "}
          <p className="mt-3 text-sm leading-relaxed text-foreground/70">
            Have the number? The{" "}
            <Link href="/perm-case-status" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              status lookup
            </Link>{" "}
            takes I- numbers, asks DOL directly, and can email you when the status changes.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <Suspense fallback={<p className="text-base text-foreground/60">Loading the search…</p>}>
          <FlagCaseBrowser summary={summary} disclosure={disclosure} program={LCA_PROGRAM} />
        </Suspense>
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">How this works</h2>{" "}
        <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground/80">
          <FinePrint summary="Where the rows come from">
            <p>DOL numbers every filing from one running counter. This site checks it nightly for new filings, then re-checks each LCA until DOL decides. {" "}</p>
          </FinePrint>{" "}
          <p>
            <b className="font-bold">Why one might be missing.</b> Watching started
            in September 2026 and is working backwards through earlier filings. A
            filing from today appears after the next nightly check.
          </p>
        </div>
      </section>
      <PageBasics page="lca-cases" />{" "}
    </div>
  );
}
