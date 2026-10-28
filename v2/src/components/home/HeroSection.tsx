import { Fragment } from "react";
import { ABOUT_ONE_LINER } from "@/lib/constants/about";
import Link from "next/link";
import { FolderSimpleIcon, MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";

import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { CasePromises } from "@/components/tools/CasePromises";
import { currentWait, type WaitMonthRow } from "@/lib/waitTrend";
import { checkedLabel } from "@/lib/time";
import { formatMonth, formatMonthDay } from "@/lib/dolFormat";
import { formatInt } from "@/lib/format";
import type { HomeMonth } from "@/lib/homeMonths";
import { monthTick } from "@convex/lib/months";

/**
 * The home page's first screen answers before it explains (owner, Oct 27 2026:
 * "first thing should be answer and visual ... less landing page marketing"):
 *
 *   1. the answer, as the H1: which filing month DOL is deciding;
 *   2. four figures from DOL's records, dated;
 *   3. the picture: PERM cases by filing month, decided and still waiting,
 *      with DOL's month marked;
 *   4. the case box, directly under it;
 *   5. what the site is, both halves, in two short lines.
 *
 * The form is a plain GET into /perm-case-status?case= (a name goes on to the
 * search from there), so it works before hydration and reads the same to a
 * crawler.
 *
 * Search engines read this page to learn what "PERM Tracker" is, so the
 * brand sits inside the H1 and the definition stays in this section, naming
 * both audiences (src/app/__tests__/brand-signals.test.ts and
 * about-surfaces.test.ts hold both).
 */

export interface HeroBoard {
  /** The filing month DOL's analysts are deciding, "YYYY-MM" (a day part is ignored). */
  frontierMonth: string | null;
  /** The newest day the sweep counted, and how many PERM cases DOL decided on it. */
  lastDay: { date: string; total: number } | null;
  /** PERM cases still pending at DOL, in the live record. */
  pending: number | null;
  /** Prevailing wage requests waiting at DOL, from its own backlog table. */
  pwdPending?: number | null;
  /** When the sweep last checked DOL, epoch ms. */
  checkedAt: number | null;
}

export interface HeroSectionProps {
  /** The figures under the answer. A missing figure drops its row. */
  board?: HeroBoard;
  /** DOL's determination months, for the typical wait. Empty is fine. */
  waitRows?: readonly WaitMonthRow[];
  /** The chart's months, from `homeMonths`. Empty draws no chart. */
  months?: readonly HomeMonth[];
}

/** One figure under the answer: what it counts, and the value as it reads. */
export interface HeroFigure {
  label: string;
  value: string;
}

/** "2026-10-05" -> "Oct 5": a date, never a weekday ("Decided Mon" read as "decided month"). */
const boardDay = (iso: string) => formatMonthDay(iso) ?? iso;

export function heroFigures(board: HeroBoard | undefined, wait: number | null): HeroFigure[] {
  const rows: HeroFigure[] = [];
  if (wait) rows.push({ label: "A PERM case takes", value: `${wait} months` });
  if (board?.pending != null) rows.push({ label: "PERM cases waiting", value: formatInt(board.pending) });
  if (board?.lastDay) rows.push({ label: `Decided on ${boardDay(board.lastDay.date)}`, value: formatInt(board.lastDay.total) });
  if (board?.pwdPending) rows.push({ label: "Wage requests waiting", value: formatInt(board.pwdPending) });
  return rows;
}

/** The chart's columns: decided at the bottom in green, still waiting above in blue. */
export function monthColumns(months: readonly HomeMonth[]): Column[] {
  return months.map((m) => {
    const name = formatMonth(m.month) ?? m.month;
    const lines = [`Filed in ${name}`];
    if (m.isFront) lines.push("DOL is deciding this month");
    if (m.total === 0) lines.push("No cases on DOL's record");
    else {
      lines.push(`${formatInt(m.decided)} decided`, `${formatInt(m.waiting)} waiting`);
      lines.push(`${Math.round((m.decided / m.total) * 100)}% decided`);
    }
    if (m.isPartial) lines.push("Still taking filings");
    return {
      key: m.month,
      value: m.total,
      label: name,
      tip: lines.join("\n"),
      now: m.isFront,
      top: m.isFront ? "DOL is here" : undefined,
      href: m.total > 0 ? `/perm-queue/${m.month}` : undefined,
      parts: [
        { value: m.decided, fill: "bg-data-good-ink" },
        { value: m.waiting, fill: "bg-data-info-ink" },
      ],
    };
  });
}

export function HeroSection({ waitRows = [], board, months = [] }: HeroSectionProps) {
  const wait = currentWait(waitRows);
  const figures = heroFigures(board, wait);
  const front = board?.frontierMonth ? formatMonth(board.frontierMonth.slice(0, 7)) : null;
  const columns = monthColumns(months);

  return (
    // Its own ground (Oct 15 to 16 2026): the page's colour, fine dots and
    // grain that fade out behind the words, closed by an ink rule.
    // `hero-ground` in globals.css.
    <section id="hero" className="hero-ground">
      <div className="mx-auto max-w-[1200px] px-4 pb-12 pt-8 sm:px-8 lg:pb-14 lg:pt-10">
        <h1 className="max-w-4xl text-balance font-heading text-[2.125rem] font-bold leading-[1.08] tracking-[-0.02em] sm:text-[2.75rem] lg:text-[3.25rem]">
          {/* The brand, small, inside the H1: the answer leads, and the name
              tells search engines whose site this is. */}
          <span className="mb-3 block text-base font-semibold tracking-normal text-soft">PERM Tracker</span>{" "}
          {front ? (
            <>
              DOL is deciding PERM cases filed in{" "}
              <span className="whitespace-nowrap bg-primary px-2 text-primary-foreground [box-decoration-break:clone] shadow-hard">
                {front}
              </span>
            </>
          ) : wait ? (
            <>A PERM case takes {wait} months</>
          ) : (
            <>The whole PERM process, tracked</>
          )}
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-base text-soft sm:text-lg">
          From the Department of Labor&apos;s own records
          {board?.checkedAt ? <>, checked {checkedLabel(board.checkedAt)}</> : null}.
        </p>{" "}
        {figures.length ? (
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 [&>*]:min-w-0">
            {figures.map((f) => (
              <Fragment key={f.label}>
                {" "}
                <div className="border-l-4 border-primary pl-3">
                  <dt className="text-sm text-soft">{f.label}</dt>{" "}
                  <dd className="m-0 mt-0.5 font-heading text-xl font-bold tabular-nums sm:text-[1.75rem]">{f.value}</dd>
                </div>
              </Fragment>
            ))}
          </dl>
        ) : null}{" "}
        {columns.length ? (
          <figure className="mt-6 sm:mt-7">
            <ColumnChart
              label="PERM cases by the month they were filed, decided and still waiting"
              unit="Cases"
              first={monthTick(months[0]!.month) ?? ""}
              last={monthTick(months[months.length - 1]!.month) ?? ""}
              height="h-24 sm:h-36 lg:h-40"
              showMax={false}
              columns={columns}
            />{" "}
            <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-soft">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 bg-data-good-ink" />
                Decided
              </span>{" "}
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 bg-data-info-ink" />
                Still waiting
              </span>{" "}
              <span className="hidden sm:inline">Each bar is one filing month. Tap one to see its cases.</span>{" "}
              {/* 44px tall to tap on a phone; the negative margin keeps the caption's line height. */}
              <Link href="/perm-queue" className="link -my-3 inline-flex min-h-11 items-center">
                Where the line stands
              </Link>
            </figcaption>
          </figure>
        ) : null}{" "}
        {/* One row under the chart, filling the column the headline and the
            chart fill: the case box in two thirds, what the site is in the
            last third. Each had stopped at 768px with nothing beside it,
            leaving the right of the hero empty (owner, Oct 27 2026). */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-center lg:gap-12 [&>*]:min-w-0">
        <div className="object p-5 sm:p-6">
          <p className="font-heading text-lg font-bold">Check a case</p>{" "}
          {/* What the number gets: the two reasons people come (owner, Oct 15). */}
          <CasePromises compact className="mt-3" />{" "}
          {/* Kept short: the field is 212px wide at 320 (hero-placeholder.test.ts). */}
          <CaseLookupForm
            className="mt-4"
            compact
            label="Case number or employer"
            placeholder="Case number or employer"
            names
            help={null}
            searchHref="/tools/perm-timeline-calculator"
            searchLabel="Estimate your wait from your filing month"
            source="home-hero"
          />{" "}
          <p className="mt-3 text-sm text-soft">Free, and no account needed.</p>
        </div>{" "}
        {/* What the site is, both halves, after the answer: search engines
            still read it in the first section, and people meet the answer
            first. */}
        <div className="border-t-2 border-border pt-6 lg:border-l-2 lg:border-t-0 lg:pl-10 lg:pt-0">
          <p className="text-base leading-normal text-soft sm:text-lg">{ABOUT_ONE_LINER}</p>{" "}
          <ul aria-label="Free on both sides" className="mt-3 flex flex-col gap-2 text-base">
            <li className="flex items-start gap-2.5">
              <MagnifyingGlassIcon size={20} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-primary-text" />{" "}
              <span>A lookup of any PERM, wage request, LCA, H-2A or H-2B case{" "}</span>
            </li>{" "}
            <li className="flex items-start gap-2.5">
              <FolderSimpleIcon size={20} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-primary-text" />{" "}
              <span>
                A case-management app for attorneys, paralegals and HR teams.{" "}
                <Link href="/for-attorneys" className="link">
                  How it works
                </Link>
              </span>
            </li>
          </ul>
        </div>
        </div>
      </div>
    </section>
  );
}
