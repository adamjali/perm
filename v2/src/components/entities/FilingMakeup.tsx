import { Fragment } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { MIN_DECIDED_FOR_RATE } from "@/components/tools/EntityContext";
import { PlateLabel } from "@/components/tools/FigurePlate";
import type { FacetRow } from "@/lib/turso/entityDetail";
import { stateName } from "@/lib/usStateNames";
import { cn } from "@/lib/utils";

/**
 * What an entity's filings are actually MADE OF.
 *
 * A rank and an approval rate say how much and how well. They say nothing
 * about what the work is, and "what is this sponsor filing, and where" is the
 * question an attorney benchmarking a client and a beneficiary checking an
 * offer both arrive with.
 *
 * ## Three facets, three shapes, on purpose
 *
 * Stacking three identical ranked lists would be the lazy answer, and it
 * would also misrepresent the data: these three facets have genuinely
 * different shapes and the module follows them.
 *
 *  - OCCUPATIONS are dominated by one entry. Fragomen files 15,086 software
 *    developers against 3,397 for the next occupation, and every large tech
 *    sponsor looks the same. So the lead is set large with its share stated,
 *    and the tail is compact underneath. A six-row list of equal weight would
 *    hide the one fact that matters.
 *  - STATES are two-letter codes with no internal structure and usually few
 *    of them. They are chips, read at a glance.
 *  - FIRMS and EMPLOYERS are named parties with pages of their own, so they
 *    are links, and the count sits with the name rather than in a column.
 *
 * ## Rates are withheld below the same floor as everywhere else
 *
 * A facet with four decided cases and one denial is not a 25% denial rate. It
 * is four cases. `MIN_DECIDED_FOR_RATE` is the site-wide bar and it applies
 * here for exactly the reason it applies on the entity's own headline figure,
 * so the count is always printed and the rate only sometimes.
 */

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** The approval rate, or null when the decided count cannot carry one. */
function ratePct(row: FacetRow): number | null {
  const decided = row.certified + row.denied;
  if (decided < MIN_DECIDED_FOR_RATE) return null;
  return (row.certified / decided) * 100;
}

function Shell({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-2 border-border bg-card p-5 sm:p-6", className)}>
      {/* The spaces are load-bearing, not formatting. Without them the title
          welds to the first row and the last row welds to the note - "What the
          jobs are||Software Developers", "15-2051.01111||These are the 6
          occupations..." - because JSX drops the newline between two elements
          and every child here is block-level, so a browser shows nothing wrong
          while every DOM extractor reads one run. */}
      <PlateLabel>{title}</PlateLabel>{" "}
      {children}{" "}
      {note ? (
        <p className="mt-4 border-t border-border/40 pt-3 text-sm leading-relaxed text-foreground/70">
          {note}
        </p>
      ) : null}
    </section>
  );
}

/** The dominant occupation, set large, with the rest compact beneath it. */
export function OccupationMix({
  rows,
  total,
  className,
}: {
  rows: FacetRow[];
  /** The entity's own filing count, so the lead's share has a denominator. */
  total: number;
  className?: string;
}) {
  const lead = rows[0];
  if (!lead) return null;
  const rest = rows.slice(1);
  const leadShare = total > 0 ? (lead.n / total) * 100 : 0;
  const leadRate = ratePct(lead);
  const shown = rows.reduce((a, r) => a + r.n, 0);

  return (
    <Shell
      title="What the jobs are"
      note={
        <>
          These are the {rows.length === 1 ? "occupation" : `${rows.length} occupations`} with
          the most filings, {fmt(shown)} of {fmt(total)} cases between them.
          The occupation on a PERM is the SOC code on the form, which is the
          job as DOL classifies it rather than the job title on the offer. DOL
          still accepts two SOC vintages, so one job can appear twice under
          two codes; the code is printed for exactly that reason.
        </>
      }
      className={className}
    >
      <p className="font-heading text-2xl font-black leading-tight">
        {lead.key ? (
          <Link
            href={`/perm-wages/${lead.key}`}
            className="underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
          >
            {lead.label}
          </Link>
        ) : (
          lead.label
        )}
      </p>{" "}
      <p className="mt-1.5 font-mono text-sm tabular-nums text-foreground/70">
        {lead.code ? <>SOC {lead.code} &middot; </> : null}
        {fmt(lead.n)} filings
        {leadShare >= 1 ? `, ${leadShare.toFixed(0)}% of everything they file` : null}
        {leadRate != null ? ` · ${leadRate.toFixed(1)}% approved` : null}
      </p>

      {rest.length > 0 ? (
        <ul className="mt-5 space-y-2 border-t-2 border-border pt-4">
          {rest.map((r) => (
            <Fragment key={r.key ?? r.label}>{" "}
              <li
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
              >
                <span className="min-w-0 flex-1 text-sm font-bold leading-snug">
                  {r.key ? (
                    <Link
                      href={`/perm-wages/${r.key}`}
                      className="underline decoration-primary/60 decoration-2 underline-offset-2 hover:text-primary"
                    >
                      {r.label}
                    </Link>
                  ) : (
                    r.label
                  )}
                </span>{" "}
                <span className="font-mono text-sm tabular-nums text-foreground/70">
                  {r.code ? (
                    <span className="mr-2 font-normal text-muted-foreground">{r.code}</span>
                  ) : null}
                  {fmt(r.n)}
                </span>
              </li>
            </Fragment>
          ))}
        </ul>
      ) : null}
    </Shell>
  );
}

/** States as chips. Short codes, few of them, read at a glance. */
export function StateMix({
  rows,
  total,
  className,
}: {
  rows: FacetRow[];
  total: number;
  className?: string;
}) {
  if (rows.length === 0) return null;
  const shown = rows.reduce((a, r) => a + r.n, 0);
  return (
    <Shell
      title="Where the jobs are"
      note={
        <>
          The worksite state on the application, which is where the job is and
          not where the company is headquartered. Volume by state across
          everyone is on the{" "}
          <Link
            href="/perm-by-state"
            className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
          >
            state map
          </Link>
          .{" "}
          {rows.length === 1
            ? `This state covers ${fmt(shown)} of ${fmt(total)} filings.`
            : `These ${rows.length} states cover ${fmt(shown)} of ${fmt(total)} filings.`}
        </>
      }
      className={className}
    >
      {/* Not links. `/perm-by-state` is one page rather than a route per
          state, and a chip that looks tappable and goes nowhere is worse
          than a chip that does not. The module's own note carries the link. */}
      <ul className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <Fragment key={r.key ?? r.label}>{" "}
            <li
              className="border-2 border-border bg-background px-3 py-1.5"
            >
              <span className="block font-mono text-xs font-bold uppercase tracking-[0.1em]">
                {r.key ? stateName(r.key) : r.label}
              </span>{" "}
              <span className="block font-mono text-sm font-bold tabular-nums">{fmt(r.n)}</span>
            </li>
          </Fragment>
        ))}
      </ul>
    </Shell>
  );
}

/**
 * Named parties with pages of their own, so the name is the link.
 *
 * No ordinal marker. The list is already ordered by volume and every row
 * prints its own count, so a "1." column said nothing a reader could not
 * already see - and `<span>1</span><span>APPLE INC.</span>` reaches a text
 * extractor as "1APPLE INC.", which is the glued-text defect this codebase
 * has now had three times.
 */
export function PartyMix({
  rows,
  total,
  title,
  note,
  hrefBase,
  className,
}: {
  rows: FacetRow[];
  total: number;
  title: string;
  note: ReactNode;
  /** e.g. "/perm-attorneys". */
  hrefBase: string;
  className?: string;
}) {
  if (rows.length === 0) return null;
  const shown = rows.reduce((a, r) => a + r.n, 0);
  const share = total > 0 ? (shown / total) * 100 : 0;
  return (
    <Shell
      title={title}
      note={
        <>
          {note} {fmt(shown)} of {fmt(total)} filings, {share.toFixed(0)}% of the
          total.
        </>
      }
      className={className}
    >
      <ol className="space-y-3">
        {rows.map((r, i) => {
          const rate = ratePct(r);
          return (
            <Fragment key={r.key ?? r.label}>{" "}
              <li
                
                className={cn(i > 0 && "border-t border-border/40 pt-3")}
              >
                <span className="min-w-0 flex-1">
                  {r.key ? (
                    <Link
                      href={`${hrefBase}/${r.key}`}
                      className="font-bold leading-snug underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                    >
                      {r.label}
                    </Link>
                  ) : (
                    <span className="font-bold leading-snug">{r.label}</span>
                  )}{" "}
                  <span className="mt-0.5 block font-mono text-xs tabular-nums text-foreground/70">
                    {fmt(r.n)} filings
                    {rate != null ? ` · ${rate.toFixed(1)}% approved` : null}
                  </span>
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </Shell>
  );
}
