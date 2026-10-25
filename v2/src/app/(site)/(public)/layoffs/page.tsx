import type { Metadata } from "next";
import Link from "next/link";

import { getFreshness } from "@/lib/db/publicData";
import { matchedWarn, warnTotals } from "@/lib/db/warn";
import { WarnTable } from "@/components/warn/WarnTable";
import { WarnOverview } from "@/components/warn/WarnOverview";
import { formatAsOf } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { MoreText } from "@/components/data/MoreText";
import { WARN_STATE_COUNT } from "@/lib/warnStates";

/**
 * WARN layoff notices against the sponsor record. Every row is a filing as
 * the state printed it; a sponsor link means the filer's normalised name
 * equals a PERM employer's merge key, and nothing looser. Forty states and DC
 * are read (scripts/ingest_warn.py and scripts/warn_states.py name the
 * sources), and the page says how they're read and which ten states aren't.
 */

const TITLE = "Layoff Notices Against PERM Sponsors";
const DESCRIPTION =
  "WARN Act layoff and closing notices from 40 states and DC, as each state publishes them, matched by name to DOL's PERM employers.";
const PATH = "/layoffs";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/layoffs" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "layoffs");

export const revalidate = 21600;


export default async function LayoffsPage() {
  const [matched, totals, freshness] = await Promise.all([matchedWarn(), warnTotals(), getFreshness().catch(() => ({}) as Record<string, { asOf: string | null } | undefined>)]);
  const asOf = freshness["warn-notices"]?.asOf ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Layoff notices against sponsors</h1>{" "}
        <MoreText gist={"Mass layoffs need 60 days' notice, filed with the state."} className="mt-4">
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            The WARN Act makes an employer file 60 days&apos; notice of a mass layoff or closing with the state, and
            some states publish the filings. DOL&apos;s PERM files record no layoff, so these notices are the only public
            trace of one. Each row is a filing as the state printed it.
          </p>
        </MoreText>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        <div className="bg-tint p-5 border-2 shadow-hard border-border">
          <p className="text-sm text-muted-foreground">Notices held{asOf ? `, to ${formatAsOf(asOf)}` : ""}</p>{" "}
          <p className="mt-1 font-heading text-3xl font-bold tabular-nums">{totals.notices.toLocaleString("en-US")}</p>
        </div>{" "}
        <div className="bg-tint p-5 border-2 shadow-hard border-border">
          <p className="text-sm text-muted-foreground">Filed by a PERM sponsor</p>{" "}
          <p className="mt-1 font-heading text-3xl font-bold tabular-nums">{totals.matched.toLocaleString("en-US")}</p>
        </div>{" "}
        <div className="bg-tint p-5 border-2 shadow-hard border-border">
          <p className="text-sm text-muted-foreground">Employees in those notices</p>{" "}
          <p className="mt-1 font-heading text-3xl font-bold tabular-nums">{totals.employees.toLocaleString("en-US")}</p>
        </div>
      </section>

      {matched.length > 0 ? <WarnOverview rows={matched} /> : null}{" "}

      <section className="mt-10">
        {matched.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notice held matches a PERM sponsor by name.</p>
        ) : (
          <WarnTable rows={matched} />
        )}{" "}
        <p className="mt-4 text-sm text-muted-foreground">
          {matched.length < totals.matched
            ? `The table lists the newest ${matched.length.toLocaleString("en-US")} of the ${totals.matched.toLocaleString("en-US")} notices matched to a sponsor,`
            : `The table lists every one of the ${matched.length.toLocaleString("en-US")} notices matched to a sponsor,`}{" "}
          out of {totals.notices.toLocaleString("en-US")} held across {WARN_STATE_COUNT - 1} states and DC. Search by
          employer, site or county, filter by state, kind, size or year, and sort on any column.
        </p>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="font-heading text-2xl font-bold">What is read, and what is not</h2>{" "}
        <MoreText gist={"Forty states and DC are read. A sponsor with layoffs in the other ten isn't cleared here."} className="mt-3">
          <p className="text-base leading-relaxed text-soft">
            Forty states and the District of Columbia are read, each from the record it publishes, and each refreshes on
            its own. Most post a spreadsheet, a list or a page a year. A few print their notices in a PDF, and five share
            one job-center search. Notices from 2019 on are kept, or from whenever a state&apos;s record begins. New
            Jersey and Pennsylvania print only the month a notice was posted, so the month is shown. Oklahoma prints no
            worker count, and Hawaii&apos;s notices before August 2026 are letters, so those rows carry no count.
            Texas&apos;s open data portal trails the agency&apos;s own spreadsheet by a few months. Each state&apos;s
            newest notice is checked against its own budget, so a source going quiet shows up as a stale date rather
            than a silent zero.
          </p>{" "}
          <p className="mt-3 text-base leading-relaxed text-soft">
            Ten states aren&apos;t read. Arkansas doesn&apos;t publish its notices, and Wyoming&apos;s site lists none.
            Louisiana and New Mexico ask automated readers not to read their files. Rhode Island, Missouri, Nevada, New
            Hampshire and Minnesota turn scripts away with a browser check, and West Virginia posts only the notice
            letters. A sponsor with layoffs in those states, or before the window read here, isn&apos;t cleared by this
            page. A match means the filer&apos;s normalised name equals a PERM employer&apos;s, the same rule that groups
            DOL&apos;s own spellings of one company. A subsidiary filing under its own name doesn&apos;t match its
            parent, on purpose.
          </p>
        </MoreText>{" "}
        <p className="mt-3 text-base leading-relaxed text-soft">
          A notice is not a finding about a PERM. What a layoff does to a filing, and to a pending case, is on{" "}
          <Link href="/guides/employer-layoffs-and-your-perm" className="link">
            the layoffs guide
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
