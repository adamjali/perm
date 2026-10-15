import { ABOUT_ONE_LINER } from "@/lib/constants/about";
import Link from "next/link";
import { CalendarCheckIcon, MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";

import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { FlapBoard } from "@/components/home/FlapBoard";
import { currentWait, type WaitMonthRow } from "@/lib/waitTrend";
import { checkedLabel } from "@/lib/time";
import { formatMonthDay, formatMonthShort } from "@/lib/dolFormat";

/** One figure at DOL right now: what it is, and the value as it reads. */
export interface BoardRow {
  label: string;
  value: string;
}

/**
 * The home page's first screen: how long a PERM case takes, what the site is,
 * a case lookup, and DOL's queue in four figures.
 *
 * The form is a plain GET into /perm-case-status?case= (a name goes on to the
 * search from there), so it works before hydration and reads the same to a
 * crawler.
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
  /** The figures beside the lookup. A missing figure drops its row. */
  board?: HeroBoard;
  /** DOL's determination months, for the wait in the headline. Empty is fine. */
  waitRows?: readonly WaitMonthRow[];
}

/** "2025-12-01" -> "Dec 2025". */
const boardMonth = (iso: string) => formatMonthShort(iso.slice(0, 7)) ?? iso;
/** "2026-10-05" -> "Oct 5": a date, never a weekday ("Decided Mon" read as "decided month"). */
const boardDay = (iso: string) => formatMonthDay(iso) ?? iso;

export function boardRowsFor(board: HeroBoard | undefined): BoardRow[] {
  if (!board) return [];
  const rows: BoardRow[] = [];
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
    <section id="hero">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-x-12 gap-y-10 px-4 pb-12 pt-8 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:pb-16 lg:pt-12 [&>*]:min-w-0">
        <div>
          <h1 className="font-heading text-[2.25rem] font-bold leading-[1.08] tracking-[-0.02em] sm:text-[3rem]">
            {/* The brand, small, inside the H1: the measured wait leads, and
                the name tells search engines whose site this is. */}
            <span className="mb-3 block text-base font-semibold tracking-normal text-soft">PERM Tracker</span>{" "}
            {wait ? (
              <>
                A PERM case takes{" "}
                <span className="whitespace-nowrap bg-primary px-2 text-black [box-decoration-break:clone]">
                  {wait} months
                </span>
              </>
            ) : (
              <>The whole PERM process, tracked</>
            )}
          </h1>{" "}
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-soft">{ABOUT_ONE_LINER}</p>{" "}
          {/* The two halves as two short lines, so both audiences are named
              under the H1 without a paragraph pushing the lookup down. */}
          <ul aria-label="Free on both sides" className="mt-4 flex max-w-xl flex-col gap-2 text-base">
            <li className="flex items-start gap-2.5">
              <MagnifyingGlassIcon size={20} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-primary-text" />{" "}
              <span>A lookup of any PERM, wage request, LCA, H-2A or H-2B case{" "}</span>
            </li>{" "}
            <li className="flex items-start gap-2.5">
              <CalendarCheckIcon size={20} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-primary-text" />{" "}
              <span>
                A case-management app for attorneys, paralegals and HR teams.{" "}
                <Link href="/for-attorneys" className="link">
                  How it works
                </Link>
              </span>
            </li>
          </ul>{" "}
          <div className="object mt-8 p-5 sm:p-6">
            {/* Kept short: the field is 212px wide at 320 (hero-placeholder.test.ts). */}
            <CaseLookupForm
              label="Check a case"
              placeholder="Case number or employer"
              names
              help={null}
              searchHref="/tools/perm-timeline-calculator"
              searchLabel="Estimate your wait from your filing month"
              source="home-hero"
            />
          </div>
        </div>{" "}
        {boardRows.length ? (
          <aside aria-label="At DOL now" className="lg:pt-1">
            <FlapBoard
              title="At DOL now"
              rows={boardRows}
              className="h-full"
              footer={
                <>
                  {board?.checkedAt ? <span>Checked against DOL {checkedLabel(board.checkedAt)}</span> : null}{" "}
                  <Link href="/perm-queue" className="flap-board-link">
                    Where the line stands
                  </Link>
                </>
              }
            />
          </aside>
        ) : null}
      </div>
    </section>
  );
}
