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

import { getDatasetSchema } from "@/lib/structuredData";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { StateExplorer, type StateStat } from "@/components/tools/USStateMap";
import { StateConcentration, StateLeaders } from "@/components/tools/StateProfiles";
import { getDisclosureStats } from "@/lib/turso/publicData";
import { getStateProfiles } from "@/lib/turso/states";

import { DataProvenance } from "@/components/data/DataProvenance";
import { PageBasics } from "@/components/data/PageBasics";
import { stateName } from "@/lib/usStateNames";
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
  const [stats, profiles] = await Promise.all([
    getDisclosureStats(),
    getStateProfiles(),
  ]);
  const byState: StateStat[] = stats?.byState ?? [];
  const uniqueCases = stats?.uniqueCases ?? 0;

  const ranked = [...byState].sort((a, b) => b.total - a.total);
  const top = ranked[0];
  const smallHalf = ranked.slice(Math.ceil(ranked.length / 2));
  const smallHalfTotal = smallHalf.reduce((sum, s) => sum + s.total, 0);
  const topBeatsSmallHalf = Boolean(top) && (top?.total ?? 0) > smallHalfTotal;

  // The profiles come from a post-ingest build step, so they can legitimately
  // describe an older window than the aggregates beside them. Both documents
  // stamp the disclosure files they were built from; when those disagree the
  // section is withheld rather than presenting one quarter's leaders under
  // another quarter's totals. Withholding is the same discipline the rest of
  // the site applies to an immature cohort.
  const windowKey = (files: string[] | undefined) => [...(files ?? [])].sort().join("|");
  const profilesMatchWindow =
    profiles !== null && windowKey(profiles.sourceFiles) === windowKey(stats?.sourceFiles);
  const stateProfiles = profilesMatchWindow ? profiles.states : [];

  // The single loudest fact on the page, chosen by measurement rather than
  // picked by hand: the state whose filings sit most heavily in one occupation.
  const mostConcentrated = [...stateProfiles]
    .filter((s) => s.topOccupationShare !== null && s.topOccupations[0])
    .sort((a, b) => (b.topOccupationShare ?? 0) - (a.topOccupationShare ?? 0))[0];

  const datasetSchema = getDatasetSchema("https://permtracker.app", {
    name: "PERM labor certification filings by state",
    description: DESCRIPTION,
    url: "https://permtracker.app/perm-by-state",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          From DOL&apos;s own disclosure files
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          PERM filings, state by state
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          Every certified, denied and withdrawn case in the current disclosure
          window, placed at its worksite state. Hover a state to read it, tap to
          pin it.
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
                {top ? top.state : "Not yet"}
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
                state. Volume and wages move a lot, which is industry mix. The{" "}
                <Link href="/methodology" className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                  methodology
                </Link>{" "}
                sets out both.
              </p>
            </div>
          </section>

          {stateProfiles.length > 0 ? (
            <>
              <section className="mt-12">
                <h2 className="font-heading text-2xl font-black">
                  What each state actually files
                </h2>{" "}
                <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
                  Shaded by volume, PERM looks like one national software
                  program. It isn&apos;t. Here is the share of each state&apos;s
                  filings sitting in its single biggest occupation, and in its
                  single biggest employer, with the case counts behind both.
                  {mostConcentrated && mostConcentrated.topOccupations[0] ? (
                    <>
                      {" "}
                      {stateName(mostConcentrated.state)} is the extreme:{" "}
                      <strong>
                        {mostConcentrated.topOccupationShare}% of its{" "}
                        {fmtInt(mostConcentrated.total)} filings are{" "}
                        {mostConcentrated.topOccupations[0].label.toLowerCase()}
                      </strong>
                      .
                    </>
                  ) : null}
                </p>
                <StateConcentration states={stateProfiles} className="mt-6" />
              </section>

              <section className="mt-12">
                <h2 className="font-heading text-2xl font-black">
                  Every state&apos;s biggest occupation and biggest employer
                </h2>{" "}
                <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
                  DOL prints the same firm under several spellings, so these
                  are grouped on the identity behind the name rather than the
                  name itself. Washington&apos;s leader is one company written
                  two ways, which ranked as two until they were merged.
                </p>
                <StateLeaders states={stateProfiles} className="mt-6" />
              </section>
            </>
          ) : null}

          <section className="mt-10 border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
            <h2 className="font-heading text-lg font-black">
              Reading a rate off a small state
            </h2>{" "}
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
              The smallest jurisdictions decide a couple of dozen cases in a whole
              window, where one denial swings a rate by several points. Those stay
              uncoloured on rates and medians. Drop the floor to nothing and they
              come back, with the same denominator beside them in the table.
              Denial rates ranked with a 95% range on each are on the{" "}
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
            Benchmark a case against the national medians, then track its
            deadlines.{" "}
            <Link href="/signup" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              Free account
            </Link>
            .
          </p>
        </div>
      </section>
      <PageBasics page="perm-by-state" />{" "}
      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-foreground/70">
        Filings newer than DOL&apos;s last published file aren&apos;t in these figures. DOL reports the worksite state only when it publishes the decided case, so nothing filed since then can be placed under a state yet. Those cases are on the <Link href="/perm-cases#live" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">live list</Link> on the case search page, by employer.
      </p>{" "}
      <DataProvenance datasets={["perm-cases"]} />
    </div>
  );
}
