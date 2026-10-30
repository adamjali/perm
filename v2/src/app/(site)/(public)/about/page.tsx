/**
 * The About page.
 *
 * WHY THIS PAGE EXISTS. Google's site-names doc lists an About page's
 * contents (a named publisher, a founding date, "web references to the
 * site") among what it corroborates a site's name against, and a brand query
 * goes to whichever page says the name most plainly; without one it drifts
 * to pages like /faq and /terms.
 *
 * Every fact here is read from `src/lib/constants/about.ts`, the same module
 * the homepage block and the Organization schema read, so the three surfaces
 * cannot drift apart. Nothing on this page is a claim the site owner has not
 * approved in writing; the dated milestones are the changelog's own entries.
 *
 * THE LAYOUT. Every section is the same frame (a heading, at most one line
 * under it, then the picture or figure that answers it), so the page reads
 * as one system: the person over a lime slab, the two halves as the app's
 * real pages, the sources as a flow into the pages they feed, the record as
 * the homepage's ledger, the dates as a line, and the contact as one band.
 */

import type { Metadata } from "next";
import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";

import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BankIcon,
  BriefcaseIcon,
  FileXIcon,
  HourglassIcon,
  ScalesIcon,
} from "@phosphor-icons/react/ssr";

import { SourcePages } from "@/components/about/SourcePages";
import { RecordStrip } from "@/components/home/RecordStrip";
import { AppWindow, type WindowShots } from "@/components/marketing/AppWindow";
import { TOUR_SHOTS } from "@/components/marketing/tourShots";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { withSocialCard } from "@/lib/socialCard";
import { openGraphBase } from "@/lib/openGraphBase";
import { SCHEMA_IDS } from "@/lib/structuredData";
import { getRecordCounts } from "@/lib/db/recordCounts";
import {
  ABOUT_ONE_LINER,
  FOUNDED,
  LEGAL_FORM,
  LEGAL_NAME,
  TRADE_NAME_NOTE,
  LIVE_SINCE,
  SABRINA,
} from "@/lib/constants/about";
import {
  DC_BAR_SABRINA_URL,
  LINKEDIN_SABRINA_URL,
  MEDIUM_PROFILE_URL,
  PRODUCT_HUNT_URL,
  X_PROFILE_URL,
} from "@/lib/constants/externalLinks";
import { SITE_URL } from "@/lib/constants/site";
import { buttonVariants } from "@/components/ui/button";
import { monthYear } from "@convex/lib/months";

const TITLE = "About PERM Tracker";
const DESCRIPTION =
  "Who runs PERM Tracker, an immigration attorney, since when, where every figure comes from, and what the site is not.";

export const metadata: Metadata = withSocialCard({
  // Absolute: the root template would make it "About PERM Tracker | PERM Tracker".
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    ...openGraphBase,
    title: TITLE,
    description: DESCRIPTION,
    url: "/about",
  },
}, "about");

// The record's ledger is read from the sweep's docs, which also expire this
// page when they move (api/revalidate-sweep/paths.ts).
export const revalidate = 86400;

/** "2025-11" -> "November 2025", so the page and the schema share one value. */
function monthLabel(ym: string): string {
  return monthYear(ym) ?? ym;
}

const LINK = "link";

/**
 * The public case lookup: the guide's header capture cut to the page itself,
 * since the header carries a wide plain margin that left it small in the window.
 */
const CASE_PAGE: WindowShots = {
  light: { src: "/images/about/case-page.webp", width: 1162, height: 794 },
  dark: { src: "/images/about/case-page.webp", width: 1162, height: 794 },
};

const HALVES = [
  {
    key: "waiting",
    Icon: HourglassIcon,
    title: "Waiting on a case",
    line: "Look up a PERM, wage request, LCA, H-2A or H-2B number, pending ones included, and get an email when DOL moves it. No account needed.",
    url: "permtracker.app/perm-case-status",
    shots: CASE_PAGE,
    alt: "A PERM case looked up on permtracker.app: DOL's status in plain English and the estimated decision date",
    caption: "A real case, looked up on October 11, 2026.",
    links: [
      { href: "/perm-case-status", label: "Look up a case" },
      { href: "/case-search", label: "Find one by employer" },
    ],
  },
  {
    key: "practice",
    Icon: BriefcaseIcon,
    title: "Running a practice",
    line: "A free deadline app for attorneys, paralegals and HR teams: every date under 20 CFR 656 worked out per case, with reminders and calendar sync.",
    url: "permtracker.app/dashboard",
    shots: TOUR_SHOTS.hub,
    alt: "The Deadlines panel in the PERM Tracker app: each case's next date, sorted into overdue, this week, this month and later",
    caption: "Sample cases. The employers are invented.",
    links: [
      { href: "/for-attorneys", label: "See the app" },
      { href: "/signup", label: "Start free" },
    ],
  },
] as const;

const SOURCES = [
  { agency: "Department of Labor", what: "Every case's status, pending included, and the quarterly files with the wage" },
  { agency: "USCIS", what: "I-140 and I-485 counts and processing times" },
  { agency: "State Department", what: "Every visa bulletin since June 2005" },
] as const;

const PAGES = [
  { href: "/perm-case-status", label: "PERM case status" },
  { href: "/perm-processing-times", label: "Processing times" },
  { href: "/perm-wages", label: "Wages by occupation" },
  { href: "/perm-decision-activity", label: "Decisions, day by day" },
  { href: "/visa-bulletin", label: "The visa bulletin" },
] as const;

/** The domain's own two dates, then the changelog's entries, each linked. */
const MILESTONES: readonly { when: string; what: string; href?: string }[] = [
  { when: FOUNDED, what: "The domain is registered" },
  { when: LIVE_SINCE, what: "The site goes live" },
  { when: "2026-08", what: "Every case number checked against DOL directly", href: "/changelog/case-status-and-first-party-data" },
  { when: "2026-09", what: "USCIS's own numbers, and following an employer", href: "/changelog/uscis-data-and-following-employers" },
  { when: "2026-10", what: "Open data, a free API, and H-2A, H-2B and CW-1", href: "/changelog/open-data-api-and-seasonal-visas" },
];

const NOT_THIS = [
  {
    Icon: ScalesIcon,
    title: "Not a law firm",
    line: "Nothing here is legal advice, and using it doesn't make you anyone's client.",
  },
  {
    Icon: BankIcon,
    title: "Not the government",
    line: "It reads what DOL, USCIS and the State Department publish, and can't see inside DOL beyond that.",
  },
  {
    Icon: FileXIcon,
    title: "Not your file",
    line: "It doesn't file anything. Your attorney has the file; this site shows where the queue is.",
  },
] as const;

const ELSEWHERE = [
  { href: X_PROFILE_URL, label: "X" },
  { href: MEDIUM_PROFILE_URL, label: "Medium" },
  { href: PRODUCT_HUNT_URL, label: "Product Hunt" },
] as const;

function SectionHead({ id, title, line }: { id: string; title: string; line?: string }) {
  return (
    <>
      <h2 id={id} className="font-heading text-3xl font-bold leading-tight sm:text-4xl">
        {title}
      </h2>{" "}
      {line ? <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">{line}</p> : null}
    </>
  );
}

export default async function AboutPage() {
  const baseUrl = SITE_URL;
  const record = await getRecordCounts();
  // AboutPage whose subject is the Organization node every page already
  // carries, by @id, so Google attaches these facts to the same entity rather
  // than to a second, inline copy of it.
  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${baseUrl}/about#webpage`,
    url: `${baseUrl}/about`,
    name: TITLE,
    description: DESCRIPTION,
    mainEntity: { "@id": SCHEMA_IDS.organization(baseUrl) },
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pb-28 sm:pt-14">
      <JsonLdScript schema={aboutSchema} />

      {/* The definition and the record it stands on, beside the person who runs
          it (owner, Oct 27 2026: the scattered forms read as clutter, the plain
          version as boring; the record's own figures, set large, carry the left). */}
      <section
        data-about-hero=""
        className="grid grid-cols-1 items-center gap-12 [&>*]:min-w-0 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:gap-20"
      >
        <div>
          <h1 className="font-heading text-5xl font-bold leading-[1.05] sm:text-6xl">About PERM Tracker</h1>{" "}
          <p className="mt-6 max-w-xl text-xl leading-relaxed">{ABOUT_ONE_LINER}</p>{" "}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/perm-case-status" className={buttonVariants({ size: "lg" })}>
              Check a case <ArrowRightIcon aria-hidden="true" className="size-4" weight="bold" />
            </Link>{" "}
            <Link href="/for-attorneys" className={buttonVariants({ variant: "outline", size: "lg" })}>
              For professionals
            </Link>
          </div>{" "}
          <p className="mt-5 flex flex-wrap items-center gap-x-5 text-sm text-muted-foreground">
            <span>Run by {SABRINA.name}</span>{" "}
            <a href={DC_BAR_SABRINA_URL} className="link inline-flex min-h-11 items-center" rel="noopener" target="_blank">
              D.C. Bar, 2025
            </a>{" "}
            <a href={LINKEDIN_SABRINA_URL} className="link inline-flex min-h-11 items-center" rel="me noopener" target="_blank">
              LinkedIn
            </a>{" "}
            <span>Live since {monthLabel(LIVE_SINCE)}</span>
          </p>{" "}
          {record.length ? (
            <dl className="mt-12 grid grid-cols-1 gap-x-8 gap-y-5 border-t-2 border-foreground pt-6 sm:grid-cols-3 [&>*]:min-w-0">
              {record.slice(0, 3).map((f) => (
                <div key={`${f.href} ${f.label}`}>
                  <dt className="font-heading text-4xl font-bold tabular-nums tracking-tight">{f.value.toLocaleString("en-US")}</dt>{" "}
                  <dd className="mt-1 text-base leading-snug">
                    <Link href={f.href} className="link">
                      {f.label}
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>{" "}
        {/* The portrait as a composition in the site's own language: a thick lime
            offset behind it, and her name on an ink tag over its corner, like a
            credit (owner, Oct 27 2026: the boxed card read as an ID badge). */}
        <figure className="mx-auto w-full max-w-sm pb-10 pl-4 pr-3 sm:pr-4 md:max-w-none">
          <div className="relative">
            <Image
              src={SABRINA.image}
              alt={`${SABRINA.name}, ${SABRINA.jobTitle.toLowerCase()}`}
              width={SABRINA.imageSize[0]}
              height={SABRINA.imageSize[1]}
              sizes="(min-width: 1024px) 23rem, (min-width: 768px) 20rem, 90vw"
              className="block aspect-[4/5] w-full border-2 border-foreground object-cover object-top shadow-[10px_10px_0_0_var(--primary)] sm:shadow-[14px_14px_0_0_var(--primary)]"
              priority
            />{" "}
            <figcaption className="absolute -bottom-8 -left-4 max-w-[85%] border-2 border-foreground bg-foreground px-4 py-3 text-background">
              <span className="block font-heading text-2xl font-bold leading-tight">{SABRINA.name}</span>{" "}
              <span className="mt-0.5 block text-sm">{SABRINA.jobTitle}</span>
            </figcaption>
          </div>
        </figure>{" "}
      </section>

      {/* Why it exists, said once and large: the reason is the story, so it's set
          in the heading face beside a lime rule instead of a grey paragraph. */}
      <section aria-labelledby="who" className="mt-16 md:mt-24">
        <h2 id="who" className="text-base font-semibold text-muted-foreground">
          Who runs it
        </h2>{" "}
        <p className="mt-4 max-w-4xl border-l-8 border-primary pl-6 font-heading text-2xl font-bold leading-snug sm:pl-8 sm:text-3xl">
          {SABRINA.name} is an immigration attorney. She started PERM Tracker because her clients had no way to see
          where a case stood between the filing and the decision.
        </p>
      </section>

      {/* The two halves, as the pages each one actually gets. */}
      <section aria-labelledby="halves" className="mt-24">
        <SectionHead id="halves" title="Two halves, both free" line="The same federal record, read for two different people." />{" "}
        <div className="mt-10 grid grid-cols-1 gap-16 [&>*]:min-w-0 lg:grid-cols-2 lg:gap-12">
          {HALVES.map((h) => (
            <article key={h.key} className="flex flex-col">
              <div className="flex items-center gap-3">
                <h.Icon aria-hidden="true" className="size-7 shrink-0 text-primary-text" />{" "}
                <h3 className="font-heading text-2xl font-bold">{h.title}</h3>
              </div>{" "}
              <p className="mt-3 max-w-xl text-base leading-relaxed text-soft">{h.line}</p>{" "}
              <ul className="mt-5 flex flex-wrap gap-3">
                {h.links.map((l) => (
                  <Fragment key={l.href}>
                    <li>
                      <Link href={l.href} className={buttonVariants({ variant: "outline" })}>
                        {l.label} <ArrowRightIcon aria-hidden="true" className="size-4" weight="bold" />
                      </Link>
                    </li>{" "}
                  </Fragment>
                ))}
              </ul>{" "}
              <AppWindow url={h.url} shots={h.shots} alt={h.alt} caption={h.caption} className="mt-8" />
            </article>
          ))}
        </div>
      </section>

      {/* Where the figures come from: sources, the reading, the pages. */}
      <section aria-labelledby="sources" className="mt-24">
        <SectionHead
          id="sources"
          title="Where every figure comes from"
          line="Three federal agencies, read several times a day and live on every case lookup. Each figure carries its source and its date."
        />{" "}
        <div className="mt-10">
          <SourcePages />
        </div>{" "}
        <div className="mt-12 grid grid-cols-1 items-stretch gap-4 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,0.8fr)_auto_minmax(0,1fr)]">
          <ol className="grid grid-cols-1 gap-3">
            {SOURCES.map((s) => (
              <Fragment key={s.agency}>
                <li className="bg-tint p-4 border-2 shadow-hard-sm border-border">
                  <span className="block font-heading text-lg font-bold">{s.agency}</span>{" "}
                  <span className="mt-1 block text-sm leading-snug text-muted-foreground">{s.what}</span>
                </li>{" "}
              </Fragment>
            ))}
          </ol>{" "}
          <span aria-hidden="true" className="grid place-items-center py-1">
            <ArrowRightIcon className="hidden size-8 lg:block" weight="bold" />
            <ArrowDownIcon className="size-8 lg:hidden" weight="bold" />
          </span>{" "}
          <div className="dark grid content-center border-2 p-5 shadow-hard border-black bg-[#141414] text-foreground">
            <span className="block font-heading text-xl font-bold text-primary-text">PERM Tracker</span>{" "}
            <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
              Checks DOL several times a day, loads each new file the day it lands, and asks DOL again whenever a
              case is looked up.
            </span>
          </div>{" "}
          <span aria-hidden="true" className="grid place-items-center py-1">
            <ArrowRightIcon className="hidden size-8 lg:block" weight="bold" />
            <ArrowDownIcon className="size-8 lg:hidden" weight="bold" />
          </span>{" "}
          <ul className="grid grid-cols-1 content-center gap-2">
            {PAGES.map((pg) => (
              <Fragment key={pg.href}>
                <li>
                  <Link
                    href={pg.href}
                    className={buttonVariants({ variant: "outline", size: "lg", className: "justify-between" })}
                  >
                    {pg.label} <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" weight="bold" />
                  </Link>
                </li>{" "}
              </Fragment>
            ))}
          </ul>
        </div>{" "}
        {/* The record fills the column, as it does on the homepage; only the
            sentence under it keeps a reading width (owner, Oct 27 2026). */}
        <div className="mt-12">
          <RecordStrip record={record} />{" "}
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Estimated dates are labelled as estimates and graded in public on the{" "}
            <Link href="/estimate-scorecard" className={LINK}>estimate scorecard</Link>.{" "}
            <Link href="/methodology" className={LINK}>The methodology page</Link> traces every number.
          </p>
        </div>
      </section>

      {/* Since when: the domain's own dates, then the changelog's. */}
      <section aria-labelledby="since" className="mt-24">
        <SectionHead id="since" title="Since when" />{" "}
        <ol className="relative mt-10 grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-5 lg:gap-4">
          {MILESTONES.map((m, i) => (
            <Fragment key={`${m.when} ${m.what}`}>
              <li className="relative pl-10 lg:pl-0 lg:pt-10">
                {/* The line runs from each marker to the next. */}
                {i < MILESTONES.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-[9px] top-5 -bottom-6 w-0.5 bg-border lg:left-5 lg:-right-4 lg:top-[9px] lg:bottom-auto lg:h-0.5 lg:w-auto"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-0.5 size-5 border border-input lg:top-0 ${i === MILESTONES.length - 1 ? "bg-primary" : "bg-card"}`}
                />{" "}
                <span className="block font-mono text-sm text-muted-foreground">{monthLabel(m.when)}</span>{" "}
                <span className="mt-1 block text-base leading-snug">
                  {m.href ? (
                    <Link href={m.href} className={LINK}>
                      {m.what}
                    </Link>
                  ) : (
                    m.what
                  )}
                </span>
              </li>{" "}
            </Fragment>
          ))}
        </ol>{" "}
        <p className="mt-8 text-base text-muted-foreground">
          Every change since is on the <Link href="/changelog" className={LINK}>changelog</Link>, corrections included.
        </p>
      </section>

      {/* What it isn't, in three plain refusals. */}
      <section aria-labelledby="isnt" className="mt-24">
        <SectionHead id="isnt" title="What it isn't" />{" "}
        <ul className="mt-10 grid grid-cols-1 gap-5 [&>*]:min-w-0 md:grid-cols-3">
          {NOT_THIS.map((n) => (
            <Fragment key={n.title}>
              <li className="lift border-2 border-border bg-card p-5 shadow-hard-sm">
                <n.Icon aria-hidden="true" className="size-7 text-muted-foreground" />{" "}
                <span className="mt-4 block font-heading text-xl font-bold">{n.title}</span>{" "}
                <span className="mt-2 block text-base leading-relaxed text-soft">{n.line}</span>
              </li>{" "}
            </Fragment>
          ))}
        </ul>
      </section>

      {/* One band for every way to reach it. */}
      <section aria-labelledby="contact" className="dark mt-24 p-6 sm:p-12 border-2 shadow-hard border-black bg-[#141414] text-foreground">
        <h2 id="contact" className="font-heading text-3xl font-bold leading-tight sm:text-4xl">
          Write to us
        </h2>{" "}
        <a
          href="mailto:support@permtracker.app"
          className="link mt-5 inline-flex min-h-11 items-center font-heading text-xl font-bold [overflow-wrap:anywhere] sm:text-3xl"
        >
          support@permtracker.app
        </a>{" "}
        <ul className="mt-8 flex flex-wrap gap-3">
          {ELSEWHERE.map((e) => (
            <Fragment key={e.label}>
              <li>
                <a
                  href={e.href}
                  rel="me noopener"
                  target="_blank"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  {e.label} <ArrowUpRightIcon aria-hidden="true" className="size-4" weight="bold" />
                </a>
              </li>{" "}
            </Fragment>
          ))}
        </ul>{" "}
        <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {TRADE_NAME_NOTE} {LEGAL_NAME} is {LEGAL_FORM} and the party named in the{" "}
          <Link href="/terms" className="link">
            terms
          </Link>
          . The domain was registered in {monthLabel(FOUNDED)}.
        </p>
      </section>
    </div>
  );
}
