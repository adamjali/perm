import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FiledOnDay } from "@/components/queue/FiledOnDay";
import { SearchParamsBoundary } from "@/hooks/useUrlSearchParams";
import { getFiledOn } from "@/lib/db/filingDay";
import { filingDayOf } from "@/lib/filingDay";
import { formatInt } from "@/lib/format";
import { easternDay, MS_PER_DAY } from "@convex/lib/time";
import { longDate, monthYear, weekdayName } from "@convex/lib/months";

/**
 * One filing day: every PERM case and wage request DOL's record holds for it, with each
 * one's status today (owner, Oct 27 2026: open a month down to the cases). Reached from a
 * filing month's chart by day. Thousands of these exist, each a small list, so they stay
 * out of the sitemap and robots.txt keeps crawlers off them; the month pages are the ones
 * worth indexing.
 *
 * Statuses move with every sweep, so a page holds for six hours.
 */
export const revalidate = 21600;

export async function generateStaticParams(): Promise<{ month: string; day: string }[]> {
  return [];
}

type Params = { month: string; day: string };

const dayOf = (p: Params) => filingDayOf(p.month, p.day, easternDay());
const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
const href = (iso: string) => `/perm-queue/${iso.slice(0, 7)}/${iso.slice(8, 10)}`;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const day = dayOf(await params);
  if (!day) notFound();
  return {
    title: `PERM Cases Filed ${longDate(day)}`,
    description: `Every PERM case and wage request filed on ${longDate(day)}, with each one's status at DOL today.`,
    alternates: { canonical: href(day) },
    robots: { index: false, follow: true },
  };
}

export default async function FiledOnDayPage({ params }: { params: Promise<Params> }) {
  const day = dayOf(await params);
  if (!day) notFound();
  const { perm, pwd, capped } = await getFiledOn(day);
  const dayLabel = longDate(day) ?? day;
  const waiting = perm.filter((c) => !c.final).length;
  const before = shift(day, -1);
  const after = shift(day, 1);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <p className="text-base text-soft">{weekdayName(day)}</p>{" "}
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Filed {dayLabel}</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Every PERM case and wage request DOL&apos;s record holds for this filing day, with each one&apos;s status today.
        </p>
      </header>{" "}
      <dl className="mt-8 grid grid-cols-3 gap-2 sm:gap-3 [&>*]:min-w-0">
        {[
          { label: "PERM cases filed", value: formatInt(perm.length) },
          { label: "Still waiting at DOL", value: formatInt(waiting) },
          { label: "Wage requests filed", value: formatInt(pwd.length) },
        ].map((f) => (
          <div key={f.label} className="bg-tint p-3 sm:p-4">
            <dt className="text-sm text-soft">{f.label}</dt>{" "}
            <dd className="m-0 mt-1 font-heading text-2xl font-bold tabular-nums sm:text-3xl">{f.value}</dd>
          </div>
        ))}
      </dl>{" "}
      <section aria-label="The cases" className="mt-10">
        {/* The list reads its filters from the address, so it needs a boundary whose fallback is the list itself. */}
        <SearchParamsBoundary>
          <FiledOnDay perm={perm} pwd={pwd} dayLabel={dayLabel} />
        </SearchParamsBoundary>
        {capped ? <p className="mt-4 text-sm text-soft">This day holds more than the list shows; it lists the first of them by employer.</p> : null}
      </section>{" "}
      <nav aria-label="Other days" className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t-2 border-border pt-6">
        <Link href={href(before)} className="link inline-flex min-h-11 items-center gap-1.5">
          <ArrowLeftIcon aria-hidden="true" className="size-4" weight="bold" /> {longDate(before)}
        </Link>{" "}
        {after <= easternDay() ? (
          <Link href={href(after)} className="link inline-flex min-h-11 items-center gap-1.5">
            {longDate(after)} <ArrowRightIcon aria-hidden="true" className="size-4" weight="bold" />
          </Link>
        ) : null}{" "}
        <Link href={`/perm-queue/${day.slice(0, 7)}`} className="link inline-flex min-h-11 items-center sm:ml-auto">
          All of {monthYear(day.slice(0, 7))}
        </Link>
      </nav>
      <DataProvenance datasets={["perm-case-status", "pwd-status"]} />
    </div>
  );
}
