import type { Metadata } from "next";
import Link from "next/link";

import { getFreshness } from "@/lib/turso/publicData";
import { recentWarn } from "@/lib/turso/warn";
import { formatAsOf } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";

/**
 * WARN layoff notices against the sponsor record. Every row is a filing as
 * the state printed it; a sponsor link means the filer's normalised name
 * equals a PERM employer's merge key, and nothing looser. California only so
 * far, and the page says which states are not read and why.
 */

const TITLE = "Layoff Notices Against PERM Sponsors";
const DESCRIPTION =
  "WARN Act layoff and closing notices as the states publish them, matched by name to the employers in DOL's PERM record. California's report so far; each notice links to the state's own file.";
const PATH = "/layoffs";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/layoffs" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
};

export const revalidate = 21600;

const long = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export default async function LayoffsPage() {
  const [all, freshness] = await Promise.all([recentWarn(400), getFreshness().catch(() => ({}) as Record<string, { asOf: string | null } | undefined>)]);
  const asOf = freshness["warn-notices"]?.asOf ?? null;
  const matched = all.filter((r) => r.employerSlug);
  const employees = matched.reduce((n, r) => n + (r.employees ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/perm-employers" className="underline underline-offset-2 hover:text-primary">
            Employers
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">Layoff notices against sponsors</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          The WARN Act makes an employer file 60 days&apos; notice of a mass layoff or closing with the state, and
          some states publish the filings. DOL&apos;s PERM files record no layoff, so these notices are the only public
          trace of one. Each row is a filing as the state printed it.
        </p>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        <div className="border-2 border-border bg-card p-5 shadow-hard">
          <p className="text-sm text-foreground/70">Notices read{asOf ? `, to ${formatAsOf(asOf)}` : ""}</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">{all.length.toLocaleString("en-US")}</p>
        </div>{" "}
        <div className="border-2 border-border bg-card p-5 shadow-hard">
          <p className="text-sm text-foreground/70">Filed by a PERM sponsor</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">{matched.length.toLocaleString("en-US")}</p>
        </div>{" "}
        <div className="border-2 border-border bg-card p-5 shadow-hard">
          <p className="text-sm text-foreground/70">Employees in those notices</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">{employees.toLocaleString("en-US")}</p>
        </div>
      </section>

      <section className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-border">
              <th scope="col" className="py-2 pr-3 font-bold">Notice</th>
              <th scope="col" className="py-2 pr-3 font-bold">Employer, as filed</th>
              <th scope="col" className="py-2 pr-3 font-bold">Sponsor record</th>
              <th scope="col" className="py-2 pr-3 font-bold">Kind</th>
              <th scope="col" className="py-2 pr-3 text-right font-bold">Employees</th>
              <th scope="col" className="py-2 pr-3 font-bold">County</th>
              <th scope="col" className="py-2 font-bold">Effective</th>
            </tr>
          </thead>
          <tbody>
            {matched.map((r) => (
              <tr key={r.id} className="border-b border-border/40 align-top">
                <td className="py-2 pr-3 tabular-nums">{long(r.noticeDate)}</td>
                <td className="py-2 pr-3">{r.company}</td>
                <td className="py-2 pr-3">
                  <Link href={`/perm-employers/${r.employerSlug}`} className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                    PERM record
                  </Link>
                </td>
                <td className="py-2 pr-3">{r.kind ?? ""}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.employees?.toLocaleString("en-US") ?? ""}</td>
                <td className="py-2 pr-3">{r.county ?? ""}</td>
                <td className="py-2 tabular-nums">{r.effectiveDate ? long(r.effectiveDate) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {matched.length === 0 ? <p className="mt-4 text-sm text-foreground/70">No notice in the current report matches a PERM sponsor by name.</p> : null}
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">What is read, and what is not</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          California&apos;s Employment Development Department publishes its WARN report as a spreadsheet with a stable
          shape, so it is read weekly and every row above links to it. Texas answers scripts with a challenge page,
          Washington keeps its notices behind a search form, and New York publishes an HTML list; none of the three is
          read yet, so a sponsor with layoffs in those states shows nothing here. A match means the filer&apos;s
          normalised name equals a PERM employer&apos;s, the same rule that groups DOL&apos;s own spellings of one
          company; a subsidiary filing under its own name does not match its parent, on purpose.
        </p>{" "}
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
