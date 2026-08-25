/**
 * PERM filings by state: the map page.
 *
 * Real Census geometry filled from the live DOL disclosure aggregates —
 * filings, approval rate, denial rate, median days and median wage per
 * worksite state. The rival keeps a state map behind its paywall; ours is
 * free, on the open data, with the methodology one tab away.
 *
 * The map and the table share one metric selector and one population floor.
 * A choropleth shaded by a rate over seventeen decided cases is a picture of
 * a sample size, so the floor decides how thin a state is allowed to be
 * before its rate stops being coloured — and it never touches a count, which
 * needs no floor.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../../../convex/_generated/api";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { StateExplorer, type StateStat } from "@/components/tools/USStateMap";

const TITLE = "PERM Filings by State";
const DESCRIPTION =
  "Interactive map of PERM filings by worksite state: volume, approval rate, median days and median wage, from DOL's own disclosure files.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-by-state" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-by-state",
  },
};

// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
export const revalidate = 86400;

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

export default async function PermByStatePage() {
  const stats = await fetchQuery(api.permDisclosure.getLatest, {}).catch(() => null);
  const byState: StateStat[] = stats?.byState ?? [];
  const uniqueCases = stats?.uniqueCases ?? 0;

  const ranked = [...byState].sort((a, b) => b.total - a.total);
  const top = ranked[0];
  const smallHalf = ranked.slice(Math.ceil(ranked.length / 2));
  const smallHalfTotal = smallHalf.reduce((sum, s) => sum + s.total, 0);
  const topBeatsSmallHalf = Boolean(top) && (top?.total ?? 0) > smallHalfTotal;

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "PERM labor certification filings by state",
    description: DESCRIPTION,
    url: "https://permtracker.app/perm-by-state",
    creator: { "@type": "Organization", name: "PERM Tracker" },
    isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
    license: "https://permtracker.app/terms",
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="by-state" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
          From DOL&apos;s own disclosure files
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          PERM filings, state by state
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          Every certified, denied and withdrawn case in the current disclosure
          window, placed at its worksite state. The map shades by volume,
          approval rate, denial rate, median days or median wage. Hovering a
          state reads it, and tapping pins it.
        </p>
      </header>

      {byState.length > 0 ? (
        <>
          <StateExplorer states={byState} />

          {/* The three facts the map cannot say at a glance. */}
          <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="border-2 border-border bg-foreground p-6 text-background shadow-hard-sm">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-background/60">
                Cases in this window
              </p>{" "}
              <p className="mt-2 font-heading text-3xl font-black tabular-nums">
                {fmtInt(uniqueCases)}
              </p>{" "}
              <p className="mt-2 text-sm leading-relaxed text-background/70">
                Unique cases across the unioned quarterly files, de-duplicated
                by case number.
              </p>
            </div>
            <div className="border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                Busiest state
              </p>{" "}
              <p className="mt-2 font-heading text-3xl font-black">
                {top ? top.state : "—"}
              </p>{" "}
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                {!top
                  ? "Awaiting the next quarterly ingest."
                  : topBeatsSmallHalf
                    ? `${fmtInt(top.total)} filings, more than the ${smallHalf.length} smallest states put together.`
                    : `${fmtInt(top.total)} filings, ${((top.total / (uniqueCases || 1)) * 100).toFixed(0)}% of the window.`}
              </p>
            </div>
            <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                Why states differ
              </p>{" "}
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                DOL works one national queue, so median days barely move by
                state. Volume and wages move a lot. That’s industry mix, not
                a faster line. The{" "}
                <Link href="/methodology" className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                  methodology
                </Link>{" "}
                sets out both.
              </p>
            </div>
          </section>

          <section className="mt-10 border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
            <h2 className="font-heading text-lg font-black">
              Reading a rate off a small state
            </h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
              The smallest jurisdictions here decide a couple of dozen cases in
              a whole window. One denial swings a rate like that by several
              points, so the map leaves them uncoloured on rates and medians
              rather than shading them as if the figure meant the same thing it
              does in California. Drop the floor to nothing and they come back,
              with the same denominator sitting beside them in the table.
              Denial rates ranked this way, with a 95% range on each one, are
              on the{" "}
              <Link href="/perm-denial-risk" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                denial rates page
              </Link>
              .
            </p>
          </section>
        </>
      ) : (
        <section className="mt-10 border-2 border-border bg-card p-8 text-center shadow-hard">
          <p className="text-lg text-foreground/70">
            The state aggregates land with the quarterly disclosure ingest.
            Until then, the{" "}
            <Link href="/perm-processing-times" className="underline decoration-primary decoration-2 underline-offset-2">
              processing times page
            </Link>{" "}
            carries the live queue.
          </p>
        </section>
      )}

      {/* Both doors, as everywhere on the data surface. */}
      <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Waiting on a case here?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            The state doesn’t change your place in line. The filing month
            does. The{" "}
            <Link href="/tools/perm-timeline-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              decision estimator
            </Link>{" "}
            reads your month against the live queue.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Filing them?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Benchmark a case against the national medians, then let the tracker
            carry the deadlines.{" "}
            <Link href="/signup" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              Free account
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
