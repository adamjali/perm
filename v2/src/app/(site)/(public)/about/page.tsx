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

import { RecordStrip } from "@/components/home/RecordStrip";
import { AppWindow, type WindowShots } from "@/components/marketing/AppWindow";
import { TOUR_SHOTS } from "@/components/marketing/tourShots";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { withSocialCard } from "@/lib/socialCard";
import { cn } from "@/lib/utils";
import { openGraphBase } from "@/lib/openGraphBase";
import { SCHEMA_IDS } from "@/lib/structuredData";
import { getRecordCounts } from "@/lib/turso/recordCounts";
import {
  ABOUT_ONE_LINER,
  FOUNDED,
  LEGAL_FORM,
  LEGAL_NAME,
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

const TITLE = "About PERM Tracker";
const DESCRIPTION =
  "Who runs PERM Tracker, an immigration attorney who files these cases, since when, where every figure comes from, and what the site is not.";

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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** "2025-11" -> "November 2025", so the page and the schema share one value. */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

const LINK =
  "font-semibold underline decoration-primary decoration-2 underline-offset-[3px] transition-colors hover:text-primary";

/** The public case lookup, as the guide's header picture captured it. */
const CASE_PAGE: WindowShots = {
  light: { src: "/images/content/heroes/guides/check-perm-case-status.webp", width: 1600, height: 1200 },
  dark: { src: "/images/content/heroes/guides/check-perm-case-status.webp", width: 1600, height: 1200 },
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
    alt: "The deadline hub in the PERM Tracker app: each case's next date, sorted into overdue, this week, this month and later",
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
  { href: "/perm-case-status", label: "Case status" },
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

const BUTTON =
  "inline-flex min-h-[48px] items-center gap-2 border border-border px-5 font-heading text-base font-bold transition-transform motion-reduce:transition-none";

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

      {/* The definition beside the person who runs it. */}
      <section className="grid grid-cols-1 items-center gap-12 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
        <div>
          <h1 className="font-heading text-5xl font-bold leading-[1.02] sm:text-6xl">About PERM Tracker</h1>{" "}
          <p className="mt-6 max-w-xl text-xl leading-relaxed">{ABOUT_ONE_LINER}</p>{" "}
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            It&apos;s free on both sides: for the person waiting on a case, and for the attorney who filed it.
          </p>{" "}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/perm-case-status" className={cn(BUTTON, "bg-primary text-black")}>
              Check a case <ArrowRightIcon aria-hidden="true" className="size-4" weight="bold" />
            </Link>{" "}
            <Link href="/for-attorneys" className={cn(BUTTON, "bg-card")}>
              For attorneys
            </Link>
          </div>
        </div>{" "}
        <figure className="relative mx-auto w-full max-w-sm lg:mr-0">
          <div className="relative border border-border bg-card p-3">
            <Image
              src={SABRINA.image}
              alt={`${SABRINA.name}, ${SABRINA.jobTitle.toLowerCase()}`}
              width={SABRINA.imageSize[0]}
              height={SABRINA.imageSize[1]}
              sizes="(min-width: 1024px) 24rem, 90vw"
              className="aspect-[4/5] w-full border border-border object-cover object-top"
              priority
            />{" "}
            <figcaption className="px-1 pb-1 pt-3">
              <span className="block font-heading text-xl font-bold leading-tight">{SABRINA.name}</span>{" "}
              <span className="block text-base text-muted-foreground">{SABRINA.jobTitle}, runs PERM Tracker</span>
            </figcaption>
          </div>
          {/* The site's own date, stamped across the card's edge. */}
          <p className="absolute -left-3 top-6 border border-border bg-foreground px-3 py-2 font-mono text-sm font-bold text-background dark:bg-card dark:text-foreground sm:-left-6">
            Live since {monthLabel(LIVE_SINCE)}
          </p>
        </figure>
      </section>

      {/* Who runs it: the words beside the record that backs them. */}
      <section aria-labelledby="who" className="mt-24 grid grid-cols-1 gap-8 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <div>
          <SectionHead id="who" title="Who runs it" />{" "}
          <p className="mt-5 max-w-2xl text-lg leading-relaxed">
            {SABRINA.name} is an immigration attorney who files these cases. She started PERM Tracker because the
            people she files for had no way to see where a case stood between the filing and the decision, and her
            clients&apos; questions still shape what the site answers first.
          </p>
        </div>{" "}
        <dl className="grid grid-cols-1 gap-px self-start border border-border bg-border">
          <div className="bg-card px-5 py-4">
            <dt className="text-sm text-muted-foreground">Admitted</dt>{" "}
            <dd className="mt-0.5 font-heading text-lg font-bold">
              D.C. Bar, 2025.{" "}
              <a href={DC_BAR_SABRINA_URL} className={LINK} rel="noopener" target="_blank">
                Her bar record
              </a>
            </dd>
          </div>{" "}
          <div className="bg-card px-5 py-4">
            <dt className="text-sm text-muted-foreground">Also on</dt>{" "}
            <dd className="mt-0.5 font-heading text-lg font-bold">
              <a href={LINKEDIN_SABRINA_URL} className={LINK} rel="me noopener" target="_blank">
                LinkedIn
              </a>
            </dd>
          </div>
        </dl>
      </section>

      {/* The two halves, as the pages each one actually gets. */}
      <section aria-labelledby="halves" className="mt-24">
        <SectionHead id="halves" title="Two halves, both free" line="The same federal record, read for two different people." />{" "}
        <div className="mt-10 grid grid-cols-1 gap-16 [&>*]:min-w-0 lg:grid-cols-2 lg:gap-12">
          {HALVES.map((h) => (
            <article key={h.key} className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center border border-border bg-foreground text-primary-on-ink dark:bg-card dark:text-primary-text">
                  <h.Icon aria-hidden="true" className="size-6" weight="bold" />
                </span>{" "}
                <h3 className="font-heading text-2xl font-bold">{h.title}</h3>
              </div>{" "}
              <p className="mt-3 max-w-xl text-base leading-relaxed text-soft">{h.line}</p>{" "}
              <ul className="mt-5 flex flex-wrap gap-3">
                {h.links.map((l) => (
                  <Fragment key={l.href}>
                    <li>
                      <Link href={l.href} className={cn(BUTTON, "min-h-[44px] bg-card px-4 font-sans font-bold")}>
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
        <div className="mt-10 grid grid-cols-1 items-stretch gap-4 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,0.8fr)_auto_minmax(0,1fr)]">
          <ol className="grid grid-cols-1 gap-3">
            {SOURCES.map((s) => (
              <Fragment key={s.agency}>
                <li className="border border-border bg-card p-4">
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
          <div className="grid content-center border border-border bg-foreground p-5 text-background dark:bg-card dark:text-foreground">
            <span className="block font-heading text-xl font-bold text-primary-on-ink dark:text-primary-text">PERM Tracker</span>{" "}
            <span className="mt-2 block text-sm leading-relaxed opacity-80">
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
                    className="flex min-h-[44px] items-center justify-between gap-3 border border-border bg-card px-4 font-bold transition-colors hover:bg-tint"
                  >
                    {pg.label} <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" weight="bold" />
                  </Link>
                </li>{" "}
              </Fragment>
            ))}
          </ul>
        </div>{" "}
        <div className="mt-12 max-w-3xl">
          <RecordStrip record={record} />{" "}
          <p className="mt-4 text-base text-muted-foreground">
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
                  className={`absolute left-0 top-0.5 size-5 border border-border lg:top-0 ${i === MILESTONES.length - 1 ? "bg-primary" : "bg-card"}`}
                />{" "}
                <span className="block font-mono text-sm font-bold">{monthLabel(m.when)}</span>{" "}
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
              <li className="border border-border bg-card p-6">
                <n.Icon aria-hidden="true" className="size-9" weight="bold" />{" "}
                <span className="mt-4 block font-heading text-xl font-bold">{n.title}</span>{" "}
                <span className="mt-2 block text-base leading-relaxed text-soft">{n.line}</span>
              </li>{" "}
            </Fragment>
          ))}
        </ul>
      </section>

      {/* One band for every way to reach it. */}
      <section aria-labelledby="contact" className="mt-24 border border-border bg-foreground p-6 text-background dark:bg-card dark:text-foreground sm:p-12">
        <h2 id="contact" className="font-heading text-3xl font-bold leading-tight sm:text-4xl">
          Write to us
        </h2>{" "}
        <a
          href="mailto:support@permtracker.app"
          className="mt-5 inline-block font-heading text-xl font-bold text-primary-on-ink underline decoration-2 dark:text-primary-text underline-offset-[6px] [overflow-wrap:anywhere] hover:decoration-4 sm:text-3xl lg:text-4xl"
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
                  className="inline-flex min-h-[44px] items-center gap-2 border border-current px-4 font-bold transition-colors hover:bg-background hover:text-foreground dark:hover:bg-foreground dark:hover:text-background"
                >
                  {e.label} <ArrowUpRightIcon aria-hidden="true" className="size-4" weight="bold" />
                </a>
              </li>{" "}
            </Fragment>
          ))}
        </ul>{" "}
        <p className="mt-8 max-w-2xl text-base leading-relaxed opacity-80">
          Operated by {LEGAL_NAME}, {LEGAL_FORM}, the party named in the{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-primary-on-ink dark:hover:text-primary-text">
            terms
          </Link>
          . The domain was registered in {monthLabel(FOUNDED)}.
        </p>
      </section>
    </div>
  );
}
