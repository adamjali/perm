import { Fragment } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { ChartTips } from "@/components/data/ChartTips";
import { FinePrint } from "@/components/data/FinePrint";
import { entityHref, shownApprovalRate } from "@/lib/entityPayload";
import { BarRows } from "@/components/data/BarRows";
import { LEAD_BANDS } from "@/lib/recruitmentRecord";
import { PlateLabel } from "@/components/tools/FigurePlate";
import type { FacetRow } from "@/lib/db/entityDetail";
import { cleanPapers, realCities } from "@/lib/facetClean";
import { ROW_LINK } from "@/components/entities/caseRows";
import { stateName } from "@/lib/usStateNames";
import { cn } from "@/lib/utils";
import { formatApprovalRate, formatInt, formatShareOf } from "@/lib/format";

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

/** " · 98.4% approved" for a row whose decided cases carry a rate, else nothing. */
function approvedNote(row: FacetRow): string {
  const rate = shownApprovalRate(row);
  return rate === null ? "" : ` · ${formatApprovalRate(rate)} approved`;
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
    <section className={cn("flex h-full flex-col border-2 border-border bg-card p-5 shadow-hard-sm", className)}>
      {/* The spaces are load-bearing, not formatting. Without them the title
          welds to the first row and the last row welds to the note - "What the
          jobs are||Software Developers", "15-2051.01111||These are the 6
          occupations..." - because JSX drops the newline between two elements
          and every child here is block-level, so a browser shows nothing wrong
          while every DOM extractor reads one run. */}
      <PlateLabel>{title}</PlateLabel>{" "}
      {children}{" "}
      {/* THE NOTE FOLDS. Each panel's note says how its figure
          is counted; the panel itself carries the reading, so the note waits
          behind one line instead of standing under every panel. */}
      {note ? (
        // mt-auto: in a row of boxes stretched to one height, every note sits on the same line.
        <div className="mt-auto pt-3">
          <FinePrint summary="How this is counted" className="border-t border-border/40 pt-1">
            <p>{note}</p>
          </FinePrint>
        </div>
      ) : null}
    </section>
  );
}

/**
 * A row's filing count, linked to those filings when the page knows where they are: "3,420 filings" on
 * Microsoft's page opens Microsoft's Software Developers filings in the case search. 44px on a phone.
 */
function Count({ row, href, bare = false }: { row: FacetRow; href?: (row: FacetRow) => string | null; bare?: boolean }) {
  const text = bare ? formatInt(row.n) : `${formatInt(row.n)} filings`;
  const to = href?.(row);
  if (!to) return <>{text}</>;
  return (
    <Link href={to} className={ROW_LINK} aria-label={`${formatInt(row.n)} filings for ${row.label}, case by case`}>
      {text}
    </Link>
  );
}

/** The dominant occupation, set large, with the rest compact beneath it. */
export function OccupationMix({
  rows,
  total,
  className,
  filingsHref,
}: {
  rows: FacetRow[];
  /** The entity's own filing count, so the lead's share has a denominator. */
  total: number;
  className?: string;
  /** Where a job's count leads: this entity's filings for that job, case by case. */
  filingsHref?: (row: FacetRow) => string | null;
}) {
  const lead = rows[0];
  if (!lead) return null;
  const rest = rows.slice(1);
  const leadShare = total > 0 ? (lead.n / total) * 100 : 0;

  const shown = rows.reduce((a, r) => a + r.n, 0);

  return (
    <Shell
      title="What the jobs are"
      note={
        <>
          These are the {rows.length === 1 ? "occupation" : `${rows.length} occupations`} with
          the most filings, {formatInt(shown)} of {formatInt(total)} cases between them.
          The occupation on a PERM is the SOC code on the form, which is the
          job as DOL classifies it rather than the job title on the offer. DOL
          still accepts two SOC vintages, so one job can appear twice under
          two codes; the code is printed for exactly that reason.
        </>
      }
      className={className}
    >
      <p className="font-heading text-2xl font-bold leading-tight">
        {lead.key ? (
          <Link
            href={entityHref("occupation", lead.key)}
            className="link"
          >
            {lead.label}
          </Link>
        ) : (
          lead.label
        )}
      </p>{" "}
      <p className="mt-1.5 font-mono text-sm tabular-nums text-muted-foreground">
        {lead.code ? <>SOC {lead.code} &middot; </> : null}
        <Count row={lead} href={filingsHref} />
        {leadShare >= 1 ? `, ${leadShare.toFixed(0)}% of everything they file` : null}
        {approvedNote(lead)}
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
                      href={entityHref("occupation", r.key)}
                      className="link"
                    >
                      {r.label}
                    </Link>
                  ) : (
                    r.label
                  )}
                </span>{" "}
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {r.code ? (
                    <span className="mr-2 font-normal text-muted-foreground">{r.code}</span>
                  ) : null}{" "}
                  <Count row={r} href={filingsHref} bare />
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
            className="link"
          >
            state map
          </Link>
          .{" "}
          {rows.length === 1
            ? `This state covers ${formatInt(shown)} of ${formatInt(total)} filings.`
            : `These ${rows.length} states cover ${formatInt(shown)} of ${formatInt(total)} filings.`}
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
              className="bg-sage px-3 py-1.5 border-2 border-border"
            >
              <span className="block text-sm font-bold">
                {r.key ? stateName(r.key) : r.label}
              </span>{" "}
              <span className="block font-mono text-sm font-bold tabular-nums">{formatInt(r.n)}</span>
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
  filingsHref,
}: {
  rows: FacetRow[];
  total: number;
  title: string;
  note: ReactNode;
  /** e.g. "/perm-attorneys". */
  hrefBase: string;
  className?: string;
  /** Where a row's count leads: the filings this page and that row share, case by case. */
  filingsHref?: (row: FacetRow) => string | null;
}) {
  if (rows.length === 0) return null;
  const shown = rows.reduce((a, r) => a + r.n, 0);
  const share = total > 0 ? (shown / total) * 100 : 0;
  return (
    <Shell
      title={title}
      note={
        <>
          {note} {formatInt(shown)} of {formatInt(total)} filings, {share.toFixed(0)}% of the
          total.
        </>
      }
      className={className}
    >
      <ol className="space-y-3">
        {rows.map((r, i) => {
          return (
            <Fragment key={r.key ?? r.label}>{" "}
              <li
                
                className={cn(i > 0 && "border-t border-border/40 pt-3")}
              >
                <span className="min-w-0 flex-1">
                  {r.key ? (
                    <Link href={`${hrefBase}/${r.key}`} className={`${ROW_LINK} leading-snug`}>
                      {r.label}
                    </Link>
                  ) : (
                    <span className="font-bold leading-snug">{r.label}</span>
                  )}{" "}
                  <span className="mt-0.5 block font-mono text-sm tabular-nums text-muted-foreground">
                    <Count row={r} href={filingsHref} />
                    {approvedNote(r)}
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

/**
 * The states and the cities in one box: where the jobs are, at both grains.
 * An employer page shows both, and two half-empty boxes side by side read as
 * two answers to one question. The states are chips (few, short), the cities
 * bars (the question is how concentrated).
 */
export function PlaceMix({
  states,
  cities: givenCities,
  total,
  className,
}: {
  states: FacetRow[];
  cities: FacetRow[];
  total: number;
  className?: string;
}) {
  const cities = realCities(givenCities);
  if (states.length === 0 && cities.length === 0) return null;
  const top = cities[0]?.n ?? 0;
  const inStates = states.reduce((a, r) => a + r.n, 0);
  const inCities = cities.reduce((a, r) => a + r.n, 0);
  return (
    <Shell
      title="Where the jobs are"
      note={
        <>
          The worksite on the application, which is where the job is and not where the company is headquartered.{" "}
          {states.length > 0
            ? `${states.length === 1 ? "This state covers" : `These ${states.length} states cover`} ${formatInt(inStates)} of ${formatInt(total)} filings`
            : ""}
          {states.length > 0 && cities.length > 0 ? "; " : ""}
          {cities.length > 0
            ? `${cities.length === 1 ? "this city" : `these ${cities.length} cities`} ${formatInt(inCities)}`
            : ""}
          . Volume by state across everyone is on the{" "}
          <Link href="/perm-by-state" className="link">
            state map
          </Link>
          .
        </>
      }
      className={className}
    >
      {states.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {states.map((r) => (
            <Fragment key={r.key ?? r.label}>
              {" "}
              <li className="border-2 border-border bg-sage px-3 py-1">
                <span className="text-sm font-bold">{r.key ? stateName(r.key) : r.label}</span>{" "}
                <span className="ml-1 font-mono text-sm font-bold tabular-nums">{formatInt(r.n)}</span>
              </li>
            </Fragment>
          ))}
        </ul>
      ) : null}{" "}
      {cities.length > 0 ? (
        <ChartTips label="Filings by worksite city" className={states.length > 0 ? "mt-4" : undefined}>
          <ul className="space-y-2.5">
            {cities.map((r) => (
              <Fragment key={r.key ?? r.label}>
                {" "}
                <li data-tip={`${r.label}\n${formatInt(r.n)} of ${formatInt(total)} filings${approvedNote(r).replace(" · ", "\n")}`}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-bold">{r.label}</span>{" "}
                    <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{formatInt(r.n)}</span>
                  </span>{" "}
                  <span className="mt-1 block h-2 w-full bg-sage" aria-hidden="true">
                    <span className="block h-full bg-primary" style={{ width: `${top > 0 ? Math.max(2, (r.n / top) * 100) : 0}%` }} />
                  </span>
                </li>
              </Fragment>
            ))}
          </ul>
        </ChartTips>
      ) : null}
    </Shell>
  );
}

/**
 * The industry code the employer put on the form (Form 9089 Section A, Item
 * 13). DOL publishes the bare code; the title is the Census Bureau's. Most
 * employers file under one code, so the lead is set large and any others sit
 * under it with their counts.
 */
/**
 * One row per industry title. DOL's files carry the NAICS code from whichever
 * edition the form used (2007, 2012, 2017, 2022), so one industry arrives as
 * 51121, 511210, 51321 and 513210, each titled "Software Publishers" and
 * listed five times. The codes stay, busiest first, beside one count.
 */
export function groupIndustries(rows: readonly FacetRow[]): { label: string; codes: string[]; n: number }[] {
  const by = new Map<string, { label: string; codes: string[]; n: number }>();
  for (const r of rows) {
    const g = by.get(r.label) ?? { label: r.label, codes: [], n: 0 };
    if (r.key) g.codes.push(r.key);
    g.n += r.n;
    by.set(r.label, g);
  }
  return [...by.values()].sort((x, y) => y.n - x.n);
}

export function IndustryMix({
  rows: given,
  className,
}: {
  rows: FacetRow[];
  className?: string;
}) {
  const rows = groupIndustries(given);
  const lead = rows[0];
  if (!lead) return null;
  const rest = rows.slice(1);
  return (
    <Shell
      title="The industry they declared"
      note={
        <>
          The NAICS code the employer entered on the form, with the Census
          Bureau&apos;s title for it. DOL publishes the code alone, and an employer
          can file under more than one.
        </>
      }
      className={className}
    >
      <p className="font-heading text-xl font-bold leading-tight">{lead.label}</p>{" "}
      <p className="mt-1.5 text-sm tabular-nums text-muted-foreground">
        NAICS {lead.codes.join(", ")} &middot; {formatInt(lead.n)} filings
      </p>
      {rest.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t-2 border-border pt-3">
          {rest.map((r) => (
            <Fragment key={r.label}>
              {" "}
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="min-w-0 flex-1 text-sm font-bold leading-snug">{r.label}</span>{" "}
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  <span className="mr-2 font-normal text-muted-foreground">{r.codes.join(", ")}</span>
                  {formatInt(r.n)}
                </span>
              </li>
            </Fragment>
          ))}
        </ul>
      ) : null}
    </Shell>
  );
}

/**
 * Where and when it recruited before filing, from DOL's own Form 9089 Section H
 * (new-form cases, filed from June 2023): the newspapers that carried its
 * Sunday ads, the additional steps a professional job needs, and how long
 * before filing the first step ran. One count per case, and the panels only
 * show the most common rows (`TOP_N` in scripts/build_entity_detail.py).
 */
export function RecruitmentMix({
  papers = [],
  steps = [],
  lead = [],
  className,
}: {
  papers?: FacetRow[];
  steps?: FacetRow[];
  lead?: FacetRow[];
  className?: string;
}) {
  const paperRows = cleanPapers(papers);
  if (!paperRows.length && !steps.length && !lead.length) return null;
  // Every case with a first step and a filing date falls in exactly one band.
  const recorded = lead.reduce((a, r) => a + r.n, 0);
  const byBand = new Map(lead.map((r) => [r.key, r.n]));
  // One paper is a fact, not a chart: a single full bar in a box stretched to its neighbour's height read as an empty
  // box (Stoughton Trailers, Nov 4 2026). It sits as a line above the boxes instead.
  const onePaper = paperRows.length === 1 ? paperRows[0]! : null;
  // As many columns as boxes, so two boxes share the row and one box takes it whole.
  const boxes = (paperRows.length > 1 ? 1 : 0) + (steps.length ? 1 : 0) + (recorded > 0 ? 1 : 0);
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 [&>*]:min-w-0",
        boxes >= 3 ? "md:grid-cols-2 xl:grid-cols-3" : boxes === 2 ? "md:grid-cols-2" : "",
        className,
      )}
    >
      {onePaper ? (
        <p className="col-span-full">
          <span className="block text-sm text-muted-foreground">Newspaper it advertised in</span>{" "}
          <span className="font-bold">{onePaper.label}</span>{" "}
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            &middot; {formatInt(onePaper.n)} {onePaper.n === 1 ? "case" : "cases"}, its only paper
          </span>
        </p>
      ) : null}{" "}
      {paperRows.length > 1 ? (
        <Shell
          title="Newspapers it advertised in"
          note="The newspaper or professional journal named for each case's two print ads, one count per paper per case, however the filer spelled it."
        >
          <BarRows
            label="Cases by newspaper"
            rows={paperRows.map((r) => ({ key: r.key ?? r.label, label: r.label, value: r.n, text: `${formatInt(r.n)} cases` }))}
          />
        </Shell>
      ) : null}{" "}
      {steps.length ? (
        <Shell
          title="Additional steps it used"
          note="The steps a professional job needs beyond the job order and the ads, by the number of cases that name each."
        >
          <BarRows
            label="Additional recruitment steps"
            rows={steps.map((r) => ({
              key: r.key ?? r.label,
              label: r.label,
              value: r.n,
              text: `${formatInt(r.n)} cases`,
            }))}
          />
        </Shell>
      ) : null}{" "}
      {recorded > 0 ? (
        <Shell
          title="How long before filing it began"
          note="Days from the first recruitment step to the filing. 20 C.F.R. § 656.17(e) puts the job order and ads 30 to 180 days before filing."
        >
          <LeadColumns byBand={byBand} recorded={recorded} />
        </Shell>
      ) : null}{" "}
      <p className="col-span-full text-sm">
        <Link href="/perm-recruitment" className="link font-semibold">
          Where every PERM employer recruits
        </Link>
      </p>
    </div>
  );
}

/** A band's short name under its column: the day range alone, the axis says "days". */
function bandTick(b: (typeof LEAD_BANDS)[number]): string {
  if (b.to == null) return `${b.from}+`;
  if (b.from === 0) return `<${b.to + 1}`;
  return `${b.from}-${b.to}`;
}

/**
 * Days from the first recruitment step to filing, as one column per band, with
 * the 30-to-180-day window the regulation allows shaded behind the columns
 * inside it. Columns, not bar rows: seven bands read as one distribution, and
 * the shading shows at a glance how much of the filing sits inside the rule.
 */
function LeadColumns({ byBand, recorded }: { byBand: Map<string | null, number>; recorded: number }) {
  const counts = LEAD_BANDS.map((b) => byBand.get(b.id) ?? 0);
  const top = Math.max(1, ...counts);
  const inWindow = (b: (typeof LEAD_BANDS)[number]) => b.from >= 30 && b.to != null && b.to <= 180;
  return (
    <ChartTips label="Cases by days from first step to filing">
      <div className="grid h-40 grid-cols-7 items-end gap-1" aria-hidden="true">
        {LEAD_BANDS.map((b, i) => {
          const n = counts[i]!;
          return (
            <span
              key={b.id}
              data-tip={`${b.label}\n${n === 0 ? "none" : `${formatInt(n)} ${n === 1 ? "case" : "cases"}, ${formatShareOf(n, recorded)}`}`}
              className={cn("flex h-full flex-col justify-end px-0.5", inWindow(b) ? "bg-sage" : "")}
            >
              <span className="mb-1 text-center font-mono text-sm font-bold tabular-nums">
                {n === 0 ? "0" : formatShareOf(n, recorded).replace("under ", "<").replace("over ", ">")}
              </span>{" "}
              <span
                className={cn("block w-full", n > 0 ? "bg-primary" : "")}
                style={{ height: `calc(${(n / top) * 100}% - 1.75rem)`, minHeight: n > 0 ? "2px" : 0 }}
              />
            </span>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 border-t-2 border-border pt-1" aria-hidden="true">
        {LEAD_BANDS.map((b) => (
          <span key={b.id} className="text-center font-mono text-sm tabular-nums text-muted-foreground">
            {`${bandTick(b)} `}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground" aria-hidden="true">
        Days before filing. <span className="inline-block size-3 border border-input bg-sage align-middle" /> The 30 to 180 days the rule allows.
      </p>
      <ul className="sr-only">
        {LEAD_BANDS.map((b, i) => (
          <li key={b.id}>{`${b.label}: ${counts[i] === 0 ? "none" : `${formatInt(counts[i]!)} cases, ${formatShareOf(counts[i]!, recorded)}`}. `}</li>
        ))}
      </ul>
    </ChartTips>
  );
}
