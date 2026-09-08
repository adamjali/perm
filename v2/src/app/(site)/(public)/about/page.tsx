/**
 * The About page.
 *
 * WHY THIS PAGE EXISTS (measured 2026-09-07). For the query "perm tracker",
 * Search Console showed the homepage at 410 to 849 impressions a day through
 * Aug 26 and under 30 a day from Aug 27, after a rewrite removed the product's
 * self-description; Google moved the query to /faq and /terms, the two pages
 * that still said the name most often. Google's site-names doc lists an About
 * page's contents (a named publisher, a founding date, "web references to the
 * site") among what it corroborates a name against, and this site had no such
 * page: /about answered 404 while every named competitor had one.
 *
 * Every fact here is read from `src/lib/constants/about.ts`, the same module
 * the homepage block and the Organization schema read, so the three surfaces
 * cannot drift apart. Nothing on this page is a claim the site owner has not
 * approved in writing.
 */

import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import Image from "next/image";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { SCHEMA_IDS } from "@/lib/structuredData";
import {
  ABOUT_ONE_LINER,
  FOUNDED,
  LIVE_SINCE,
  SABRINA,
} from "@/lib/constants/about";
import {
  LINKEDIN_SABRINA_URL,
  MEDIUM_PROFILE_URL,
  PRODUCT_HUNT_URL,
  X_PROFILE_URL,
} from "@/lib/constants/externalLinks";

const TITLE = "About PERM Tracker";
const DESCRIPTION =
  "Who runs PERM Tracker, an immigration attorney who files these cases, since when, where every figure comes from, and what the site is not.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/about",
  },
}, "about");

// Prose only, no data reads: prerendered once per deploy.
export const dynamic = "force-static";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** "2025-11" -> "November 2025", so the page and the schema share one value. */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

const link =
  "font-semibold text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary";
const h2 = "mt-12 font-heading text-xl font-bold tracking-tight sm:text-2xl";
const p = "mt-4 text-base leading-relaxed text-foreground/90";

export default function AboutPage() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";
  const breadcrumb = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
  ]);
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
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <JsonLdScript schema={breadcrumb} />
      <JsonLdScript schema={aboutSchema} />

      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">
        About
      </p>{" "}
      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
        About PERM Tracker
      </h1>{" "}
      <p className="mt-5 text-lg leading-relaxed text-foreground/90 sm:text-xl">
        {ABOUT_ONE_LINER} It&apos;s not a law firm, it isn&apos;t affiliated with
        the Department of Labor, and nothing on it is legal advice.
      </p>{" "}

      <figure className="mt-10 overflow-x-auto overscroll-x-none border-2 border-border bg-card p-4 shadow-hard sm:p-6">
        <svg viewBox="0 0 760 300" className="w-full min-w-[640px] text-foreground" role="img" aria-labelledby="data-flow-title">
          <title id="data-flow-title">How the site works: DOL&apos;s case index is asked every night and on every lookup, DOL&apos;s disclosure files are read each quarter, USCIS and the State Department each month; all of it lands in the pages: case status, processing times, wages and deadlines.</title>
          <text x="20" y="28" fontSize="13" fontWeight="700" fill="currentColor" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">FEDERAL SOURCES</text>
          <rect x="20" y="44" width="200" height="56" fill="var(--primary)" stroke="currentColor" strokeWidth="3" />
          <text x="32" y="68" fontSize="14" fontWeight="700" fill="#000000">DOL case-status index</text>
          <text x="32" y="88" fontSize="13" fill="#000000">every case, pending included</text>
          <rect x="20" y="118" width="200" height="56" fill="none" stroke="currentColor" strokeWidth="3" />
          <text x="32" y="142" fontSize="14" fontWeight="700" fill="currentColor">DOL disclosure files</text>
          <text x="32" y="162" fontSize="13" fill="currentColor">decided cases and the wage</text>
          <rect x="20" y="192" width="200" height="56" fill="none" stroke="currentColor" strokeWidth="3" />
          <text x="32" y="216" fontSize="14" fontWeight="700" fill="currentColor">USCIS and State Dept</text>
          <text x="32" y="236" fontSize="13" fill="currentColor">I-140, I-485, the visa bulletin</text>
          <line x1="220" y1="72" x2="300" y2="140" stroke="currentColor" strokeWidth="3" />
          <line x1="220" y1="146" x2="300" y2="146" stroke="currentColor" strokeWidth="3" />
          <line x1="220" y1="220" x2="300" y2="152" stroke="currentColor" strokeWidth="3" />
          <text x="300" y="28" fontSize="13" fontWeight="700" fill="currentColor" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">READ BY US</text>
          <rect x="300" y="100" width="180" height="92" fill="var(--card)" stroke="currentColor" strokeWidth="3" />
          <text x="314" y="126" fontSize="14" fontWeight="700" fill="currentColor">Nightly sweep</text>
          <text x="314" y="146" fontSize="13" fill="currentColor">plus a live ask on every</text>
          <text x="314" y="164" fontSize="13" fill="currentColor">case lookup, and monthly</text>
          <text x="314" y="182" fontSize="13" fill="currentColor">and quarterly loads</text>
          <line x1="480" y1="146" x2="540" y2="146" stroke="currentColor" strokeWidth="3" />
          <polygon points="540,138 556,146 540,154" fill="currentColor" />
          <text x="560" y="28" fontSize="13" fontWeight="700" fill="currentColor" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">WHAT YOU READ</text>
          <rect x="560" y="44" width="180" height="40" fill="var(--primary)" stroke="currentColor" strokeWidth="3" />
          <text x="572" y="69" fontSize="14" fontWeight="700" fill="#000000">Case status</text>
          <rect x="560" y="96" width="180" height="40" fill="none" stroke="currentColor" strokeWidth="3" />
          <text x="572" y="121" fontSize="14" fontWeight="700" fill="currentColor">Processing times</text>
          <rect x="560" y="148" width="180" height="40" fill="none" stroke="currentColor" strokeWidth="3" />
          <text x="572" y="173" fontSize="14" fontWeight="700" fill="currentColor">Wages and employers</text>
          <rect x="560" y="200" width="180" height="40" fill="none" stroke="currentColor" strokeWidth="3" />
          <text x="572" y="225" fontSize="14" fontWeight="700" fill="currentColor">Your deadlines</text>
          <text x="20" y="284" fontSize="13" fill="currentColor">Every figure carries its source and the date it was measured. Nothing is modeled or crowd-sourced.</text>
        </svg>
      </figure>

      <h2 className={h2}>What it does</h2>{" "}
      <p className={p}>
        <Link href="/perm-case-status" className={link}>Look up a case number</Link>{" "}
        and see its federal record and how far DOL&apos;s queue has reached.{" "}
        <Link href="/case-search" className={link}>Search an employer, law firm, state or occupation</Link>{" "}
        across PERM, prevailing wage and H-1B filings. Read the{" "}
        <Link href="/perm-processing-times" className={link}>processing-time</Link>,{" "}
        <Link href="/perm-wages" className={link}>wage</Link> and{" "}
        <Link href="/perm-decision-activity" className={link}>decision</Link> data DOL
        publishes, each figure with the window it was measured over. If you file
        cases,{" "}
        <Link href="/for-attorneys" className={link}>track every deadline across a caseload</Link>{" "}
        with reminders.
      </p>{" "}

      <h2 className={h2}>Who&apos;s behind it</h2>{" "}
      <div className="mt-5 max-w-sm border-2 border-border bg-card p-4 shadow-hard">
        <div className="flex items-center gap-4">
          {/* Her portrait, cropped to the card by object-fit rather than by a
              second file, with the source's real 640x800 declared so the box
              is reserved at the right aspect before the bytes arrive. */}
          <Image
            src={SABRINA.image}
            alt={`${SABRINA.name}, ${SABRINA.jobTitle.toLowerCase()}`}
            width={SABRINA.imageSize[0]}
            height={SABRINA.imageSize[1]}
            sizes="96px"
            className="h-24 w-[4.8rem] shrink-0 border-2 border-border object-cover object-top"
          />{" "}
          <div>
            <p className="font-heading text-base font-bold leading-tight">{SABRINA.name}</p>{" "}
            <p className="text-sm text-muted-foreground">{SABRINA.jobTitle}</p>
          </div>
        </div>
      </div>{" "}
      <p className={p}>
        <strong className="font-semibold">{SABRINA.name}</strong> runs PERM Tracker.
        She&apos;s an immigration attorney who files these cases, and she started
        it because the people she files for had no way to see where a case stood
        between the filing and the decision. She still files them, and her
        clients&apos; questions shape what the site answers first.
      </p>{" "}
      <p className={p}>
        She brings both sides of a filing to the site: the attorney&apos;s, which
        deadlines matter and what an audit actually asks for, and her
        clients&apos;, what it&apos;s like to wait on a case with nothing to check.
        She&apos;s also the voice of the product&apos;s email.
      </p>{" "}
      <p className={p}>
        Both sides of a filing have a say in what the site does: the people
        waiting on a case and the attorneys who file for them.
      </p>{" "}

      <h2 className={h2}>Since when</h2>{" "}
      <p className={p}>
        The domain was registered in {monthLabel(FOUNDED)} and the site went live
        in {monthLabel(LIVE_SINCE)}. It reads DOL&apos;s quarterly disclosure files
        and asks DOL&apos;s own case-status system every day.
      </p>{" "}

      <h2 className={h2}>Where the data comes from</h2>{" "}
      <p className={p}>
        Every figure comes from a named federal source: DOL&apos;s FLAG system and
        disclosure files, USCIS&apos;s published counts, and the State
        Department&apos;s visa bulletin. Nothing is modeled or crowd-sourced.{" "}
        <Link href="/methodology" className={link}>The methodology page</Link>{" "}
        traces every number.
      </p>{" "}

      <h2 className={h2}>What it isn&apos;t</h2>{" "}
      <p className={p}>
        PERM Tracker doesn&apos;t give legal advice, doesn&apos;t file anything for
        you, and can&apos;t see inside DOL beyond what DOL publishes. A pending case
        shows the status DOL reports and nothing more. Your attorney has the file;
        this site tells you where the queue is.
      </p>{" "}

      <h2 className={h2}>Contact</h2>{" "}
      <p className={p}>
        <a href="mailto:support@permtracker.app" className={link}>support@permtracker.app</a>.
        PERM Tracker is also on{" "}
        <a href={X_PROFILE_URL} className={link} rel="me noopener" target="_blank">X</a>,{" "}
        <a href={MEDIUM_PROFILE_URL} className={link} rel="me noopener" target="_blank">Medium</a>{" "}
        and{" "}
        <a href={PRODUCT_HUNT_URL} className={link} rel="me noopener" target="_blank">Product Hunt</a>,
        and {SABRINA.name} is on{" "}
        <a href={LINKEDIN_SABRINA_URL} className={link} rel="me noopener" target="_blank">LinkedIn</a>.
      </p>
    </div>
  );
}
