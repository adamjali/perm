import type { Metadata } from "next";
import Link from "next/link";

import { getFreshness } from "@/lib/turso/publicData";
import { matchedWarn, warnTotals } from "@/lib/turso/warn";
import { WarnTable } from "@/components/warn/WarnTable";
import { formatAsOf } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { MoreText } from "@/components/data/MoreText";

/**
 * WARN layoff notices against the sponsor record. Every row is a filing as
 * the state printed it; a sponsor link means the filer's normalised name
 * equals a PERM employer's merge key, and nothing looser. Four states are read
 * (California, Texas, New York, Washington) and the page says which record
 * each comes from and what is still not covered.
 */

const TITLE = "Layoff Notices Against PERM Sponsors";
const DESCRIPTION =
  "WARN Act layoff and closing notices from California, Texas, New York and Washington, as each state publishes them, matched by name to DOL's PERM employers.";
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
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">Layoff notices against sponsors</h1>{" "}
        <MoreText gist={"Mass layoffs need 60 days' notice, filed with the state."} className="mt-4">
          <p className=" max-w-2xl text-lg leading-relaxed text-foreground/70">
            The WARN Act makes an employer file 60 days&apos; notice of a mass layoff or closing with the state, and
            some states publish the filings. DOL&apos;s PERM files record no layoff, so these notices are the only public
            trace of one. Each row is a filing as the state printed it.
          </p>
        </MoreText>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        <div className="border-2 border-border bg-card p-5 shadow-hard">
          <p className="text-sm text-foreground/70">Notices held{asOf ? `, to ${formatAsOf(asOf)}` : ""}</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">{totals.notices.toLocaleString("en-US")}</p>
        </div>{" "}
        <div className="border-2 border-border bg-card p-5 shadow-hard">
          <p className="text-sm text-foreground/70">Filed by a PERM sponsor</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">{totals.matched.toLocaleString("en-US")}</p>
        </div>{" "}
        <div className="border-2 border-border bg-card p-5 shadow-hard">
          <p className="text-sm text-foreground/70">Employees in those notices</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">{totals.employees.toLocaleString("en-US")}</p>
        </div>
      </section>

      <section className="mt-10">
        {matched.length === 0 ? (
          <p className="text-sm text-foreground/70">No notice held matches a PERM sponsor by name.</p>
        ) : (
          <WarnTable rows={matched} />
        )}{" "}
        <p className="mt-4 text-sm text-muted-foreground">
          The table lists every one of the {matched.length.toLocaleString("en-US")} notices matched to a sponsor, out of{" "}
          {totals.notices.toLocaleString("en-US")} held across the four states. Search by employer, site or county,
          filter by state, kind, size or year, and sort on any column.
        </p>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">What is read, and what is not</h2>{" "}
        <MoreText gist={"Four states' WARN records only: a sponsor with layoffs elsewhere isn't cleared here."} className="mt-3">
          <p className="text-base leading-relaxed text-foreground/80">
            Four states are read, each from the record it publishes, and all four refresh on their own. California&apos;s
            Employment Development Department posts its WARN report as a spreadsheet; New York&apos;s current notices sit
            in a public dashboard that also serves them as a table; Washington keeps a searchable database of every
            notice received, walked newest first; and Texas publishes its notices on the state open data portal, which
            reaches back to 2019. Texas is the one with a caveat worth stating: the portal trails the agency&apos;s own
            yearly spreadsheet by a month or two, and that spreadsheet turns automated requests away, so the most recent
            Texas weeks arrive only when someone loads the file by hand. Each state&apos;s newest notice is checked
            against its own budget, so a source going quiet shows up as a stale date rather than shrinking to a silent
            zero. Every other state, and anything published before the window read here, shows nothing, so a sponsor
            with layoffs elsewhere is not cleared by this page. A match means the filer&apos;s
            normalised name equals a PERM employer&apos;s, the same rule that groups DOL&apos;s own spellings of one
            company; a subsidiary filing under its own name does not match its parent, on purpose.
          </p>
        </MoreText>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          A notice is not a finding about a PERM. What a layoff does to a filing, and to a pending case, is on{" "}
          <Link href="/guides/employer-layoffs-and-your-perm" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            the layoffs guide
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
