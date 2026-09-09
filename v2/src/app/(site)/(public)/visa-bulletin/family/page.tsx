import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { COUNTRY_LABEL, cutoffLabel } from "@/lib/bulletinNext";
import { formatMonth } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";
import { BOARD_COUNTRIES, summariseBulletins, type BoardCell } from "@/lib/turso/bulletin";
import { getFamilyBulletinSeries } from "@/lib/turso/publicData";
import { withSocialCard } from "@/lib/socialCard";

/**
 * Family-sponsored cutoff history from the bulletin archive.
 *
 * The counterpart of the employment-based tools, built from the same 84-plus
 * bulletins, and deliberately smaller: USCIS publishes no I-485 inventory by
 * priority date for family categories, so there is no queue position to
 * compute and none is offered. What the archive does hold is every cutoff
 * State printed, which is what a family petitioner can actually check.
 */

const TITLE = "Family-Sponsored Visa Bulletin History";
const DESCRIPTION =
  "Every family-sponsored cutoff date (F1, F2A, F2B, F3, F4) from the visa bulletin archive by country: the latest final action and dates-for-filing cutoffs, how far each moved over the months held, and every retrogression.";
const PATH = "/visa-bulletin/family";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/visa-bulletin/family" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "visa-bulletin-family");

export const revalidate = 86400;

const CATEGORY: Record<string, { label: string; who: string }> = {
  F1: { label: "F1", who: "unmarried sons and daughters of U.S. citizens" },
  F2A: { label: "F2A", who: "spouses and children of permanent residents" },
  F2B: { label: "F2B", who: "unmarried sons and daughters (21 or over) of permanent residents" },
  F3: { label: "F3", who: "married sons and daughters of U.S. citizens" },
  F4: { label: "F4", who: "brothers and sisters of adult U.S. citizens" },
};
const ORDER = ["F1", "F2A", "F2B", "F3", "F4"];

function Movement({ cell }: { cell: BoardCell | null }) {
  if (!cell) return <span className="text-muted-foreground">not listed</span>;
  const moved =
    cell.movedDays === null || cell.spanMonths === null
      ? null
      : `${cell.movedDays >= 0 ? "+" : ""}${Math.round(cell.movedDays)} days over ${cell.spanMonths} months`;
  return (
    <>
      <span className="font-mono">{cutoffLabel(cell.latest)}</span>
      {moved ? <span className="block text-xs text-muted-foreground">{moved}</span> : null}
      {cell.retrogressions.length > 0 ? (
        <span className="block text-xs text-muted-foreground">
          {cell.retrogressions.length} {cell.retrogressions.length === 1 ? "retrogression" : "retrogressions"}
        </span>
      ) : null}
    </>
  );
}

function Board({ cells, title, note }: { cells: BoardCell[]; title: string; note: string }) {
  return (
    <section className="mt-10">
      <h2 className="font-heading text-2xl font-black tracking-tight">{title}</h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">{note}</p>{" "}
      <div className="mt-4 overflow-x-auto overscroll-x-none">
        <table className="w-full min-w-[720px] border-2 border-border text-sm">
          <thead className="bg-foreground text-background">
            <tr>
              <th className="p-3 text-left font-mono text-xs uppercase tracking-wider">Category</th>
              {BOARD_COUNTRIES.map((c) => (
                <th key={c} className="p-3 text-left font-mono text-xs uppercase tracking-wider">
                  {COUNTRY_LABEL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ORDER.map((cat) => (
              <tr key={cat} className="border-t-2 border-border align-top">
                <td className="p-3">
                  <span className="font-semibold">{CATEGORY[cat]?.label ?? cat}</span>{" "}
                  <span className="block text-xs text-muted-foreground">{CATEGORY[cat]?.who ?? ""}</span>
                </td>
                {BOARD_COUNTRIES.map((country) => (
                  <td key={country} className="p-3">
                    <Movement cell={cells.find((x) => x.category === cat && x.country === country) ?? null} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function FamilyBulletinPage() {
  const series = await getFamilyBulletinSeries();
  const board = summariseBulletins(series);
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset" as const,
    name: "Family-sponsored visa bulletin cutoff history",
    description: DESCRIPTION,
    url: `https://permtracker.app${PATH}`,
    creator: { "@type": "Organization" as const, name: "U.S. Department of State, Bureau of Consular Affairs" },
    temporalCoverage: board ? `${board.firstMonth}/${board.lastMonth}` : undefined,
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={dataset} />
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/visa-bulletin" className="underline underline-offset-2 hover:text-primary">
            Visa bulletin
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">Family-sponsored cutoffs, month by month</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          {board
            ? `Every family cutoff State printed in ${board.bulletinCount} bulletins from ${formatMonth(board.firstMonth)} to ${formatMonth(board.lastMonth)}, by category and country, with how far each moved and every month it went backwards.`
            : "The family charts are being read from the bulletin archive; check back shortly."}
        </p>
      </header>

      {board ? (
        <>
          <Board
            cells={board.finalAction}
            title={`Final action dates, ${formatMonth(board.lastMonth)}`}
            note="The cutoff a priority date has to be earlier than for the case to be approved. Movement is measured across the months held, and a retrogression is any month the date went backwards."
          />
          <Board
            cells={board.datesForFiling}
            title={`Dates for filing, ${formatMonth(board.lastMonth)}`}
            note="The chart USCIS sometimes lets applicants file an I-485 against, ahead of final action. Whether it applies in a given month is USCIS's monthly call, not the bulletin's."
          />
        </>
      ) : null}

      <section className="mt-10 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">What this page does not do</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          It prints no queue position and no forecast. The employment-based tools can count the applicants ahead of a
          date because USCIS publishes its I-485 inventory by priority date and country for those categories; it
          publishes no such inventory for family categories, so a family &ldquo;queue position&rdquo; from any source is
          a guess dressed as a count. The history above is what can be measured: where the line stood every month, and
          how it moved.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          The two newest bulletins were saved from a browser before the parser read family charts, and the State
          Department blocks the archive&apos;s crawler, so a month can lag here until it is re-read. The employment-based
          history is on{" "}
          <Link href="/tools/priority-date-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            the priority date calculator
          </Link>{" "}
          and the coming month&apos;s pattern on{" "}
          <Link href="/visa-bulletin" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            the next bulletin
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
