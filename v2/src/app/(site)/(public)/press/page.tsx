/**
 * Press: what a reporter can take from this site, how to credit it, and who
 * to write to.
 *
 * Prose only. It names what each page holds and never types a figure: the
 * pages carry the figures with their dates, and a number typed here would be
 * wrong within the week.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { CopyButton } from "@/components/badges/BadgeCatalogue";
import { PRESS_EMAIL } from "@/lib/constants/about";
import { SITE_URL } from "@/lib/constants/site";
import { openGraphBase } from "@/lib/openGraphBase";
import { OPEN_DATA_LICENSE } from "@/lib/openData";
import { pressCreditHtml } from "@/lib/pressCredit";
import { withSocialCard } from "@/lib/socialCard";

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

// Prose only, no data reads: prerendered once per deploy.
export const dynamic = "force-static";

const link =
  "font-semibold text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary";

/** What a reporter can ask this site, each with the page that answers it. */
const ANSWERS: { q: string; href: string; page: string }[] = [
  { q: "Which employers' PERM cases DOL has put on hold, and the day it moved them", href: "/perm-employers/under-review", page: "Employers under review" },
  { q: "How many PERM cases DOL decides each day, and how that compares with its usual pace", href: "/perm-decision-activity", page: "Decision activity" },
  { q: "How long DOL takes, and which filing month it is working on", href: "/perm-processing-times", page: "Processing times" },
  { q: "Any employer's PERM, H-1B and wage-request record", href: "/perm-employers", page: "Employers" },
  { q: "Any law firm's PERM record", href: "/perm-attorneys", page: "Law firms" },
  { q: "The busiest H-1B employers by year and state", href: "/h1b-employers", page: "H-1B employers" },
  { q: "Every visa bulletin cutoff back to 2005", href: "/visa-bulletin", page: "Visa bulletin" },
  { q: "DOL's live status for one case number", href: "/perm-case-status", page: "Case lookup" },
];

export default function PressPage() {
  const credit = pressCreditHtml(SITE_URL);
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{TITLE}</h1>{" "}
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-foreground/90 sm:text-xl">
        PERM Tracker reads the Department of Labor&apos;s case records every day. Quote any figure on the site with
        credit and a link; the files under{" "}
        <Link href="/open-data" className={link}>
          Open data
        </Link>{" "}
        are free to reuse under {OPEN_DATA_LICENSE.short}.
      </p>{" "}

      <section aria-labelledby="press-answers" className="mt-12">
        <h2 id="press-answers" className="font-heading text-2xl font-black">
          What the record can tell you
        </h2>{" "}
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          {ANSWERS.map((a) => (
            <li key={a.href} className="border-2 border-border bg-card p-4 shadow-hard-sm">
              <p className="text-base leading-relaxed text-foreground/85">{a.q}</p>{" "}
              <Link href={a.href} className={`mt-2 inline-flex min-h-[44px] items-center ${link}`}>
                {a.page}
              </Link>{" "}
            </li>
          ))}
        </ul>
      </section>{" "}

      <section aria-labelledby="press-credit" className="mt-12 border-3 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 id="press-credit" className="font-heading text-2xl font-black">
          How to credit it
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80">
          Name PERM Tracker and link to the page you took the figure from. Every data page has a &ldquo;Cite this
          page&rdquo; line under its sources with the date the data runs to. On a web page, with that page&apos;s address in
          the link:
        </p>{" "}
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <code className="block min-w-0 flex-1 break-all border-2 border-border bg-muted px-4 py-3 font-mono text-sm">
            {credit}
          </code>{" "}
          <CopyButton text={credit} />
        </div>
      </section>{" "}

      <section aria-labelledby="press-method" className="mt-12">
        <h2 id="press-method" className="font-heading text-2xl font-black">
          Where the figures come from
        </h2>{" "}
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/85">
          Every figure is read from a federal source: DOL&apos;s case-status service and disclosure files, the State
          Department&apos;s visa bulletins and USCIS&apos;s published data. Each page names its sources and the date
          they run to.{" "}
          <Link href="/methodology" className={link}>
            Methodology
          </Link>{" "}
          explains how each figure is built, and{" "}
          <Link href="/about" className={link}>
            About
          </Link>{" "}
          says who runs the site.
        </p>
      </section>{" "}

      <section aria-labelledby="press-contact" className="mt-12">
        <h2 id="press-contact" className="font-heading text-2xl font-black">
          Write to us
        </h2>{" "}
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/85">
          For a figure we haven&apos;t published, a check on one we have, or how a number is built:{" "}
          <a href={`mailto:${PRESS_EMAIL}`} className={link}>
            {PRESS_EMAIL}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
