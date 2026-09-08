/**
 * The next visa bulletin, computed from the ones already held.
 *
 * WHY THIS PAGE. The seasonal question ("what will the October bulletin do,
 * and when does it come out") is asked in every immigration subreddit each
 * September, and the pages that answer it are dated prediction articles that
 * go stale the morning the bulletin publishes. This one is evergreen: it
 * reads the archived series (every bulletin since October 2019) and USCIS's
 * monthly I-485 inventory, both of which the ingests keep current, and it
 * changes state on its own. Before the bulletin: what every earlier bulletin
 * for that calendar month did, per category and country, beside the inventory
 * ahead of the current cutoff. After it lands: the same tables with the new
 * bulletin's moves in them, and the page rolls forward to the month after.
 *
 * Nothing here forecasts. A "same-month move" is arithmetic over a closed
 * window, printed with its count so a reader can see how thin seven data
 * points are, and every non-date transition is named rather than numbered.
 */

import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { getFAQPageSchema } from "@/lib/structuredData";
import { DataProvenance } from "@/components/data/DataProvenance";
import { BulletinAlertForm } from "@/components/tools/BulletinAlertForm";
import { FaqList } from "@/components/tools/FaqList";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { getVisaBulletinSeries, getI485Cells } from "@/lib/turso/publicData";
import { getBulletinBoard, BOARD_COUNTRIES, type BoardCell } from "@/lib/turso/bulletin";
import { computeI485Position } from "@/lib/i485/position";
import {
  archiveFloorDays,
  monthBefore,
  nextBulletinMonth,
  sameMonthMoves,
  summariseMoves,
  type SameMonthMove,
} from "@/lib/bulletinNext";
import type { CountryKey, Cutoff } from "@/lib/perm";

const TITLE = "The Next Visa Bulletin, From the Last 84";
const DESCRIPTION =
  "What every earlier bulletin for this calendar month did, per employment category and country, beside the I-485 inventory ahead of each cutoff. Measured, not predicted.";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/visa-bulletin" },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/visa-bulletin" },
  },
  "visa-bulletin",
);

// The bulletin changes monthly and the inventory monthly; a day bounds the
// staleness far below either, and the bulletin ingest revalidates on demand.
export const revalidate = 86400;

const CATEGORIES: readonly { key: string; label: string; i485: string }[] = [
  { key: "EB1", label: "EB-1 priority workers", i485: "EB1" },
  { key: "EB2", label: "EB-2 advanced degree and NIW", i485: "EB2" },
  { key: "EB3", label: "EB-3 skilled and professional", i485: "EB3" },
  { key: "EW3", label: "EB-3 other workers", i485: "EW3" },
  { key: "EB4", label: "EB-4 special immigrants", i485: "EB4" },
  { key: "EB5", label: "EB-5 unreserved", i485: "EB5U" },
  { key: "EB5R", label: "EB-5 rural set-aside", i485: "EB5R" },
  { key: "EB5HU", label: "EB-5 high-unemployment set-aside", i485: "EB5HU" },
  { key: "EB5I", label: "EB-5 infrastructure set-aside", i485: "EB5I" },
];

const COUNTRY_LABEL: Record<CountryKey, string> = {
  worldwide: "Rest of world",
  china: "China",
  india: "India",
  mexico: "Mexico",
  philippines: "Philippines",
};

/** USCIS spells the countries its own way in the inventory workbook. */
const I485_COUNTRY: Record<CountryKey, string> = {
  worldwide: "Rest of the World",
  china: "China",
  india: "India",
  mexico: "Mexico",
  philippines: "Philippines",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** 1..12 -> name; a value outside the range is a data defect and prints as such. */
function monthName(n: number): string {
  return MONTHS[n - 1] ?? `month ${n}`;
}

function monthLabel(ym: string): string {
  return `${monthName(Number(ym.slice(5, 7)))} ${ym.slice(0, 4)}`;
}

function cutoffLabel(c: Cutoff | null): string {
  if (!c) return "not listed";
  if (c.kind === "current") return "Current";
  if (c.kind === "unavailable") return "Unavailable";
  const [y, m, d] = c.iso.split("-");
  return `${monthName(Number(m)).slice(0, 3)} ${Number(d)}, ${y}`;
}

function moveLabel(m: SameMonthMove): string {
  switch (m.kind) {
    case "advanced": return `+${m.movedDays} days`;
    case "retrogressed": return `${m.movedDays} days`;
    case "held": return "held";
    case "opened": return `opened at ${cutoffLabel(m.to)}`;
    case "shut": return "shut";
    case "current": return "current";
    case "went-current": return "went current";
    case "retrogressed-from-current": return `left current for ${cutoffLabel(m.to)}`;
    case "unavailable": return "unavailable";
    default: return "not listed";
  }
}

const FAQS = [
  {
    q: "When does the next visa bulletin come out?",
    a: "The State Department publishes each month's bulletin during the month before it, usually in the middle of the month, and does not announce a date. The only publication evidence this site holds is the day the Internet Archive first captured each bulletin, printed above as a floor: the bulletin existed by that day, and may have been out earlier.",
  },
  {
    q: "Is this a prediction?",
    a: "No. It is what every earlier bulletin for the same calendar month did, measured from the month before it, with the count of bulletins behind each figure. Seven data points describe seven years; they do not promise an eighth. The inventory column is USCIS's own count of applications ahead of the current cutoff.",
  },
  {
    q: "Why does October matter more than other months?",
    a: "The federal fiscal year starts October 1 with a fresh annual allocation of employment-based visa numbers, plus whatever family-sponsored numbers went unused in the year just ended. Categories that were shut or held for the last months of a fiscal year usually reopen or advance in October. How many spillover numbers there are is not known on the day the bulletin publishes.",
  },
  {
    q: "What does 'applications ahead of the cutoff' mean?",
    a: "USCIS publishes, monthly, how many adjustment-of-status applications it holds pending by category, country and priority-date month. The column counts the ones with a priority date earlier than the current cutoff, which is the queue a visa number has to clear before the cutoff can move past them. It is a floor: USCIS withholds small cells.",
  },
] as const;

interface Row {
  country: CountryKey;
  cell: BoardCell | null;
  moves: SameMonthMove[];
  ahead: { low: number; high: number; exact: boolean } | null;
}

export default async function VisaBulletinPage() {
  const [series, board, cells] = await Promise.all([
    getVisaBulletinSeries().catch(() => []),
    getBulletinBoard().catch(() => null),
    getI485Cells().catch(() => ({}) as Record<string, [number, number, number, number][]>),
  ]);
  const breadcrumb = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "Visa bulletin", href: "/visa-bulletin" },
  ]);
  const faqSchema = getFAQPageSchema(FAQS.map((f) => ({ question: f.q, answer: f.a })));

  if (series.length === 0 || !board) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <JsonLdScript schema={breadcrumb} />
        <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">The next visa bulletin</h1>{" "}
        <p className="mt-4 text-base text-foreground/80">
          The bulletin archive is not available right now. The State Department publishes the current bulletin at{" "}
          <a href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" className="font-semibold underline" rel="noopener" target="_blank">travel.state.gov</a>.
        </p>
      </div>
    );
  }

  const last = series[series.length - 1]!;
  const next = nextBulletinMonth(last.bulletinMonth);
  const targetMonth = Number(next.slice(5, 7));
  const isFiscalStart = targetMonth === 10;
  const floors = archiveFloorDays(series).slice(-12);
  const floorDays = floors.map((f) => f.day);
  const inventoryAsOf = Object.keys(cells).length ? "USCIS's newest monthly inventory" : null;

  const sections = CATEGORIES.map((cat) => {
    const rows: Row[] = BOARD_COUNTRIES.map((country) => {
      const cell = board.finalAction.find((c) => c.category === cat.key && c.country === country) ?? null;
      const moves = sameMonthMoves(series, "finalAction", cat.key, country, targetMonth);
      let ahead: Row["ahead"] = null;
      if (cell && cell.latest.kind === "date") {
        const [y, m] = cell.latest.iso.split("-").map(Number) as [number, number];
        const pos = computeI485Position(cells, I485_COUNTRY[country], cat.i485, y, m);
        if (pos) ahead = { low: pos.low, high: pos.high, exact: pos.exact };
      }
      return { country, cell, moves, ahead };
    });
    return { ...cat, rows };
  });

  // The newest bulletin's own moves, so the day it lands the page leads with
  // what it did rather than with what the month before might do.
  const latestMoves = CATEGORIES.map((cat) => ({
    ...cat,
    rows: BOARD_COUNTRIES.map((country) => ({
      country,
      move: sameMonthMoves(series, "finalAction", cat.key, country, Number(last.bulletinMonth.slice(5, 7))).find((m) => m.bulletinMonth === last.bulletinMonth) ?? null,
    })),
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pb-24">
      <JsonLdScript schema={breadcrumb} />
      <JsonLdScript schema={faqSchema} />

      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">
        Visa bulletin · {series.length} months held, {monthLabel(series[0]!.bulletinMonth)} to {monthLabel(last.bulletinMonth)}
      </p>{" "}
      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
        The {monthLabel(next)} visa bulletin, from the last {series.length}
      </h1>{" "}
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-foreground/85">
        The newest bulletin we hold is {monthLabel(last.bulletinMonth)}. For every employment category and country, this page shows what each earlier{" "}
        {monthName(targetMonth)} bulletin did, measured against the month before it, beside USCIS&apos;s count of applications ahead of the current cutoff. It is measured, not predicted, and it rolls forward by itself when the next bulletin lands.
      </p>

      {isFiscalStart ? (
        <div className="mt-8 border-2 border-border bg-primary/10 p-5 shadow-hard">
          <p className="font-heading text-base font-bold">October is the fiscal-year start</p>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/85">
            A fresh annual allocation of employment-based numbers opens on October 1, plus whatever family-sponsored numbers went unused in the year just ended. That is why October bulletins reopen categories that were shut in August and September. How many unused numbers there are is not published on the day, so any figure you read for it before then is a guess, this page included; it prints none.
          </p>
        </div>
      ) : null}

      <h2 className="mt-12 font-heading text-2xl font-black tracking-tight">When it comes out</h2>{" "}
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/85">
        The State Department announces no date. The one piece of evidence this archive holds is the day the Internet Archive first captured each bulletin, which is a floor on the publication day.
        {floorDays.length >= 3
          ? ` Over the last ${floorDays.length} bulletins with a usable capture, that day ran from the ${Math.min(...floorDays)}th to the ${Math.max(...floorDays)}th of the month before.`
          : " Too few captures fall before the bulletin's own month to say more than \"mid-month\"."}
        {" "}Expect {monthLabel(next)} in {monthName(targetMonth === 1 ? 12 : targetMonth - 1)}; the day is the Department&apos;s.
      </p>

      {latestMoves.some((s) => s.rows.some((r) => r.move)) ? (
        <>
          <h2 className="mt-12 font-heading text-2xl font-black tracking-tight">
            What the {monthLabel(last.bulletinMonth)} bulletin did
          </h2>{" "}
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/85">
            Final action dates, each measured against {monthLabel(monthBefore(last.bulletinMonth))}.
          </p>
          <div className="mt-5 overflow-x-auto overscroll-x-none">
            <table className="w-full min-w-[640px] border-2 border-border text-sm">
              <thead className="bg-foreground text-background">
                <tr>
                  <th className="p-3 text-left font-mono text-xs uppercase tracking-wider">Category{" "}</th>
                  {BOARD_COUNTRIES.map((c) => (
                    <th key={c} className="p-3 text-left font-mono text-xs uppercase tracking-wider">{COUNTRY_LABEL[c]}{" "}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latestMoves.map((s) => (
                  <tr key={s.key} className="border-t-2 border-border">
                    <td className="p-3 font-semibold">{s.label}{" "}</td>
                    {s.rows.map((r) => (
                      <td key={r.country} className="p-3">
                        {r.move ? <span className="font-mono">{moveLabel(r.move)}</span> : <span className="text-muted-foreground">not listed</span>}{" "}
                        {r.move?.to ? <span className="block text-xs text-muted-foreground">now {cutoffLabel(r.move.to)}</span> : null}
                      {" "}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h2 className="mt-12 font-heading text-2xl font-black tracking-tight">
        What earlier {monthName(targetMonth)} bulletins did, by category
      </h2>{" "}
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/85">
        Each row is one country. The cutoff is the newest final action date we hold. The moves are every {monthName(targetMonth)} bulletin in the archive, measured against its own September; a median is printed only when there were date-to-date moves to take it over. &ldquo;Ahead of the cutoff&rdquo; is {inventoryAsOf ?? "USCIS's inventory"}: pending adjustment applications with an earlier priority date than the cutoff, a floor because USCIS withholds small cells.
      </p>

      {sections.map((s) => (
        <section key={s.key} className="mt-8">
          <h3 className="font-heading text-xl font-bold tracking-tight">{s.label}</h3>{" "}
          <div className="mt-3 overflow-x-auto overscroll-x-none">
            <table className="w-full min-w-[720px] border-2 border-border text-sm">
              <thead className="bg-foreground text-background">
                <tr>
                  <th className="p-3 text-left font-mono text-xs uppercase tracking-wider">Country{" "}</th>
                  <th className="p-3 text-left font-mono text-xs uppercase tracking-wider">Cutoff, {monthLabel(last.bulletinMonth)}{" "}</th>
                  <th className="p-3 text-left font-mono text-xs uppercase tracking-wider">Earlier {monthName(targetMonth)}s{" "}</th>
                  <th className="p-3 text-left font-mono text-xs uppercase tracking-wider">Each one{" "}</th>
                  <th className="p-3 text-left font-mono text-xs uppercase tracking-wider">Ahead of the cutoff{" "}</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => {
                  const sum = summariseMoves(r.moves);
                  return (
                    <tr key={r.country} className="border-t-2 border-border align-top">
                      <td className="p-3 font-semibold">{COUNTRY_LABEL[r.country]}{" "}</td>
                      <td className="p-3 font-mono">{cutoffLabel(r.cell?.latest ?? null)}{" "}</td>
                      <td className="p-3">
                        {sum.count === 0 ? (
                          <span className="text-muted-foreground">none held</span>
                        ) : (
                          <>
                            <span className="font-semibold">{sum.count}</span> bulletins: {sum.advanced} advanced, {sum.held} unchanged, {sum.retrogressed} retrogressed
                            {sum.count - sum.advanced - sum.held - sum.retrogressed > 0 ? `, ${sum.count - sum.advanced - sum.held - sum.retrogressed} opened, shut or current` : ""}
                            {" "}
                            {sum.medianDays !== null ? (
                              <span className="block text-xs text-muted-foreground">median {sum.medianDays > 0 ? "+" : ""}{sum.medianDays} days, range {sum.minDays} to {sum.maxDays}</span>
                            ) : null}
                          </>
                        )}
                      {" "}</td>
                      <td className="p-3 font-mono text-xs leading-relaxed">
                        {r.moves.map((m) => (
                          // Mapped siblings arrive with nothing between them; the
                          // space is part of each iteration or it does not exist.
                          <Fragment key={m.bulletinMonth}>
                            {" "}
                            <span className="block">{m.bulletinMonth.slice(0, 4)}: {moveLabel(m)}</span>
                          </Fragment>
                        ))}
                      {" "}</td>
                      <td className="p-3">
                        {r.ahead ? (
                          <span className="font-mono">{r.ahead.exact ? r.ahead.low.toLocaleString("en-US") : `${r.ahead.low.toLocaleString("en-US")} to ${r.ahead.high.toLocaleString("en-US")}`}</span>
                        ) : (
                          <span className="text-muted-foreground">{r.cell?.latest.kind === "current" ? "no cutoff" : "not published"}</span>
                        )}
                      {" "}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="mt-6 text-sm text-muted-foreground">
        Bulletin figures are the State Department&apos;s, one row per published bulletin since {monthLabel(series[0]!.bulletinMonth)}. Inventory figures are USCIS&apos;s monthly pending I-485 counts. Every month-by-month cutoff, both charts, is on the{" "}
        <Link href="/tools/priority-date-calculator" className="font-semibold underline underline-offset-2">priority date page</Link>, and the queue ahead of your own date on the{" "}
        <Link href="/tools/i485-queue-position" className="font-semibold underline underline-offset-2">I-485 queue position tool</Link>.
      </p>

      <div className="mt-12">
        <BulletinAlertForm source="visa-bulletin" />
      </div>

      <div className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>{" "}
        <FaqList items={FAQS} />
      </div>

      <DataProvenance datasets={["visa-bulletin", "i485-inventory"]} />

      <ToolPageFooter
        currentHref="/visa-bulletin"
        reading={[
          { href: `/visa-bulletin/${last.bulletinMonth}`, label: `The ${monthLabel(last.bulletinMonth)} bulletin, every cutoff`, note: "both charts, all nine categories, five countries, and what each cell did since the month before" },
          { href: "/tools/priority-date-calculator", label: "Priority dates, every bulletin since 2019", note: "the month-by-month cutoffs both tables above are summarised from" },
          { href: "/tools/i485-queue-position", label: "I-485 queue position", note: "the inventory ahead of your own priority date, not just the cutoff" },
          { href: "/tools/green-card-timeline", label: "Green card timeline", note: "the whole road from PERM to adjustment, with the wait at each stage" },
        ]}
      />
    </div>
  );
}
