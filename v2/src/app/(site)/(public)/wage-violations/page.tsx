import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { ColumnChart } from "@/components/numbers/ColumnChart";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { getWhdVisaBoard, type WhdBoardProgram } from "@/lib/db/whd";
import { entityHref } from "@/lib/entityPayload";
import { formatInt } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * The Labor Department's Wage and Hour cases under the three visa programs, as DOL publishes them.
 *
 * H-1B, H-2A and H-2B each have their own columns in DOL's compliance file: violations, back wages the employer
 * agreed to pay, and the workers owed them. This page counts them by program and by the fiscal year the findings
 * ended in, and lists the largest. An employer's own cases sit on its page (`WageHourCases`), matched by legal name.
 */

const TITLE = "H-1B, H-2A and H-2B Wage Violations";
const DESCRIPTION =
  "DOL's Wage and Hour cases under the H-1B, H-2A and H-2B programs: violations, back wages owed to workers, by year and employer, from DOL's own file.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/wage-violations" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/wage-violations" },
}, "wage-violations");

// DOL updates the file quarterly and the server reads it weekly.
export const revalidate = 86400;

const money = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const monthYear = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : null;
const plural = (k: number, one: string, many = `${one}s`) => `${formatInt(k)} ${k === 1 ? one : many}`;

const ABOUT: Record<WhdBoardProgram["program"], string> = {
  "H-1B": "Specialty jobs. WHD enforces the promises on the LCA: the wage, the notice, the benching rules.",
  "H-2A": "Seasonal farm work. WHD enforces the job order: wages, housing, transport and the three-fourths guarantee.",
  "H-2B": "Seasonal non-farm work: landscaping, hospitality, seafood. WHD enforces the wage and the terms offered.",
};

function ProgramBlock({ p, first, last }: { p: WhdBoardProgram; first: number; last: number }) {
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const byFy = new Map(p.byYear.map((y) => [y.fy, y]));
  const columns = years.map((fy) => {
    const y = byFy.get(fy);
    return {
      key: String(fy),
      value: y?.cases ?? 0,
      label: `FY${fy}`,
      tip: `FY${fy}: ${plural(y?.cases ?? 0, "case")}${y && y.backWages > 0 ? `, ${money(y.backWages)} in back wages` : ""}`,
      // The file holds concluded cases, and findings that ended this year are still being concluded.
      partial: fy === last,
    };
  });
  const id = p.program.toLowerCase().replace("-", "");
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-12 border-t-2 border-border pt-8">
      <h2 id={`${id}-h`} className="font-heading text-2xl font-bold sm:text-3xl">
        {p.program}
      </h2>{" "}
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">{ABOUT[p.program]}</p>{" "}
      <dl className="mt-5 grid grid-cols-1 border-y-2 border-border sm:grid-cols-3 [&>*]:min-w-0">
        <div className="border-b-2 border-border py-3 sm:border-b-0 sm:border-r-2 sm:pr-4">
          <dt className="text-sm text-muted-foreground">Cases with findings</dt>{" "}
          <dd className="font-heading text-3xl font-bold tabular-nums">{formatInt(p.cases)}</dd>
        </div>{" "}
        <div className="border-b-2 border-border py-3 sm:border-b-0 sm:border-r-2 sm:px-4">
          <dt className="text-sm text-muted-foreground">Back wages agreed</dt>{" "}
          <dd className="font-heading text-3xl font-bold tabular-nums">{money(p.backWages)}</dd>
        </div>{" "}
        <div className="py-3 sm:pl-4">
          <dt className="text-sm text-muted-foreground">Workers owed</dt>{" "}
          <dd className="font-heading text-3xl font-bold tabular-nums">{formatInt(p.workers)}</dd>
        </div>
      </dl>{" "}
      <ColumnChart
        columns={columns}
        label={`${p.program} cases by the fiscal year their findings ended`}
        first={`FY${first}`}
        last={`FY${last}`}
        unit="cases"
        tone="yellow"
        partialKey="Cases still being concluded"
        className="mt-6"
      />{" "}
      <h3 className="mt-8 font-heading text-lg font-bold">The largest back wages</h3>{" "}
      <ol className="mt-2 divide-y divide-border/40 border-y-2 border-border">
        {p.top.map((r) => (
          <Fragment key={r.caseId}>
            {" "}
            <li className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-4 [&>*]:min-w-0">
              <span className="font-heading text-lg font-bold tabular-nums">{money(r.backWages)}</span>{" "}
              <span className="text-base">
                {r.slug ? (
                  <Link href={entityHref("employer", r.slug)} className="link font-bold">
                    {r.name}
                  </Link>
                ) : (
                  <span className="font-bold">{r.name}</span>
                )}
                {r.city || r.state ? `, ${[r.city, r.state].filter(Boolean).join(", ")}` : ""}.{" "}
                <span className="text-muted-foreground">
                  {r.workers > 0 ? `To ${plural(r.workers, "worker")}, ` : ""}
                  {plural(r.violations, "violation")}
                  {r.findingsEnd ? `, findings to ${monthYear(r.findingsEnd)}` : ""}.
                </span>{" "}
              </span>
            </li>
          </Fragment>
        ))}
      </ol>
    </section>
  );
}

export default async function WageViolationsPage() {
  const board = await getWhdVisaBoard();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">H-1B, H-2A and H-2B wage violations</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Every Wage and Hour case the Labor Department concluded under the three visa programs, from DOL&apos;s own file:
          what it found, and the back wages owed to workers.
        </p>
      </header>{" "}
      {board && board.firstFy !== null && board.lastFy !== null ? (
        <>
          <nav aria-label="Programs" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-base">
            {board.programs.map((p) => (
              <Fragment key={p.program}>
                {" "}
                <a href={`#${p.program.toLowerCase().replace("-", "")}`} className="link inline-flex min-h-11 items-center font-bold">
                  {p.program}: {money(p.backWages)}
                </a>
              </Fragment>
            ))}
          </nav>{" "}
          {board.programs.map((p) => (
            <ProgramBlock key={p.program} p={p} first={board.firstFy!} last={board.lastFy!} />
          ))}
        </>
      ) : (
        <p className="mt-10 bg-tint p-4 border-2 border-border">DOL&apos;s Wage and Hour file hasn&apos;t been loaded here yet.</p>
      )}{" "}
      <FinePrint className="mt-10" summary="What DOL says about these figures">
        <p>
          A case is a compliance action WHD concluded. Back wages are what the employer agreed to pay, not what was paid. The
          findings period isn&apos;t when the case opened or closed; years here are federal fiscal years (October to
          September) of the findings&apos; end. DOL says counts loaded after October 1, 2025 aren&apos;t directly comparable
          with earlier ones.
        </p>{" "}
        <p>
          Names are as DOL printed them. A name links to an employer page only where it matched one by legal name and the
          page files under the same program; a case that matched no page is listed with no link.
        </p>
      </FinePrint>{" "}
      <DataProvenance datasets={["whd-cases"]} className="mt-6" />{" "}
      <ToolPageFooter
        currentHref="/wage-violations"
        reading={[
          { href: "/debarments", label: "Debarments", note: "who DOL has barred from filing" },
          { href: "/layoffs", label: "Layoff notices", note: "WARN filings matched to sponsors" },
          { href: "/lca-cases", label: "H-1B LCAs", note: "the wage each filing promised" },
        ]}
      />
    </div>
  );
}
