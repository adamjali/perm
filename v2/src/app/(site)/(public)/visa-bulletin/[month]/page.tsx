/**
 * One visa bulletin, every employment-based cutoff, and what moved.
 *
 * The evergreen page (`/visa-bulletin`) answers "what will the next bulletin
 * do" from the archive. This page answers the other question people type
 * into a search box every month, "visa bulletin september 2026", with the
 * whole table: both charts, every category the bulletin prints (EB-1 to
 * EB-5, other workers, and the three EB-5 set-asides since May 2022), five
 * countries, and beside each cell the move since the month before. Nothing
 * on it is a forecast; it is the State Department's own numbers, compared.
 *
 * One page per archived month (84 and counting, one a month), prerendered
 * for the newest two years and rendered on demand for the rest. A month the
 * archive does not hold is a 404 from `generateMetadata`, so a wrong URL
 * never streams a 200 with a not-found body.
 */

import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { DataProvenance } from "@/components/data/DataProvenance";
import { BulletinAlertForm } from "@/components/tools/BulletinAlertForm";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import {
  CATEGORY_LABEL,
  COUNTRY_LABEL,
  bulletinMonthLabel,
  classifyMove,
  cutoffLabel,
  moveLabel,
  type MoveKind,
} from "@/lib/bulletinNext";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { parseCutoff, type BulletinMonth, type ChartKind, type CountryKey } from "@/lib/perm";
import { withSocialCard } from "@/lib/socialCard";
import { BOARD_COUNTRIES, categoriesIn } from "@/lib/turso/bulletin";
import { getVisaBulletins } from "@/lib/turso/publicData";

// A bulletin changes once a month; a day bounds any re-parse far below that.
export const revalidate = 86400;
export const dynamicParams = true;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const PRERENDERED_MONTHS = 24;
/** The first bulletin with EB-5 set-aside rows; mirrors SET_ASIDES_FROM in the ingest. */
const SET_ASIDES_FROM = "2022-05";

interface Loaded {
  current: BulletinMonth;
  prev: BulletinMonth | null;
  prevMonth: string | null;
  nextMonth: string | null;
  newestMonth: string;
  sourceUrl: string | null;
}

function toBulletin(row: Awaited<ReturnType<typeof getVisaBulletins>>[number]): BulletinMonth {
  return {
    bulletinMonth: row.bulletinMonth,
    finalAction: (row.finalAction ?? {}) as BulletinMonth["finalAction"],
    datesForFiling: (row.datesForFiling ?? {}) as BulletinMonth["datesForFiling"],
  };
}

async function load(month: string): Promise<Loaded | null> {
  const rows = (await getVisaBulletins()).sort((a, z) =>
    a.bulletinMonth.localeCompare(z.bulletinMonth),
  );
  const idx = rows.findIndex((r) => r.bulletinMonth === month);
  const row = rows[idx];
  if (idx < 0 || !row) return null;
  const prevRow = rows[idx - 1];
  const nextRow = rows[idx + 1];
  const newest = rows[rows.length - 1];
  return {
    current: toBulletin(row),
    prev: prevRow ? toBulletin(prevRow) : null,
    prevMonth: prevRow?.bulletinMonth ?? null,
    nextMonth: nextRow?.bulletinMonth ?? null,
    newestMonth: newest ? newest.bulletinMonth : month,
    sourceUrl: row.sourceUrl,
  };
}

export async function generateStaticParams(): Promise<{ month: string }[]> {
  const rows = await getVisaBulletins();
  return rows
    .map((r) => r.bulletinMonth)
    .sort()
    .reverse()
    .slice(0, PRERENDERED_MONTHS)
    .map((month) => ({ month }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ month: string }>;
}): Promise<Metadata> {
  const { month } = await params;
  if (!MONTH_RE.test(month)) notFound();
  const loaded = await load(month);
  if (!loaded) notFound();
  const label = bulletinMonthLabel(month);
  const since = loaded.prevMonth ? ` since ${bulletinMonthLabel(loaded.prevMonth)}` : "";
  const title = `Visa Bulletin ${label}: Every EB Cutoff and What Moved`;
  return withSocialCard(
    {
      title,
      description: `Every employment-based cutoff in the ${label} visa bulletin, final action and dates for filing, with what moved${since}.`,
      alternates: { canonical: `/visa-bulletin/${month}` },
      openGraph: { ...openGraphBase, title: `${title} | PERM Tracker`, url: `/visa-bulletin/${month}` },
    },
    "visa-bulletin",
  );
}

interface Cell {
  category: string;
  country: CountryKey;
  label: string;
  kind: MoveKind | null;
  move: string | null;
}

function chartCells(chart: ChartKind, current: BulletinMonth, prev: BulletinMonth | null, categories: string[]): Cell[][] {
  return categories.map((category) =>
    BOARD_COUNTRIES.map((country) => {
      const to = parseCutoff(current[chart]?.[category]?.[country]);
      const from = prev ? parseCutoff(prev[chart]?.[category]?.[country]) : null;
      const cls = prev && to ? classifyMove(from, to) : null;
      return {
        category,
        country,
        label: cutoffLabel(to),
        kind: cls?.kind ?? null,
        move: cls && cls.kind !== "unknown" ? moveLabel(cls.kind, cls.movedDays) : null,
      };
    }),
  );
}

function tally(rows: Cell[][]): { advanced: number; held: number; back: number; opened: number; shut: number } {
  const t = { advanced: 0, held: 0, back: 0, opened: 0, shut: 0 };
  for (const row of rows) {
    for (const c of row) {
      if (c.kind === "advanced" || c.kind === "went-current") t.advanced += 1;
      else if (c.kind === "held" || c.kind === "current" || c.kind === "unavailable") t.held += 1;
      else if (c.kind === "retrogressed" || c.kind === "retrogressed-from-current") t.back += 1;
      else if (c.kind === "opened") t.opened += 1;
      else if (c.kind === "shut") t.shut += 1;
    }
  }
  return t;
}

function moveClass(kind: MoveKind | null): string {
  switch (kind) {
    case "advanced":
    case "went-current":
    case "opened":
      return "text-data-good-ink";
    case "retrogressed":
    case "retrogressed-from-current":
    case "shut":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function tallySentence(name: string, t: ReturnType<typeof tally>): string {
  const parts = [`${t.advanced} advanced`, `${t.held} unchanged`];
  if (t.back) parts.push(`${t.back} went backwards`);
  if (t.opened) parts.push(`${t.opened} reopened`);
  if (t.shut) parts.push(`${t.shut} became unavailable`);
  return `${name}: ${parts.join(", ")}.`;
}

function ChartTable({ title, rows, since }: { title: string; rows: Cell[][]; since: string | null }) {
  return (
    <div className="mt-8">
      <h2 className="font-heading text-xl font-black tracking-tight sm:text-2xl">{title}</h2>{" "}
      <p className="mt-1 text-sm text-muted-foreground">
        {since ? `Each cell shows the cutoff and its move since the ${since} bulletin.` : "The first bulletin in the archive, so no move is shown."}
      </p>{" "}
      <div className="mt-4 overflow-x-auto overscroll-x-none border-2 border-border bg-card shadow-hard-sm">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-foreground text-background">
            <tr>
              <th scope="col" className="px-3 py-3 text-left font-mono text-xs font-bold uppercase tracking-[0.1em]">Category </th>
              {BOARD_COUNTRIES.map((c) => (
                <Fragment key={c}>
                  <th scope="col" className="px-3 py-3 text-left font-mono text-xs font-bold uppercase tracking-[0.1em]">{COUNTRY_LABEL[c]} </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const first = row[0];
              if (!first) return null;
              return (
                <Fragment key={first.category}>
                  <tr className="border-t-2 border-border align-top">
                    <th scope="row" className="px-3 py-3 text-left font-semibold">
                      {CATEGORY_LABEL[first.category] ?? first.category}{" "}
                    </th>
                    {row.map((cell) => (
                      <Fragment key={cell.country}>
                        <td className="px-3 py-3">
                          <span className="font-heading font-bold">{cell.label}</span>{" "}
                          {cell.move ? (
                            <span className={`mt-0.5 block font-mono text-xs font-bold ${moveClass(cell.kind)}`}>{cell.move} </span>
                          ) : null}
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function BulletinMonthPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  if (!MONTH_RE.test(month)) notFound();
  const loaded = await load(month);
  if (!loaded) notFound();
  const { current, prev, prevMonth, nextMonth, newestMonth, sourceUrl } = loaded;

  const label = bulletinMonthLabel(month);
  const sinceLabel = prevMonth ? bulletinMonthLabel(prevMonth) : null;
  const categories = categoriesIn(prev ? [current, prev] : [current]);
  const fa = chartCells("finalAction", current, prev, categories);
  const dff = chartCells("datesForFiling", current, prev, categories);
  const faTally = tally(fa);
  const dffTally = tally(dff);
  const hasSetAsides = categories.some((c) => c === "EB5R" || c === "EB5HU" || c === "EB5I");
  const isNewest = month === newestMonth;

  const breadcrumb = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "Visa bulletin", href: "/visa-bulletin" },
    { name: label, href: `/visa-bulletin/${month}` },
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <JsonLdScript schema={breadcrumb} />

      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">
        Visa bulletin, employment-based charts
      </p>{" "}
      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
        The {label} visa bulletin
      </h1>{" "}
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-foreground/90">
        Every employment-based cutoff the State Department published for {label},
        on both charts, for the five countries the bulletin lists separately.
        {sinceLabel ? ` Beside each cutoff is what it did since the ${sinceLabel} bulletin.` : ""}{" "}
        {isNewest ? (
          <>
            This is the newest bulletin in the archive.{" "}
            <Link href="/visa-bulletin" className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
              What the next one usually does
            </Link>{" "}
            is computed from the months before it.
          </>
        ) : (
          <>
            The newest bulletin held here is{" "}
            <Link href={`/visa-bulletin/${newestMonth}`} className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
              {bulletinMonthLabel(newestMonth)}
            </Link>
            .
          </>
        )}
      </p>{" "}

      {prev ? (
        <div className="mt-6 border-2 border-border bg-card p-4 shadow-hard-sm sm:p-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            What moved, {categories.length * BOARD_COUNTRIES.length} cells per chart
          </p>{" "}
          <p className="mt-2 text-base leading-relaxed">
            {tallySentence("Final action dates", faTally)}{" "}
            {tallySentence("Dates for filing", dffTally)}
          </p>
        </div>
      ) : null}{" "}

      <ChartTable title="Final action dates" rows={fa} since={sinceLabel} />{" "}
      <ChartTable title="Dates for filing" rows={dff} since={sinceLabel} />{" "}

      <p className="mt-6 text-sm leading-relaxed text-foreground/75">
        A date means applications with a priority date earlier than it can act
        that month. <strong className="font-semibold text-foreground">Current</strong> means
        every priority date can; <strong className="font-semibold text-foreground">Unavailable</strong>{" "}
        means none can, usually because the fiscal year&apos;s numbers for that
        category and country are used up.{" "}
        {hasSetAsides
          ? "The three EB-5 set-asides are the reserved rural, high-unemployment and infrastructure allocations created in 2022; USCIS publishes their I-485 inventory separately."
          : month < SET_ASIDES_FROM
            ? "The EB-5 set-aside rows did not exist yet in this month's bulletin; they begin in May 2022."
            : "This month's copy was read before the parser learned the three EB-5 set-aside rows; they will appear once it is re-read."}
      </p>{" "}

      <nav aria-label="Other bulletins" className="mt-8 flex flex-wrap items-center gap-3">
        {prevMonth ? (
          <Link href={`/visa-bulletin/${prevMonth}`} className="flex min-h-11 items-center gap-2 border-2 border-border bg-background px-4 font-heading text-sm font-black shadow-hard-sm transition-transform hover:-translate-y-[1px] motion-reduce:transition-none">
            <ArrowLeftIcon className="size-4" aria-hidden="true" /> {bulletinMonthLabel(prevMonth)}
          </Link>
        ) : null}{" "}
        {nextMonth ? (
          <Link href={`/visa-bulletin/${nextMonth}`} className="flex min-h-11 items-center gap-2 border-2 border-border bg-background px-4 font-heading text-sm font-black shadow-hard-sm transition-transform hover:-translate-y-[1px] motion-reduce:transition-none">
            {bulletinMonthLabel(nextMonth)} <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        ) : null}{" "}
        <Link href="/tools/priority-date-calculator" className="flex min-h-11 items-center border-2 border-border bg-primary px-4 font-heading text-sm font-black text-black shadow-hard-sm transition-transform hover:-translate-y-[1px] motion-reduce:transition-none">
          Is my priority date current?
        </Link>
      </nav>{" "}

      <div className="mt-10">
        <BulletinAlertForm source={`visa-bulletin/${month}`} />
      </div>{" "}

      {sourceUrl ? (
        <p className="mt-6 text-xs text-muted-foreground">
          Source: the State Department&apos;s bulletin page{sourceUrl.includes("web.archive.org") ? ", read from the Internet Archive" : ""}.
        </p>
      ) : null}{" "}
      <DataProvenance datasets={["visa-bulletin"]} />{" "}

      <ToolPageFooter
        currentHref={`/visa-bulletin/${month}`}
        reading={[
          { href: "/visa-bulletin", label: "What the next bulletin usually does", note: "every earlier same-month bulletin, and the inventory ahead of each cutoff" },
          { href: "/tools/i485-queue-position", label: "I-485 queue position", note: "the inventory ahead of your own priority date, not just the cutoff" },
          { href: "/tools/priority-date-calculator", label: "Priority dates, every bulletin since 2019", note: "the month-by-month cutoff history behind this table" },
        ]}
      />
    </div>
  );
}
