/**
 * How the site writes and checks what it publishes: where every figure comes
 * from, who writes it, what's checked before a page goes live, how a mistake is
 * corrected, and what the site never takes money for. The byline on every
 * article links here, and the Organization markup names it as the site's
 * publishing principles.
 *
 * EVERY SENTENCE HERE IS A CLAIM ABOUT HOW THE SITE WORKS, so each one points
 * at something in the code or the record: the live figures at the test that
 * fails on a typed one, the corrections at the log, the pictures at the
 * capture scripts. Nothing says a person reviewed something they didn't.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import {
  ArrowsClockwiseIcon,
  BuildingsIcon,
  CheckSquareOffsetIcon,
  HandshakeIcon,
  PencilLineIcon,
} from "@phosphor-icons/react/ssr";

import { SourcePages } from "@/components/about/SourcePages";
import { LEGAL_NAME, NOT_LEGAL_SERVICES, SABRINA } from "@/lib/constants/about";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

export const dynamic = "force-static";

const TITLE = "Editorial Standards";
const DESCRIPTION =
  "Where every figure on PERM Tracker comes from, who writes the guides, what's checked before a page goes live, and how mistakes are corrected in the open.";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/editorial-standards" },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/editorial-standards" },
  },
  "editorial-standards",
);

/** The standards, one short claim each, with the record behind it. */
const STANDARDS = [
  {
    id: "sources",
    icon: BuildingsIcon,
    title: "Every figure comes from a government record",
    body: (
      <>
        The Department of Labor&apos;s case-status service, read every night; its quarterly disclosure files for decided
        cases and their wages; its published processing times; the State Department&apos;s visa bulletins; and
        USCIS&apos;s reports. Regulations are quoted as the eCFR prints them. Each figure carries the date it covers, and
        the{" "}
        <Link href="/methodology" className="link">
          methodology
        </Link>{" "}
        says how each is counted.
      </>
    ),
  },
  {
    id: "live",
    icon: ArrowsClockwiseIcon,
    title: "Figures in guides are read live",
    body: (
      <>
        A guide that quotes DOL&apos;s average wait or the month it&apos;s working reads the figure from the record when
        the page is built, with DOL&apos;s date beside it. A test stops a typed figure from going live, because a typed
        number is right on the day it&apos;s written and wrong a week later.
      </>
    ),
  },
  {
    id: "who",
    icon: PencilLineIcon,
    title: "Who writes it",
    body: (
      <>
        The PERM Tracker team writes the guides and builds the data pages. {LEGAL_NAME} runs the site, and the person
        named on it is {SABRINA.name}, an {SABRINA.jobTitle.toLowerCase()} (
        <Link href="/about" className="link">
          about
        </Link>
        ). Guides written for attorneys cite the regulations in the form attorneys use, at her direction.
      </>
    ),
  },
  {
    id: "checked",
    icon: CheckSquareOffsetIcon,
    title: "What's checked, and when",
    body: (
      <>
        Each date is checked against its source before it&apos;s published. Each picture of a page or form is captured
        from the real thing and credited. Every morning the live pages are checked as a browser renders them, for
        headings, links and accessibility (WCAG 2.1 AA). Each page shows the day it last changed.
      </>
    ),
  },
  {
    id: "corrections",
    icon: HandshakeIcon,
    title: "Mistakes are corrected in the open",
    body: (
      <>
        Every correction is dated in the{" "}
        <Link href="/changelog/corrections" className="link">
          corrections log
        </Link>
        , with what the page said, what was true and what changed. Spotted something wrong? Tell us through the{" "}
        <Link href="/contact" className="link">
          contact page
        </Link>
        .
      </>
    ),
  },
] as const;

export default function EditorialStandardsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-10 sm:px-6 sm:pt-12">
      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">How we write and check every page</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-soft">
          Every figure here comes from a government record, carries its date, and is corrected in the open when it&apos;s
          wrong.
        </p>
      </header>{" "}

      <div className="mt-10">
        <SourcePages />
      </div>{" "}

      <ol className="mt-12 grid grid-cols-1 gap-6 [&>*]:min-w-0">
        {STANDARDS.map((s) => (
          <Fragment key={s.id}>
            {" "}
            <li id={s.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 border-t-2 border-border pt-6">
              <span aria-hidden="true" className="flex size-11 items-center justify-center border-2 border-border bg-tint">
                <s.icon className="size-6" />
              </span>{" "}
              <div>
                <h2 className="font-heading text-xl font-bold">{s.title}</h2>{" "}
                <p className="mt-2 text-base leading-relaxed text-soft">{s.body}</p>
              </div>
            </li>
          </Fragment>
        ))}
      </ol>{" "}

      <section aria-labelledby="independence" className="mt-12 border-2 border-border bg-tint p-6 sm:p-8">
        <h2 id="independence" className="font-heading text-2xl font-bold">
          What we never take money for
        </h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-soft">
          No paid placement, no sponsored posts, no affiliate links and no advertising. No employer, law firm or rival
          pays to be shown, ranked or left out.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-soft">{NOT_LEGAL_SERVICES}</p>
      </section>
    </div>
  );
}
