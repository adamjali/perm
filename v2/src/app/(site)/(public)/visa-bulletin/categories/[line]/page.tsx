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

import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { DataProvenance } from "@/components/data/DataProvenance";
import { BulletinAlertForm } from "@/components/tools/BulletinAlertForm";
import { PriorityDateEstimator } from "@/components/tools/PriorityDateEstimator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { bulletinMonthLabel, cutoffLabel } from "@/lib/bulletinNext";
import {
  LINE_CATEGORY_SHORT,
  LINE_COUNTRY_SHORT,
  LINE_PAGE_COUNTRIES,
  fiscalYearMoves,
  lineSlug,
  lineSlugs,
  parseLineSlug,
} from "@/lib/bulletinLines";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import type { BulletinMonth, CountryKey } from "@/lib/perm";
import { getLineCounts } from "@/lib/turso/bulletinLine";
import { categoriesIn, summariseBulletins, type BoardCell } from "@/lib/turso/bulletin";
import { getVisaBulletins } from "@/lib/turso/publicData";

// A bulletin changes once a month and USCIS's counts monthly or quarterly.
export const revalidate = 86400;
export const dynamicParams = true;

/** Lines the green card line calculator covers. */
const GREEN_CARD_LINE = new Set(["EB2", "EB3", "EW3"]);

async function loadArchive(): Promise<BulletinMonth[]> {
  const raw = await getVisaBulletins().catch(() => []);
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
  const bulletins = await loadArchive();
  return lineSlugs(categoriesIn(bulletins)).map((line) => ({ line }));
}

export async function generateMetadata({ params }: { params: Promise<{ line: string }> }): Promise<Metadata> {
  const { line } = await params;
  const got = await load(line);
  if (!got) notFound();
  const { cat, where } = names(got.category, got.country);
  const base = `${cat} ${where} Visa Bulletin History`;
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

function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
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
  const months = Math.round(cell.movedDays / 30.4375);
  return `It moved ${months} month${months === 1 ? "" : "s"} of priority dates across ${cell.spanMonths} months of bulletins.`;
}

export default async function BulletinLinePage({ params }: { params: Promise<{ line: string }> }) {
  const { line: slug } = await params;
  const got = await load(slug);
  if (!got) notFound();
  const { category, country, bulletins, board, fa, dff } = got;
  const { cat, where } = names(category, country);
  const counts = await getLineCounts(category, country);
  const years = fiscalYearMoves(fa.states);
  const path = `/visa-bulletin/categories/${slug}`;

  const breadcrumb = generateBreadcrumbSchema([
    { name: "Visa bulletin", href: "/visa-bulletin" },
    { name: "Categories", href: "/visa-bulletin/categories" },
    { name: `${cat} ${where}`, href: path },
  ]);

  const sameCategory = LINE_PAGE_COUNTRIES.filter((c) => c !== country);
  const sameCountry = board.categories.filter((c) => c !== category && LINE_CATEGORY_SHORT[c]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={breadcrumb} />

      <header>
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Link href="/visa-bulletin" className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary">
            Visa bulletin
          </Link>{" "}
          <span aria-hidden="true">/</span>{" "}
          <Link href="/visa-bulletin/categories" className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary">
            Every line
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          <span translate="no">{cat}</span>, {where}
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
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
            <dt className="text-base text-foreground/75">Final action, {bulletinMonthLabel(fa.latestMonth)}</dt>{" "}
            <dd className="font-heading text-2xl font-black tabular-nums">{cutoffLabel(fa.latest)}</dd>
          </div>{" "}
          <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-x-4">
            <dt className="text-base text-foreground/75">
              Dates for filing{dff ? `, ${bulletinMonthLabel(dff.latestMonth)}` : ""}
            </dt>{" "}
            <dd className="font-heading text-2xl font-black tabular-nums">{cutoffLabel(dff?.latest ?? null)}</dd>
          </div>{" "}
          <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-x-4">
            <dt className="text-base text-foreground/75">Across the archive</dt>{" "}
            <dd className="text-base leading-relaxed">
              {paceSentence(fa)}{" "}
              {fa.retrogressions.length > 0
                ? `It went backwards or shut ${fa.retrogressions.length} time${fa.retrogressions.length === 1 ? "" : "s"}, most recently in ${bulletinMonthLabel(fa.retrogressions[fa.retrogressions.length - 1]!)}.`
                : "It never went backwards."}
            </dd>
          </div>
        </dl>{" "}
        <p className="mt-3 text-base text-foreground/70">
          Final action decides when a green card can be approved; dates for filing, when USCIS allows it, decides when
          an I-485 can be filed.{" "}
          <Link href="/guides/how-the-visa-bulletin-works" className="font-semibold underline underline-offset-2 hover:text-primary">
            How the visa bulletin works
          </Link>
          .
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Check your priority date</h2>{" "}
        <PriorityDateEstimator
          bulletins={bulletins}
          categoryCodes={board.categories}
          today={todayEastern()}
          initialCategory={category}
          initialCountry={country}
          className="mt-4"
        />
      </section>

      <section className="mt-12" aria-labelledby="by-year">
        <h2 id="by-year" className="font-heading text-2xl font-black">
          A fiscal year at a time
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base text-foreground/70">
          The final action cutoff in each year&apos;s first bulletin (October) against its last (September), the year the
          State Department plans visa numbers for. Newest first.
        </p>{" "}
        <div className="mt-4 overflow-x-auto border-2 border-border">
          <table className="w-full min-w-[560px] text-left text-base">
            <thead className="border-b-2 border-border bg-muted/40">
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
                    {y.partial ? <span className="font-normal text-foreground/70"> (part)</span> : null}{" "}
                  </th>
                  <td className="px-4 py-3 tabular-nums">{cutoffLabel(y.start.cutoff)}{" "}</td>
                  <td className="px-4 py-3 tabular-nums">{cutoffLabel(y.end.cutoff)}{" "}</td>
                  <td className="px-4 py-3 tabular-nums">{movedLabel(y.movedDays)}{" "}</td>
                  <td className="px-4 py-3 tabular-nums">{y.backwards}{" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {counts.awaiting || counts.inventory ? (
        <section className="mt-12" aria-labelledby="counts">
          <h2 id="counts" className="font-heading text-2xl font-black">
            What USCIS counts in this line
          </h2>{" "}
          <dl className="mt-4 grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-3">
            {counts.awaiting ? (
              <div className="border-2 border-border bg-card p-4 shadow-hard">
                <dt className="text-base text-foreground/75">Approved petitions waiting for a visa number</dt>{" "}
                <dd className="mt-1 font-heading text-3xl font-black tabular-nums">
                  {counts.awaiting.count.toLocaleString("en-US")}
                </dd>{" "}
                <dd className="font-mono text-sm text-muted-foreground">as of {bulletinMonthLabel(counts.awaiting.asOf)}, primary applicants</dd>
              </div>
            ) : null}
            {counts.inventory ? (
              <Fragment>
                {" "}
                <div className="border-2 border-border bg-card p-4 shadow-hard">
                  <dt className="text-base text-foreground/75">I-485s pending, visa number available</dt>{" "}
                  <dd className="mt-1 font-heading text-3xl font-black tabular-nums">
                    {rangeLabel(counts.inventory.available)}
                  </dd>{" "}
                  <dd className="font-mono text-sm text-muted-foreground">inventory of {counts.inventory.asOf}</dd>
                </div>{" "}
                <div className="border-2 border-border bg-card p-4 shadow-hard">
                  <dt className="text-base text-foreground/75">I-485s pending, waiting for a visa number</dt>{" "}
                  <dd className="mt-1 font-heading text-3xl font-black tabular-nums">
                    {rangeLabel(counts.inventory.awaiting)}
                  </dd>{" "}
                  <dd className="font-mono text-sm text-muted-foreground">inventory of {counts.inventory.asOf}</dd>
                </div>
              </Fragment>
            ) : null}
          </dl>{" "}
          <p className="mt-4 max-w-3xl text-base text-foreground/70">
            The approved count is USCIS&apos;s quarterly file and counts petitions, not people: no family members, and one
            person can hold more than one. The I-485 counts are USCIS&apos;s monthly inventory, where cells of 1 to 10 are
            withheld, so they&apos;re ranges. People getting their visa abroad aren&apos;t in the I-485 counts at all.
          </p>{" "}
          {GREEN_CARD_LINE.has(category) ? (
            <Link
              href={`/tools/green-card-line?category=${category}&country=${country}`}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-6 py-3 font-bold text-primary-foreground shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm"
            >
              Count everyone ahead of your date in this line
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </section>
      ) : null}

      <nav className="mt-12" aria-labelledby="other-lines">
        <h2 id="other-lines" className="font-heading text-2xl font-black">
          Other lines
        </h2>{" "}
        <p className="mt-3 text-base font-semibold">{cat} elsewhere</p>{" "}
        <ul className="mt-2 flex flex-wrap gap-2">
          {sameCategory.map((c) => (
            <li key={c}>
              <Link
                href={`/visa-bulletin/categories/${lineSlug(category, c)}`}
                className="inline-flex min-h-[44px] items-center border-2 border-border px-3 font-semibold hover:bg-muted"
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
                className="inline-flex min-h-[44px] items-center border-2 border-border px-3 font-semibold hover:bg-muted"
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

      <DataProvenance datasets={["visa-bulletin", "uscis-eb-awaiting-visa", "i485-inventory"]} />

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
