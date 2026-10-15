import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { PlusIcon } from "@phosphor-icons/react/ssr";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { IndexHeader, type IndexFigure } from "@/components/data/IndexHeader";
import { AsPrinted, SevpEmployerTable } from "@/components/data/SevpEmployerTable";
import { openGraphBase } from "@/lib/openGraphBase";
import { formatInt } from "@/lib/format";
import { getSevpLists, type SevpList } from "@/lib/db/sevpEmployers";

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

/** Rows each table shows before the rest of its 200 fold. */
const OPEN_ROWS = 25;
const LEADERS = 10;

/**
 * How much of one list's count its ten busiest employers hold. A student who
 * worked for two employers on the list is counted at each, so this is a share
 * of the list's count, never of students.
 */
function leaderShare(list: SevpList) {
  const sum = (rows: SevpList["rows"]) => rows.reduce((t, r) => t + r.total, 0);
  const all = sum(list.rows);
  const lead = sum(list.rows.slice(0, LEADERS));
  return { all, lead, rest: all - lead, share: all > 0 ? lead / all : 0 };
}

function LeaderBar({ list }: { list: SevpList }) {
  const s = leaderShare(list);
  if (s.all === 0) return null;
  const pct = Math.round(s.share * 100);
  return (
    <figure className="m-0 border border-border bg-card p-5">
      <figcaption className="font-heading text-lg font-bold leading-snug">
        The {LEADERS} busiest hold {pct}% of the {list.year} list
      </figcaption>{" "}
      <span className="sr-only">{`The ${LEADERS} busiest employers: ${formatInt(s.lead)}. The other ${list.rows.length - LEADERS}: ${formatInt(s.rest)}.`}</span>
      <div aria-hidden="true" className="mt-4 flex h-6 border border-border">
        <span className="block h-full bg-primary" style={{ width: `${s.share * 100}%` }} />
        <span className="block h-full flex-1 bg-muted" />
      </div>{" "}
      <dl aria-hidden="true" className="mt-3 grid grid-cols-2 gap-3 text-sm [&>*]:min-w-0">
        <div>
          <dt className="flex items-center gap-2 text-muted-foreground">
            <span className="size-3 shrink-0 border border-border bg-primary" /> The {LEADERS} busiest{" "}
          </dt>{" "}
          <dd className="mt-0.5 font-bold tabular-nums">{formatInt(s.lead)}</dd>
        </div>{" "}
        <div>
          <dt className="flex items-center gap-2 text-muted-foreground">
            <span className="size-3 shrink-0 border border-border bg-muted" /> The other {list.rows.length - LEADERS}{" "}
          </dt>{" "}
          <dd className="mt-0.5 font-bold tabular-nums">{formatInt(s.rest)}</dd>
        </div>
      </dl>{" "}
      <p className="mt-3 text-sm text-muted-foreground">A student at two of these employers counts at each.</p>
    </figure>
  );
}

export default async function OptEmployersPage() {
  const lists = await getSevpLists();
  const newest = lists[0]?.year ?? null;
  const current = lists.filter((l) => l.year === newest);
  const earlier = lists.filter((l) => l.year !== newest);
  const years = [...new Set(lists.map((l) => l.year))];
  const label = (l: { list: string }) => (l.list === "opt" ? "OPT and STEM OPT" : "CPT");
  const optNewest = current.find((l) => l.list === "opt") ?? current[0] ?? null;
  const leader = optNewest?.rows[0];
  const figures: IndexFigure[] = [
    ...(optNewest && leader
      ? [
          {
            label: `Busiest in ${optNewest.year}, ${label(optNewest)}`,
            value: leader.employer,
            note: `${formatInt(leader.total)} students`,
            href: `/perm-employers?q=${encodeURIComponent(leader.employer)}`,
          },
        ]
      : []),
    ...(years.length > 0 ? [{ label: "Years ICE published", value: years.join(", ") }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <IndexHeader
        title="Who hires students on OPT and CPT"
        lede="The 200 employers with the most F-1 students on practical training each year, as ICE lists them."
        figures={figures}
        aside={optNewest ? <LeaderBar list={optNewest} /> : undefined}
      />

      {lists.length === 0 ? (
        <p className="mt-10 border border-border bg-card p-5 text-base">
          The lists haven&apos;t been loaded yet. ICE&apos;s own PDFs are on its{" "}
          <a href={SOURCE} rel="noopener noreferrer" className="link">
            SEVIS &quot;What&apos;s New&quot; page
          </a>
          .
        </p>
      ) : null}

      {current.map((l) => (
        <section key={`${l.year}-${l.list}`} className="mt-10" aria-labelledby={`h-${l.year}-${l.list}`}>
          <h2 id={`h-${l.year}-${l.list}`} className="font-heading text-2xl font-bold">
            {l.year}: {label(l)}
          </h2>{" "}
          <p className="mt-1 text-base text-muted-foreground">
            {l.list === "opt"
              ? "Students on OPT or its STEM extension in the year, with each program's count. A student who worked for the same employer in both is counted in each, so the two can add up to more than the first column."
              : "Students on Curricular Practical Training in the year: work that's part of a degree program."}
          </p>
          <div className="mt-4">
            <SevpEmployerTable list={l} open={OPEN_ROWS} />
          </div>
          <AsPrinted notes={l.asPrinted} />
        </section>
      ))}

      {earlier.length > 0 ? (
        <section className="mt-12" aria-labelledby="earlier">
          <h2 id="earlier" className="font-heading text-2xl font-bold">
            Earlier years
          </h2>{" "}
          <div className="mt-4 space-y-3">
            {earlier.map((l) => (
              <Fragment key={`${l.year}-${l.list}`}>
                {" "}
                <details className="group border border-border">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 font-heading text-lg font-bold [&::-webkit-details-marker]:hidden">
                    <span>
                      {l.year}: {label(l)}, led by {l.rows[0]?.employer ?? "nobody"}
                    </span>{" "}
                    <PlusIcon aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
                  </summary>
                  <div className="p-4 pt-0">
                    <SevpEmployerTable list={l} open={OPEN_ROWS} />
                    <AsPrinted notes={l.asPrinted} />
                  </div>
                </details>
              </Fragment>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-bold">How to read these</h2>{" "}
        <div className="mt-4 space-y-4 text-base leading-relaxed text-soft">
          <p>
            Names are ICE&apos;s and often a brand (&quot;Amazon&quot;) rather than the company that files, so each
            links a search of this site&apos;s employer records instead of claiming a match.
          </p>{" "}
          <FinePrint summary="Where the lists come from">
            <p>
              ICE&apos;s Student and Exchange Visitor Program publishes them with its yearly &quot;SEVIS by the
              Numbers&quot; release, linked from its{" "}
              <a href={SOURCE} rel="noopener noreferrer" className="link">
                What&apos;s New page
              </a>
              . Only the top 200 are published, and ICE linked no lists for the years missing above. Each count is read by
              its column position in ICE&apos;s PDF and checked: the combined OPT count must sit between the larger of
              its two parts and their sum.
            </p>
          </FinePrint>{" "}
          <p>
            Planning the next step?{" "}
            <Link href="/tools/h1b-lottery-odds-calculator" className="link">
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
