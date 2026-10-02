import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { AsPrinted, SevpEmployerTable } from "@/components/data/SevpEmployerTable";
import { openGraphBase } from "@/lib/openGraphBase";
import { getSevpLists } from "@/lib/turso/sevpEmployers";

/**
 * ICE's yearly top-200 lists of employers of F-1 students on OPT, STEM OPT
 * and CPT, the only federal count of who hires students on practical
 * training. Every list ICE linked is here in full, as ICE printed it
 * (scripts/ingest_sevp_top_employers.py); the newest year is open, earlier
 * years fold.
 */

const TITLE = "Top OPT and CPT Employers";
const DESCRIPTION =
  "The employers with the most F-1 students on OPT, STEM OPT and CPT, from ICE's own top-200 lists for each year it published.";
const PATH = "/opt-employers";

// No social card yet (a card is a capture of the rendered page).
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
};

export const revalidate = 604800;

const SOURCE = "https://www.ice.gov/sevis/whats-new";

export default async function OptEmployersPage() {
  const lists = await getSevpLists();
  const newest = lists[0]?.year ?? null;
  const current = lists.filter((l) => l.year === newest);
  const earlier = lists.filter((l) => l.year !== newest);
  const years = [...new Set(lists.map((l) => l.year))];
  const label = (l: { list: string }) => (l.list === "opt" ? "OPT and STEM OPT" : "CPT");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">Who hires students on OPT and CPT</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          The 200 employers with the most F-1 students on practical training each year, as ICE lists them.
          {years.length > 0 ? ` Years ICE published: ${years.join(", ")}.` : ""}
        </p>
      </header>

      {lists.length === 0 ? (
        <p className="mt-10 border-2 border-border bg-card p-5 text-base">
          The lists haven&apos;t been loaded yet. ICE&apos;s own PDFs are on its{" "}
          <a href={SOURCE} rel="noopener noreferrer" className="font-bold underline underline-offset-2 hover:text-primary">
            SEVIS &quot;What&apos;s New&quot; page
          </a>
          .
        </p>
      ) : null}

      {current.map((l) => (
        <section key={`${l.year}-${l.list}`} className="mt-10" aria-labelledby={`h-${l.year}-${l.list}`}>
          <h2 id={`h-${l.year}-${l.list}`} className="font-heading text-2xl font-black">
            {l.year}: {label(l)}
          </h2>{" "}
          <p className="mt-1 text-base text-foreground/70">
            {l.list === "opt"
              ? "Students on OPT or its STEM extension in the year, with each program's count. A student who worked for the same employer in both is counted in each, so the two can add up to more than the first column."
              : "Students on Curricular Practical Training in the year: work that's part of a degree program."}
          </p>
          <div className="mt-4">
            <SevpEmployerTable list={l} />
          </div>
          <AsPrinted notes={l.asPrinted} />
        </section>
      ))}

      {earlier.length > 0 ? (
        <section className="mt-12" aria-labelledby="earlier">
          <h2 id="earlier" className="font-heading text-2xl font-black">
            Earlier years
          </h2>{" "}
          <div className="mt-4 space-y-3">
            {earlier.map((l) => (
              <Fragment key={`${l.year}-${l.list}`}>
                {" "}
                <details className="group border-2 border-border">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center px-4 font-heading text-lg font-black [&::-webkit-details-marker]:hidden">
                    {l.year}: {label(l)}, led by {l.rows[0]?.employer ?? "nobody"}
                  </summary>
                  <div className="p-4 pt-0">
                    <SevpEmployerTable list={l} />
                    <AsPrinted notes={l.asPrinted} />
                  </div>
                </details>
              </Fragment>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">How to read these</h2>{" "}
        <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground/80">
          <p>
            Names are ICE&apos;s and often a brand (&quot;Amazon&quot;) rather than the company that files, so each
            links a search of this site&apos;s employer records instead of claiming a match.
          </p>{" "}
          <FinePrint summary="Where the lists come from">
            <p>
              ICE&apos;s Student and Exchange Visitor Program publishes them with its yearly &quot;SEVIS by the
              Numbers&quot; release, linked from its{" "}
              <a href={SOURCE} rel="noopener noreferrer" className="font-bold underline underline-offset-2 hover:text-primary">
                What&apos;s New page
              </a>
              . Only the top 200 are published, and ICE linked no lists for the years missing above. Each count is read by
              its column position in ICE&apos;s PDF and checked: the combined OPT count must sit between the larger of
              its two parts and their sum.
            </p>
          </FinePrint>{" "}
          <p>
            Planning the next step?{" "}
            <Link href="/tools/h1b-lottery-odds-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              The H-1B lottery odds for a job
            </Link>{" "}
            work from the wage and the area.
          </p>
        </div>
      </section>
      <DataProvenance datasets={["sevp-top-employers"]} />
    </div>
  );
}
