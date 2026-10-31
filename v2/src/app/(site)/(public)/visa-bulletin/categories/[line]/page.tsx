/**
 * One visa bulletin line: a category for one chargeability, e.g. EB-2 India.
 *
 * The month pages answer "what does this bulletin say"; this answers the
 * question people type for their own row, "eb2 india visa bulletin": where
 * the cutoff stands on both charts, how it has moved a fiscal year at a time,
 * and what USCIS counts in the line behind it. Nothing on it is a forecast.
 *
 * The slug is `/visa-bulletin/categories/<category>-<country>`, a static
 * segment beside `[month]`, so the two can never answer the same URL.
 * Unknown slugs 404 from `generateMetadata`, before anything streams.
 */

import { UscisChartNote } from "@/components/bulletin/UscisChartNote";
import { getUscisCharts } from "@/lib/uscisChartsFetch";
import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { DataProvenance } from "@/components/data/DataProvenance";
import { lineIssuance, monthName } from "@/lib/db/visaIssuances";
import { BulletinAlertForm } from "@/components/tools/BulletinAlertForm";
import { PriorityDateEstimator } from "@/components/tools/PriorityDateEstimator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { bulletinMonthLabel, cutoffGap, cutoffLabel, gapLabel } from "@/lib/bulletinNext";
import {
  LINE_CATEGORY_SHORT,
  LINE_COUNTRY_SHORT,
  LINE_PAGE_COUNTRIES,
  fiscalYearMoves,
  lineSlug,
  lineSlugs,
  parseLineSlug,
} from "@/lib/bulletinLines";
import { breadcrumbSchema } from "@/lib/breadcrumbs";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import type { BulletinMonth, CountryKey } from "@/lib/perm";
import { getLineCounts } from "@/lib/db/bulletinLine";
import { categoriesIn, summariseBulletins, type BoardCell } from "@/lib/db/bulletin";
import { getVisaBulletins } from "@/lib/db/publicData";
import { DAYS_PER_MONTH, easternDay } from "@/lib/time";
import { buttonVariants } from "@/components/ui/button";
import { ScrollBox } from "@/components/ui/scroll-box";

// A bulletin changes once a month and USCIS's counts monthly or quarterly.
export const revalidate = 86400;
export const dynamicParams = true;

/** Lines the green card line calculator covers. */
const GREEN_CARD_LINE = new Set(["EB2", "EB3", "EW3"]);

// A failed read throws: caught as an empty archive, it made every line "not
// found", and a refresh during a database blip would store that 404 for a day.
// Thrown, the refresh fails and the last good page stays.
async function loadArchive(): Promise<BulletinMonth[]> {
  const raw = await getVisaBulletins();
  return raw
    .map((b) => ({
      bulletinMonth: b.bulletinMonth,
      finalAction: (b.finalAction ?? {}) as BulletinMonth["finalAction"],
      datesForFiling: (b.datesForFiling ?? {}) as BulletinMonth["datesForFiling"],
    }))
    .sort((a, z) => a.bulletinMonth.localeCompare(z.bulletinMonth));
}

async function load(slug: string) {
  const line = parseLineSlug(slug);
  if (!line) return null;
  const bulletins = await loadArchive();
  const board = summariseBulletins(bulletins);
  if (!board) return null;
  const pick = (cells: BoardCell[]) => cells.find((c) => c.category === line.category && c.country === line.country) ?? null;
  const fa = pick(board.finalAction);
  if (!fa) return null;
  return { ...line, bulletins, board, fa, dff: pick(board.datesForFiling) };
}

function names(category: string, country: CountryKey) {
  return { cat: LINE_CATEGORY_SHORT[category] ?? category, where: LINE_COUNTRY_SHORT[country] };
}

export async function generateStaticParams() {
  // At build, an unreadable archive prerenders nothing; each line renders on its first request.
  const bulletins = await loadArchive().catch(() => []);
  return lineSlugs(categoriesIn(bulletins)).map((line) => ({ line }));
}

export async function generateMetadata({ params }: { params: Promise<{ line: string }> }): Promise<Metadata> {
  const { line } = await params;
  const got = await load(line);
  if (!got) notFound();
  const { cat, where } = names(got.category, got.country);
  // "Cutoff" is what people check; "history" is what the page adds.
  const base = `${cat} ${where} Visa Bulletin Cutoff and History`;
  const description = `The ${cat} cutoff for ${where === "Rest of World" ? "the rest of the world" : where}: this month on both charts, each fiscal year since ${got.board.firstMonth.slice(0, 4)}, and USCIS's count behind it.`;
  const path = `/visa-bulletin/categories/${line}`;
  return withSocialCard(
    {
      // The brand suffix is 15 characters; a long line name keeps its words instead.
      title: base.length + 15 > 60 ? { absolute: base } : base,
      description,
      alternates: { canonical: path },
      openGraph: { ...openGraphBase, title: `${base} | PERM Tracker`, description, url: path },
    },
    "visa-bulletin-categories",
  );
}

function movedLabel(days: number | null): string {
  if (days === null) return "not dated";
  if (days === 0) return "no change";
  return days > 0 ? `+${days.toLocaleString("en-US")} days` : `${days.toLocaleString("en-US")} days`;
}

function paceSentence(cell: BoardCell): string {
  if (cell.latest.kind === "unavailable") return "The line is shut this month, so no pace is given for it.";
  if (cell.movedDays === null || cell.spanMonths === null || cell.spanMonths <= 0) {
    return cell.latest.kind === "current"
      ? "Current in the newest bulletin; there's no dated run to measure."
      : "Too few dated bulletins to measure a pace.";
  }
  const months = Math.round(cell.movedDays / DAYS_PER_MONTH);
  return `It moved ${months} month${months === 1 ? "" : "s"} of priority dates across ${cell.spanMonths} months of bulletins.`;
}

export default async function BulletinLinePage({ params }: { params: Promise<{ line: string }> }) {
  const { line: slug } = await params;
  const got = await load(slug);
  if (!got) notFound();
  const { category, country, bulletins, board, fa, dff } = got;
  const { cat, where } = names(category, country);
  const [counts, issued, uscisCharts] = await Promise.all([
    getLineCounts(category, country),
    lineIssuance(category, country).catch(() => null),
    getUscisCharts(),
  ]);
  const years = fiscalYearMoves(fa.states);
  // How far the final action cutoff sits behind this bulletin's own month.
  const gap = cutoffGap(fa.latestMonth, fa.latest);
  // One scale for every year's bar, so a year that moved four times as far
  // draws four times as long.
  const maxMove = Math.max(1, ...years.map((y) => Math.abs(y.movedDays ?? 0)));
  const path = `/visa-bulletin/categories/${slug}`;

  const breadcrumb = breadcrumbSchema(path, `${cat} ${where}`);

  const sameCategory = LINE_PAGE_COUNTRIES.filter((c) => c !== country);
  const sameCountry = board.categories.filter((c) => c !== category && LINE_CATEGORY_SHORT[c]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={breadcrumb} />

      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
          <span translate="no">{cat}</span>, {where}
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Where this line&apos;s cutoff stands, how it has moved a fiscal year at a time, and what USCIS counts behind
          it. From the State Department&apos;s bulletins, {bulletinMonthLabel(board.firstMonth)} to{" "}
          {bulletinMonthLabel(board.lastMonth)}.
        </p>
      </header>

      <section className="mt-10" aria-labelledby="now">
        <h2 id="now" className="sr-only">
          This month
        </h2>
        <dl className="border-t-2 border-border">
          <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-x-4">
            <dt className="text-base text-soft">Final action, {bulletinMonthLabel(fa.latestMonth)}</dt>{" "}
            <dd className="font-heading text-2xl font-bold tabular-nums">{cutoffLabel(fa.latest)}</dd>
          </div>{" "}
          <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-x-4">
            <dt className="text-base text-soft">
              Dates for filing{dff ? `, ${bulletinMonthLabel(dff.latestMonth)}` : ""}
            </dt>{" "}
            <dd className="font-heading text-2xl font-bold tabular-nums">{cutoffLabel(dff?.latest ?? null)}</dd>
          </div>{" "}
          {gap ? (
            <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-x-4">
              <dt className="text-base text-soft">Behind the bulletin</dt>{" "}
              <dd>
                <span className="font-heading text-2xl font-bold tabular-nums">{gapLabel(gap)}</span>{" "}
                <span className="block text-sm text-muted-foreground">
                  {`The ${bulletinMonthLabel(fa.latestMonth)} bulletin approves priority dates from before ${cutoffLabel(fa.latest)}.`}
                </span>{" "}
                {gap.years > 0 ? (
                  // One square a year between the cutoff and the bulletin's month.
                  <span className="mt-2 flex flex-wrap gap-1" aria-hidden="true">
                    {Array.from({ length: gap.years }, (_, i) => (
                      <span key={i} className="size-4 border border-data-warn-ink bg-chart-yellow" />
                    ))}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}{" "}
          <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-x-4">
            <dt className="text-base text-soft">Since October 2014</dt>{" "}
            <dd className="text-base leading-relaxed">
              {paceSentence(fa)}{" "}
              {fa.retrogressions.length > 0
                ? `It went backwards or shut ${fa.retrogressions.length} time${fa.retrogressions.length === 1 ? "" : "s"}, most recently in ${bulletinMonthLabel(fa.retrogressions[fa.retrogressions.length - 1]!)}.`
                : "It never went backwards."}
            </dd>
          </div>
        </dl>{" "}
        <p className="mt-3 text-base text-muted-foreground">
          Final action decides when a green card can be approved; dates for filing, when USCIS allows it, decides when
          an I-485 can be filed.{" "}
          <Link href="/guides/how-the-visa-bulletin-works" className="link">
            How the visa bulletin works
          </Link>
          .
        </p>
      </section>{" "}
      <UscisChartNote charts={uscisCharts} month={fa.latestMonth} only="employment" className="mt-8" />

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">Check your priority date</h2>{" "}
        <PriorityDateEstimator
          bulletins={bulletins}
          categoryCodes={board.categories}
          today={easternDay()}
          initialCategory={category}
          initialCountry={country}
          className="mt-4"
        />
      </section>

      <section className="mt-12" aria-labelledby="by-year">
        <h2 id="by-year" className="font-heading text-2xl font-bold">
          A fiscal year at a time
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base text-muted-foreground">
          The final action cutoff in each year&apos;s first bulletin (October) against its last (September), the year the
          State Department plans visa numbers for. Newest first.
        </p>{" "}
        <ScrollBox label="Cutoffs a fiscal year at a time" className="mt-4 border-t-2 border-[var(--object-border)]">
          <table className="w-full min-w-[560px] text-left text-base">
            <thead className="border-b-2 border-border bg-sage">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Fiscal year{" "}</th>
                <th scope="col" className="px-4 py-3 font-bold">First bulletin{" "}</th>
                <th scope="col" className="px-4 py-3 font-bold">Last bulletin{" "}</th>
                <th scope="col" className="px-4 py-3 font-bold">Moved{" "}</th>
                <th scope="col" className="px-4 py-3 font-bold">Steps back{" "}</th>
              </tr>
            </thead>
            <tbody translate="no">
              {years.map((y) => (
                <tr key={y.fy} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-bold tabular-nums">
                    FY{y.fy}
                    {y.partial ? <span className="font-normal text-muted-foreground"> (part)</span> : null}{" "}
                  </th>
                  <td className="px-4 py-3 tabular-nums">{cutoffLabel(y.start.cutoff)}{" "}</td>
                  <td className="px-4 py-3 tabular-nums">{cutoffLabel(y.end.cutoff)}{" "}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {/* The year's move, drawn from an ink centre line: forward
                        to the right in green, backwards to the left in red. */}
                    <span className="flex items-center gap-3">
                      <span aria-hidden="true" className="relative block h-3 w-28 shrink-0 bg-sage sm:w-40">
                        <span className="absolute inset-y-[-3px] left-1/2 w-0.5 -translate-x-1/2 bg-foreground" />
                        {y.movedDays ? (
                          <span
                            className={`absolute inset-y-0 ${y.movedDays > 0 ? "left-1/2 bg-chart-green" : "right-1/2 bg-chart-red"}`}
                            style={{ width: `${Math.max(2, (Math.abs(y.movedDays) / maxMove) * 50)}%` }}
                          />
                        ) : null}
                      </span>{" "}
                      <span>{movedLabel(y.movedDays)}</span>
                    </span>{" "}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{y.backwards}{" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollBox>
      </section>

      {counts.awaiting || counts.inventory ? (
        <section className="mt-12" aria-labelledby="counts">
          <h2 id="counts" className="font-heading text-2xl font-bold">
            What USCIS counts in this line
          </h2>{" "}
          <dl className="mt-4 grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-3">
            {counts.awaiting ? (
              <div className="bg-sage p-4 border-2 shadow-hard border-border">
                <dt className="text-base text-soft">Approved petitions waiting for a visa number</dt>{" "}
                <dd className="mt-1 font-heading text-3xl font-bold tabular-nums">
                  {counts.awaiting.count.toLocaleString("en-US")}
                </dd>{" "}
                <dd className="tabular-nums text-sm text-muted-foreground">as of {bulletinMonthLabel(counts.awaiting.asOf)}, primary applicants</dd>
              </div>
            ) : null}
            {counts.inventory ? (
              <Fragment>
                {" "}
                <div className="bg-sage p-4 border-2 shadow-hard border-border">
                  <dt className="text-base text-soft">I-485s pending, visa number available</dt>{" "}
                  <dd className="mt-1 font-heading text-3xl font-bold tabular-nums">
                    {rangeLabel(counts.inventory.available)}
                  </dd>{" "}
                  <dd className="font-mono text-sm text-muted-foreground">inventory of {counts.inventory.asOf}</dd>
                </div>{" "}
                <div className="bg-sage p-4 border-2 shadow-hard border-border">
                  <dt className="text-base text-soft">I-485s pending, waiting for a visa number</dt>{" "}
                  <dd className="mt-1 font-heading text-3xl font-bold tabular-nums">
                    {rangeLabel(counts.inventory.awaiting)}
                  </dd>{" "}
                  <dd className="font-mono text-sm text-muted-foreground">inventory of {counts.inventory.asOf}</dd>
                </div>
              </Fragment>
            ) : null}
          </dl>{" "}
          <p className="mt-4 max-w-3xl text-base text-muted-foreground">
            Approved counts are petitions, not people. I-485 counts are ranges (USCIS withholds cells of 1 to 10)
            and leave out people getting their visa abroad.
          </p>{" "}
          {GREEN_CARD_LINE.has(category) ? (
            <Link
              href={`/tools/green-card-line?category=${category}&country=${country}`}
              className={buttonVariants({ variant: "outline", size: "lg", className: "mt-4" })}
            >
              Count everyone ahead of your date in this line
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </section>
      ) : null}

      {issued ? (
        <section className="mt-12 border-2 shadow-hard p-6 sm:p-8 bg-card border-border" aria-labelledby="issued">
          <h2 id="issued" className="font-heading text-xl font-bold">
            What State issued abroad in this line
          </h2>{" "}
          <p className="mt-2 max-w-3xl text-base leading-relaxed">
            <span className="font-heading text-3xl font-bold tabular-nums">{issued.total.toLocaleString("en-US")}</span>{" "}
            {issued.wholeCategory ? "EB-5 visas (all EB-5, which State doesn't split by set-aside)" : `${cat} visas`}{" "}
            {country === "worldwide" ? "to people outside the four countries listed apart" : `to people chargeable ${where}`}{" "}
            from {monthName(issued.from)} to {monthName(issued.to)}, {issued.newest.toLocaleString("en-US")} of them in{" "}
            {monthName(issued.to)}. Consulates only: a green card granted inside the US isn&apos;t in this count.{" "}
            <Link href="/visa-issuances" className="link">
              Every month and category
            </Link>
            .
          </p>
        </section>
      ) : null}

      <nav className="mt-12" aria-labelledby="other-lines">
        <h2 id="other-lines" className="font-heading text-2xl font-bold">
          Other lines
        </h2>{" "}
        <p className="mt-3 text-base font-semibold">{cat} elsewhere</p>{" "}
        <ul className="mt-2 flex flex-wrap gap-2">
          {sameCategory.map((c) => (
            <li key={c}>
              <Link
                href={`/visa-bulletin/categories/${lineSlug(category, c)}`}
                className={buttonVariants({ variant: "outline", size: "default" })}
              >
                {cat} {LINE_COUNTRY_SHORT[c]}
              </Link>{" "}
            </li>
          ))}
        </ul>{" "}
        <p className="mt-4 text-base font-semibold">Every category for {where}</p>{" "}
        <ul className="mt-2 flex flex-wrap gap-2">
          {sameCountry.map((c) => (
            <li key={c}>
              <Link
                href={`/visa-bulletin/categories/${lineSlug(c, country)}`}
                className={buttonVariants({ variant: "outline", size: "default" })}
              >
                {LINE_CATEGORY_SHORT[c]}
              </Link>{" "}
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-12">
        <BulletinAlertForm source={`visa-bulletin/categories/${slug}`} />
      </section>

      <DataProvenance datasets={["visa-bulletin", "uscis-eb-awaiting-visa", "i485-inventory", "visa-issuances"]} />

      <ToolPageFooter
        currentHref={path}
        reading={[
          { href: `/visa-bulletin/${board.lastMonth}`, label: `The ${bulletinMonthLabel(board.lastMonth)} bulletin`, note: "every line in the newest bulletin, and what moved" },
          { href: "/visa-bulletin", label: "What the next bulletin usually does", note: "every earlier same-month bulletin, and the inventory ahead of each cutoff" },
          { href: "/guides/read-your-priority-date-history", label: "Read your priority date history", note: "how to read a cutoff's past without turning it into a promise" },
        ]}
      />
    </div>
  );
}

function rangeLabel(r: { low: number; high: number }): string {
  if (r.low === r.high) return r.low.toLocaleString("en-US");
  return `${r.low.toLocaleString("en-US")} to ${r.high.toLocaleString("en-US")}`;
}
