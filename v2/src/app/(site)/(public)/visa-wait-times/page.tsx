/**
 * Visa interview wait times by consulate: the State Department's own Global
 * Visa Wait Times table, read monthly from State's second host.
 *
 * The question it answers is the one H-1B and L workers ask before they travel,
 * "how long until I can get my visa stamped in Hyderabad", so the work-visa
 * column leads, drawn as bars by country, with how India's consulates moved
 * month by month and every consulate's every column below. Every figure is
 * State's, as printed; "NA" stays "No figure", never a zero.
 */

import type { Metadata } from "next";
import { Fragment } from "react";

import { BarRows, type BarRow } from "@/components/data/BarRows";
import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { PageSection } from "@/components/data/PageSection";
import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { ScrollBox } from "@/components/ui/scroll-box";
import { longDate, monthYear } from "@convex/lib/months";
import { getVisaWaits } from "@/lib/db/visaWaits";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { FEATURED, WAIT_COLUMNS, cellKey, monthSlots, waitBarDays, waitWords, type WaitCell } from "@/lib/visaWaits";

const TITLE = "Visa Appointment Wait Times by Consulate";
const DESCRIPTION =
  "How long until the next visa interview at every U.S. embassy and consulate, for H-1B and other work visas, students and visitors, from State's own table.";
const STATE_PAGE = "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/global-visa-wait-times.html";
const IV_TOOL = "https://travel.state.gov/content/travel/en/us-visas/immigrate/nvc-timeframes.html";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/visa-wait-times" },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/visa-wait-times" },
  },
  "visa-wait-times",
);

// State updates the table about once a month; the daily read picks a new one up the same day.
export const revalidate = 86400;

const WORK = "H,L,O,P,Q|next";

function workRow(c: WaitCell, longest: number): BarRow {
  const words = waitWords(c);
  const days = waitBarDays(c);
  return {
    key: c.post,
    label: c.post,
    value: days,
    text: words,
    nullText: words,
    tone: days !== null && days >= longest * 0.6 ? "yellow" : "blue",
    tip: `${c.post}\nNext work-visa interview: ${words}\nState printed "${c.waitText}"`,
  };
}

export default async function VisaWaitTimesPage() {
  const data = await getVisaWaits();
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Visa interview wait times by consulate</h1>{" "}
        <p className="mt-4 max-w-2xl text-base text-soft">
          State&apos;s table isn&apos;t loaded yet. It&apos;s on{" "}
          <a href={STATE_PAGE} target="_blank" rel="noopener noreferrer" className="link">
            State&apos;s own page
          </a>
          .
        </p>
      </div>
    );
  }
  const reading = data.readings[data.readings.length - 1]!;
  const byPost = new Map<string, Map<string, WaitCell>>();
  for (const c of data.newest) {
    const m = byPost.get(c.post) ?? new Map<string, WaitCell>();
    m.set(cellKey(c), c);
    byPost.set(c.post, m);
  }
  const work = data.newest.filter((c) => cellKey(c) === WORK);
  const longest = Math.max(1, ...work.map((c) => waitBarDays(c) ?? 0));
  const groups = FEATURED.map((g) => ({
    country: g.country,
    cells: g.posts.flatMap((p) => {
      const c = byPost.get(p)?.get(WORK);
      return c ? [c] : [];
    }),
  })).filter((g) => g.cells.length > 0);
  const india = groups.find((g) => g.country === "India")?.cells ?? [];
  const indiaShown = india.filter((c) => waitBarDays(c) !== null);
  const indiaLong = [...indiaShown].sort((a, b) => (waitBarDays(b) ?? 0) - (waitBarDays(a) ?? 0))[0] ?? null;
  const indiaShort = [...indiaShown].sort((a, b) => (waitBarDays(a) ?? 0) - (waitBarDays(b) ?? 0))[0] ?? null;
  const quick = work.filter((c) => c.kind === "same_day" || (c.bound === "under" && (c.days ?? 99) <= 15)).length;
  const noFigure = work.filter((c) => waitBarDays(c) === null).length;
  const slots = monthSlots(data.readings);
  const posts = [...byPost.keys()].sort((a, b) => a.localeCompare(b));
  const readingDate = longDate(reading) ?? reading;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Visa interview wait times by consulate</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed">
          How long until the next visa interview at every U.S. embassy and consulate, from the State Department&apos;s
          own table, as it updated it on {readingDate}.
        </p>
      </header>{" "}
      <FigureRow className="mt-8">
        {indiaLong ? (
          <Figure tone="lime" label="Longest work-visa wait in India" value={waitWords(indiaLong)} note={indiaLong.post} />
        ) : null}{" "}
        {indiaShort ? <Figure label="Shortest in India" value={waitWords(indiaShort)} note={indiaShort.post} /> : null}{" "}
        <Figure label="Consulates with a work-visa interview within 15 days" value={`${quick} of ${work.length}`} note={`As of ${readingDate}`} />{" "}
        <Figure label="With no work-visa figure" value={String(noFigure)} note="State printed NA" />
      </FigureRow>{" "}
      <PageSection
        id="work"
        title="The next work-visa interview, country by country"
        lede="H-1B, L, O, P and Q visas share one column in State's table. A longer bar is a longer wait; the longest are drawn in yellow."
      >
        <ul className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {groups.map((g) => (
            <Fragment key={g.country}>
              <li className="object min-w-0 p-4 sm:p-5">
                <p className="font-heading text-lg font-bold">{g.country}{" "}</p>{" "}
                <BarRows
                  label={`${g.country}: the next work-visa interview at each consulate`}
                  rows={g.cells.map((c) => workRow(c, longest))}
                  max={longest}
                  className="mt-3"
                />{" "}
              </li>
            </Fragment>
          ))}
        </ul>{" "}
        <p className="mt-3 text-sm text-soft">
          State counts a month as 30 days and half a month as 15, weekends and holidays included. &ldquo;Under 15 days&rdquo; is
          State&apos;s &ldquo;&lt; 0.5 Month&rdquo;.
        </p>
      </PageSection>{" "}
      {india.length > 0 && slots.length > 1 ? (
        <PageSection
          id="india"
          title="How India's consulates moved"
          lede={`The next work-visa interview at each, month by month from ${monthYear(slots[0]!.month) ?? slots[0]!.month}.`}
        >
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {india.map((c) => {
              const cols: Column[] = slots.map((s, i) => {
                const label = monthYear(s.month) ?? s.month;
                const cell = s.reading ? data.history.find((h) => h.reading === s.reading && h.post === c.post) : undefined;
                const d = cell ? waitBarDays(cell) : null;
                if (!s.reading || !cell || d === null) {
                  return { key: s.month, value: 0, gap: true, label, tip: `${label}\n${s.reading ? "State printed no figure" : "No copy of State's table from this month is held"}` };
                }
                return { key: s.month, value: d, label, now: i === slots.length - 1, tip: `${label}\n${waitWords(cell)}` };
              });
              return (
                <Fragment key={c.post}>
                  <li className="object min-w-0 p-4 sm:p-5">
                    <p className="font-heading text-lg font-bold">{c.post}{" "}</p>{" "}
                    <p className="text-sm text-soft">Now: {waitWords(c)}{" "}</p>{" "}
                    <ColumnChart
                      columns={cols}
                      label={`${c.post}: the next work-visa interview, each month`}
                      first={cols[0]!.label}
                      last={cols[cols.length - 1]!.label}
                      unit="days"
                      tone="yellow"
                      showMax={false}
                      className="mt-3"
                    />
                  </li>
                </Fragment>
              );
            })}
          </ul>{" "}
          {slots.some((s) => !s.reading) ? (
            <p className="mt-3 text-sm text-soft">
              A dashed frame is a month with no figure: State printed NA for that consulate, or no copy of its table
              survives (State shows only the current one, and the Internet Archive holds none from{" "}
              {slots.filter((s) => !s.reading).map((s) => monthYear(s.month) ?? s.month).join(", ")}).
            </p>
          ) : null}
        </PageSection>
      ) : null}{" "}
      <PageSection id="every" title={`Every consulate, every visa (${posts.length})`} lede={`State's table as it stood on ${readingDate}.`}>
        <ScrollBox label="Every consulate's wait for each kind of visa" className="max-h-[40rem] overflow-y-auto border-2 border-foreground">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <caption className="sr-only">The wait for a visa interview at each U.S. embassy and consulate, by visa{" "}</caption>
            <thead className="sticky top-0 bg-card">
              <tr className="border-b-2 border-foreground">
                <th scope="col" className="p-2.5 font-semibold">
                  Consulate{" "}
                </th>
                {WAIT_COLUMNS.map((col) => (
                  <Fragment key={col.key}>
                    <th scope="col" className="p-2.5 text-right font-semibold">
                      {col.short}{" "}
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p} className="border-b border-border last:border-b-0">
                  <th scope="row" className="p-2.5 font-semibold">
                    {p}{" "}
                  </th>
                  {WAIT_COLUMNS.map((col) => {
                    const c = byPost.get(p)?.get(col.key);
                    return (
                      <Fragment key={col.key}>
                        <td className={`p-2.5 text-right tabular-nums ${c && waitBarDays(c) === null ? "text-muted-foreground" : ""}`}>
                          {c ? waitWords(c) : "Not listed"}{" "}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollBox>{" "}
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-soft sm:grid-cols-2">
          {WAIT_COLUMNS.map((col) => (
            <Fragment key={col.key}>
              <div>
                <dt className="inline font-semibold text-foreground">{col.short}:</dt> <dd className="inline">{col.label}</dd>
              </div>{" "}
            </Fragment>
          ))}
        </dl>
      </PageSection>{" "}
      <FinePrint summary="What State's table is, and isn't" className="mt-10">
        <ul className="max-w-2xl list-disc space-y-2 pl-5 text-base leading-relaxed">
          <li>
            It&apos;s the wait for a <strong>nonimmigrant</strong> visa interview. The immigrant visa (green card) interview
            is scheduled by the National Visa Center:{" "}
            <a href={IV_TOOL} target="_blank" rel="noopener noreferrer" className="link">
              its own timeframes
            </a>
            .
          </li>{" "}
          <li>Visitors&apos; average wait runs from paying the fee to the interview, over the month before, and State prints it only where the next appointment is more than three months out.</li>{" "}
          <li>Applicants who qualify for an interview waiver aren&apos;t in it.</li>{" "}
          <li>State doesn&apos;t say what &ldquo;NA&rdquo; means; it&apos;s shown here as &ldquo;No figure&rdquo;.</li>{" "}
          <li>
            State updates it about once a month.{" "}
            <a href={STATE_PAGE} target="_blank" rel="noopener noreferrer" className="link">
              State&apos;s own page
            </a>{" "}
            is the authority on any one consulate.
          </li>
        </ul>
      </FinePrint>{" "}
      <DataProvenance datasets={["visa-wait-times"]} />
    </div>
  );
}
