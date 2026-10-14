import { ABOUT_ONE_LINER } from "@/lib/constants/about";
import Link from "next/link";
import { CalendarCheckIcon, MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import { Fragment } from "react";
import type { ReactNode } from "react";

import { CaseNumberAnatomy } from "@/components/tools/CaseNumberAnatomy";
import { FacetIndexMini, WindowSpansMini } from "@/components/tools/MiniDiagrams";
import { currentWait, type WaitMonthRow } from "@/lib/waitTrend";
import { checkedLabel } from "@/lib/time";

import { ArrowRight } from "./icons";
import { FlapBoard, type FlapRow } from "./FlapBoard";

/**
 * The home page's first screen: how long a PERM case takes, what the site is,
 * a case lookup, DOL's queue on a departures board, and a door for each
 * audience.
 *
 * Server markup with no client JavaScript: the form is a plain GET into
 * /perm-case-status?case=, and the doors are links, so all of it works
 * before hydration and reads the same to a crawler.
 *
 * Search engines read this page to learn what "PERM Tracker" is, so the
 * brand sits inside the H1 and the definition directly under it names both
 * audiences (src/app/__tests__/brand-signals.test.ts and about-surfaces.test.ts
 * hold both).
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
  /** The departures board's rows. A missing figure drops its row. */
  board?: HeroBoard;
  /** DOL's determination months, for the wait in the headline. Empty is fine. */
  waitRows?: readonly WaitMonthRow[];
}

/**
 * One audience's door: a drawing of what's behind it, a title and one line.
 * The whole card is the link. The `ink` tone restates every colour it
 * overrides rather than trusting text to inherit a readable one.
 */
function Door({
  title,
  body,
  href,
  figure,
  label,
  ink = false,
}: {
  title: string;
  body: string;
  href: string;
  figure: ReactNode;
  /** Who it's for, read with the link by screen readers. */
  label: string;
  ink?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={`${title}: ${label}`}
      className={`group flex flex-col border-3 border-border shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-x-0.5 active:translate-y-0.5 sm:flex-row ${
        ink ? "bg-foreground text-background" : "bg-card text-foreground"
      }`}
    >
      <span
        className={`flex items-center justify-center border-b-2 bg-manila px-4 py-3 text-black sm:w-48 sm:shrink-0 sm:border-b-0 sm:border-r-2 ${
          ink ? "border-background/40" : "border-border"
        }`}
      >
        <span className="block w-full max-w-[170px]">{figure}</span>
      </span>{" "}
      <span className="flex flex-1 flex-col justify-center px-4 py-3">
        <span className="flex items-center justify-between gap-3 font-heading text-lg font-black leading-tight">
          {title}{" "}
          <ArrowRight className="shrink-0 transition-transform duration-150 group-hover:translate-x-1" />
        </span>{" "}
        <span className={`mt-1 text-base leading-snug ${ink ? "text-background/85" : "text-foreground/75"}`}>
          {body}
        </span>
      </span>
    </Link>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-12-01" -> "Dec 2025": a board row is about ten cells wide. */
function boardMonth(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${y}`;
}

/**
 * "2026-10-05" -> "Oct 5". A date, not a weekday: the board is set in
 * capitals, and "DECIDED MON" read as "decided month".
 */
function boardDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${Number(d)}`;
}

export function boardRowsFor(board: HeroBoard | undefined): FlapRow[] {
  if (!board) return [];
  const rows: FlapRow[] = [];
  if (board.frontierMonth) rows.push({ label: "Now deciding", value: boardMonth(board.frontierMonth) });
  if (board.lastDay) rows.push({ label: `Decided ${boardDay(board.lastDay.date)}`, value: board.lastDay.total.toLocaleString("en-US") });
  if (board.pending !== null) rows.push({ label: "PERM waiting", value: board.pending.toLocaleString("en-US") });
  if (board.pwdPending) rows.push({ label: "Wage requests", value: board.pwdPending.toLocaleString("en-US") });
  return rows;
}

export function HeroSection({ waitRows = [], board }: HeroSectionProps) {
  const wait = currentWait(waitRows);
  const boardRows = boardRowsFor(board);

  return (
    <section id="hero" className="relative border-b-3 border-border">
      {/* Phone order: headline, lookup, board, doors. Wide: the board stands
          beside the headline and lookup, and the doors run underneath both. */}
      <div className="relative z-10 mx-auto grid max-w-[1400px] grid-cols-1 items-stretch gap-x-10 gap-y-6 px-4 pb-10 pt-8 [&>*]:min-w-0 sm:px-8 sm:pt-7 lg:grid-cols-12 lg:pb-12 lg:pt-8">
        <div className="flex flex-col lg:col-span-7">
          <h1 className="font-heading text-[1.875rem] font-black leading-[1.08] tracking-[-0.03em] sm:text-[2.75rem] lg:text-5xl xl:text-[3.5rem]">
            {/* The brand, small, inside the H1: the measured wait leads, and
                the name tells search engines whose site this is. */}
            <span className="block font-mono text-sm font-semibold uppercase tracking-[0.1em] text-foreground/60 sm:text-sm">
              PERM Tracker
            </span>{" "}
            {wait ? (
              <>
                A PERM case takes{" "}
                <span className="inline-block bg-primary px-[0.22em] text-primary-foreground shadow-hard">
                  {wait} months
                </span>
              </>
            ) : (
              <>
                The whole PERM process,{" "}
                <span className="inline-block bg-primary px-[0.22em] text-primary-foreground shadow-hard">
                  tracked
                </span>
              </>
            )}
          </h1>{" "}
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/80 sm:text-lg">
            {ABOUT_ONE_LINER}
          </p>{" "}
          {/* The two halves as two short lines, so both audiences are named
              under the H1 without a paragraph pushing the lookup down. */}
          <ul aria-label="Free on both sides" className="mt-3 flex max-w-2xl flex-col gap-1.5 text-base font-semibold sm:text-lg">
            <li className="flex items-start gap-2.5">
              <MagnifyingGlassIcon size={20} weight="bold" aria-hidden="true" className="mt-[0.2em] shrink-0 text-primary-text" />
              <span>A lookup of any PERM, wage request, LCA, H-2A or H-2B case{" "}</span>
            </li>{" "}
            <li className="flex items-start gap-2.5">
              <CalendarCheckIcon size={20} weight="bold" aria-hidden="true" className="mt-[0.2em] shrink-0 text-primary-text" />
              <span>A case-management app for attorneys, paralegals and HR teams{" "}</span>
            </li>
          </ul>{" "}
          <form
            action="/perm-case-status"
            method="get"
            className="mt-6 border-3 border-border bg-card p-4 shadow-hard sm:p-5"
          >
            <label htmlFor="hero-case" className="font-heading text-lg font-black leading-tight">
              Check a case
            </label>{" "}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              {/* Kept short: the field is 212px wide at 320 (hero-placeholder.test.ts). */}
              <input
                id="hero-case"
                name="case"
                type="text"
                required
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Case number or employer"
                aria-describedby="hero-case-anatomy"
                className="min-h-[52px] w-full min-w-0 flex-1 border-3 border-border bg-background px-4 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />{" "}
              <button
                type="submit"
          data-ph-capture-attribute-cta="hero-lookup"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 border-3 border-border bg-primary px-6 font-heading font-black text-primary-foreground shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
              >
                Check{" "}
                <ArrowRight className="shrink-0" />
              </button>
            </div>{" "}
            <CaseNumberAnatomy id="hero-case-anatomy" />{" "}
            <Link
              href="/tools/perm-timeline-calculator"
              className="mt-3 inline-flex min-h-[44px] items-center gap-2 font-bold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
            >
              No number? PERM processing time calculator{" "}
              <ArrowRight className="shrink-0" />
            </Link>
          </form>
        </div>{" "}
        {boardRows.length ? (
          <div className="lg:col-span-5 lg:flex lg:flex-col">
            <FlapBoard
              rows={boardRows}
              className="lg:h-full"
              footer={
                <>
                  {board?.checkedAt ? <span>Checked against DOL {checkedLabel(board.checkedAt)}</span> : null}{" "}
                  <Link href="/perm-queue" className="flap-board-link">
                    Where the line stands
                  </Link>
                </>
              }
            />
          </div>
        ) : null}{" "}
        <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 md:grid-cols-2 lg:col-span-12">
          {/* "State", not "country": DOL's files carry the worksite state,
              not the worker's nationality, and the search indexes these four. */}
          <Door
            label="for people waiting on a case and their employers"
            title="Search every PERM case"
            body="By employer, law firm, state and job"
            href="/perm-cases"
            figure={<FacetIndexMini />}
          />{" "}
          <Door
            ink
            label="for attorneys, paralegals and HR teams"
            title="Track every deadline"
            body="Free case software for attorneys and HR teams"
            href="/for-attorneys"
            figure={<WindowSpansMini />}
          />
        </div>
      </div>
    </section>
  );
}

