/**
 * Press: what a reporter can take from this site, shown rather than listed.
 *
 * The opening is the record itself, today's PERM holds by employer, read from
 * the same document as /perm-employers/under-review, so a reporter sees the
 * kind of figure on offer before reading a word about it. The topics are the
 * pages' own social cards, which are screenshots of the pages. No figure is
 * typed: the live one carries its date, the rest live on their pages.
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BuildingsIcon, EnvelopeSimpleIcon, FileCsvIcon, GlobeHemisphereWestIcon, IdentificationCardIcon } from "@phosphor-icons/react/ssr";

import { CopyButton } from "@/components/badges/BadgeCatalogue";
import { BarRows, type BarRow } from "@/components/data/BarRows";
import { PRESS_EMAIL } from "@/lib/constants/about";
import { SITE_URL } from "@/lib/constants/site";
import { HOLD_STATUS, heldRanking, longDate } from "@/lib/employerStages";
import { formatInt, formatShare } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { PAGE_CARD_ALT, pageCardUrl, type PageCardSlug } from "@/lib/pageCards";
import { pressCreditHtml } from "@/lib/pressCredit";
import { withSocialCard } from "@/lib/socialCard";
import { getEmployerStages } from "@/lib/db/employerStages";
import { buttonVariants } from "@/components/ui/button";

const TITLE = "Press and Data for Journalists";
const DESCRIPTION =
  "What PERM Tracker can tell a reporter from DOL's records, how to credit it, and who to write to. Free to quote with credit and a link.";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/press" },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/press" },
  },
  "press",
);

// The same window as the holds page the opening figure comes from.
export const revalidate = 21600;

/** The pages a reporter is most likely to quote, each shown by its own card. */
const TOPICS: { slug: PageCardSlug; href: string; name: string; line: string }[] = [
  { slug: "perm-employers-under-review", href: "/perm-employers/under-review", name: "Holds by employer", line: "Whose cases DOL put on hold, and the day it did" },
  { slug: "perm-decision-activity", href: "/perm-decision-activity", name: "Decisions per day", line: "DOL's pace, day by day, back to 2015" },
  { slug: "perm-processing-times", href: "/perm-processing-times", name: "The PERM queue", line: "Which month DOL is working, and how fast" },
  { slug: "perm-employers", href: "/perm-employers", name: "Any employer's record", line: "PERM, H-1B and wage requests in one place" },
  { slug: "h1b-employers", href: "/h1b-employers", name: "Top H-1B employers", line: "By fiscal year and by state" },
  { slug: "visa-bulletin", href: "/visa-bulletin", name: "Visa bulletin history", line: "Every cutoff back to 2005" },
];

const SOURCES = [
  { icon: BuildingsIcon, name: "Department of Labor", what: "Case status for every pending case, and the quarterly disclosure files" },
  { icon: GlobeHemisphereWestIcon, name: "State Department", what: "Every monthly visa bulletin" },
  { icon: IdentificationCardIcon, name: "USCIS", what: "Quarterly processing and inventory data" },
];

const link = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export default async function PressPage() {
  const doc = await getEmployerStages().catch(() => null);
  const held = doc ? heldRanking(doc.employers, 5, 5) : [];
  const onHold = doc ? doc.nationwide[HOLD_STATUS] ?? 0 : 0;
  const rows: BarRow[] = held.map((r) => ({
    key: r.slug ?? r.name,
    label: r.name,
    value: r.byStatus[HOLD_STATUS] ?? 0,
    text: formatInt(r.byStatus[HOLD_STATUS] ?? 0),
    tone: "ink",
  }));
  const credit = pressCreditHtml(SITE_URL);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <div>
          <h1 className="font-heading text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Data for journalists
          </h1>{" "}
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-soft sm:text-xl">
            The Department of Labor&apos;s own case records, read every day. Quote any figure with credit and a link.
          </p>{" "}
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`mailto:${PRESS_EMAIL}`}
              className={buttonVariants({ variant: "default", size: "lg" })}
            >
              <EnvelopeSimpleIcon size={20} weight="bold" aria-hidden="true" />
              {PRESS_EMAIL}
            </a>{" "}
            <Link
              href="/open-data"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <FileCsvIcon size={20} weight="bold" aria-hidden="true" />
              Download the data
            </Link>
          </div>
        </div>{" "}

        {doc && rows.length > 0 ? (
          <figure className="bg-tint p-5 sm:p-6 border-3 shadow-hard border-border">
            <p className="text-sm font-bold text-muted-foreground">
              Today&apos;s record, {longDate(doc.asOf)}
            </p>{" "}
            <p className="mt-2 font-heading text-3xl font-bold tabular-nums sm:text-4xl">
              {formatInt(onHold)} PERM cases on hold
            </p>{" "}
            <p className="mt-1 text-base text-soft">
              {formatShare(doc.pendingTotal ? onHold / doc.pendingTotal : 0)} of the {formatInt(doc.pendingTotal)} DOL has pending. The biggest:
            </p>{" "}
            <BarRows rows={rows} label="PERM cases on hold, by employer" className="mt-5" />
            <figcaption className="mt-5 text-base">
              <Link href="/perm-employers/under-review" className={link}>
                Every employer, and the day DOL moved it
              </Link>
            </figcaption>
          </figure>
        ) : null}
      </div>{" "}

      <section aria-labelledby="press-topics" className="mt-20">
        <h2 id="press-topics" className="font-heading text-2xl font-bold sm:text-3xl">
          What you can report on
        </h2>{" "}
        <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {TOPICS.map((t) => (
            <li key={t.slug}>
              <Link
                href={t.href}
                className="group block h-full border-input bg-card transition-transform motion-reduce:transition-none motion-safe:hover:-translate-y-0.5 border"
              >
                <Image
                  src={pageCardUrl(t.slug)}
                  alt={PAGE_CARD_ALT[t.slug]}
                  width={1200}
                  height={630}
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                  className="block h-auto w-full border-b-2 border-border"
                />{" "}
                <span className="block p-4">
                  <span className="block font-heading text-lg font-bold group-hover:underline group-hover:decoration-primary group-hover:decoration-2 group-hover:underline-offset-4">
                    {t.name}
                  </span>{" "}
                  <span className="mt-1 block text-base text-soft">{t.line}</span>
                </span>
              </Link>{" "}
            </li>
          ))}
        </ul>
      </section>{" "}

      <section aria-labelledby="press-credit" className="mt-20 grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] [&>*]:min-w-0">
        <div>
          <h2 id="press-credit" className="font-heading text-2xl font-bold sm:text-3xl">
            Credit it like this
          </h2>{" "}
          <p className="mt-3 max-w-md text-lg leading-relaxed text-soft">
            Name PERM Tracker and link the page the figure came from. Every data page has a &ldquo;Cite this page&rdquo;
            line under its sources.
          </p>{" "}
          <div className="mt-5 flex flex-wrap items-start gap-3">
            <code className="block min-w-0 flex-1 whitespace-pre-wrap break-words bg-tint px-3 py-2 font-mono text-sm border-2 border-border">
              {credit}
            </code>{" "}
            <CopyButton text={credit} />
          </div>
        </div>{" "}
        {/* A specimen of the credit in running text: what it looks like in a story. */}
        <div aria-hidden="true" className="bg-tint p-6 sm:p-8 border-3 shadow-hard border-border">
          <div className="h-3 w-24 bg-foreground/80" />
          <div className="mt-4 h-5 w-11/12 bg-foreground" />
          <div className="mt-2 h-5 w-3/4 bg-foreground" />
          <div className="mt-6 space-y-2.5">
            <div className="h-2.5 w-full bg-foreground/15" />
            <div className="h-2.5 w-full bg-foreground/15" />
            <div className="h-2.5 w-5/6 bg-foreground/15" />
          </div>
          <p className="mt-5 font-serif text-lg leading-relaxed text-soft">
            {/* Today's figure, so the specimen shows a real cited line. */}
            {doc && onHold > 0 ? (
              <>
                &hellip; the Labor Department had {formatInt(onHold)} PERM cases on hold on {longDate(doc.asOf)}, according to{" "}
              </>
            ) : (
              <>&hellip; were on hold this week, according to{" "}</>
            )}
            <span className="underline decoration-primary decoration-[3px] underline-offset-4">PERM Tracker</span>, which
            reads the Labor Department&apos;s case records daily.
          </p>
          <div className="mt-5 space-y-2.5">
            <div className="h-2.5 w-full bg-foreground/15" />
            <div className="h-2.5 w-2/3 bg-foreground/15" />
          </div>
        </div>
      </section>{" "}

      <section aria-labelledby="press-sources" className="mt-20">
        <h2 id="press-sources" className="font-heading text-2xl font-bold sm:text-3xl">
          Federal records only
        </h2>{" "}
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
          {SOURCES.map((s) => (
            <li key={s.name} className="flex items-start gap-4 border-border p-5 border-2 shadow-hard-sm bg-card">
              <s.icon size={26} className="shrink-0 text-primary-text" aria-hidden="true" />{" "}
              <span>
                <span className="block font-heading text-lg font-bold">{s.name}</span>{" "}
                <span className="mt-1 block text-base text-soft">{s.what}</span>
              </span>{" "}
            </li>
          ))}
        </ul>{" "}
        <p className="mt-5 text-base">
          <Link href="/methodology" className={link}>
            How each figure is built
          </Link>
          <span aria-hidden="true" className="mx-3 text-muted-foreground">
            {" / "}
          </span>
          <Link href="/about" className={link}>
            Who runs the site
          </Link>
        </p>
      </section>
    </div>
  );
}
