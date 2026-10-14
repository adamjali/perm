import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BriefcaseIcon,
  BuildingsIcon,
  CalculatorIcon,
  CalendarIcon,
  ClockIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
} from "@phosphor-icons/react/ssr";

import { NotFoundSuggestions } from "@/components/search/NotFoundSuggestions";
import { getAllPosts } from "@/lib/content";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";

/**
 * A 404 must not be indexable. Without this it inherits the site default and
 * serves `index, follow`, which invites Google to index every mistyped URL
 * and to treat links FROM this page as real inbound links — that is how a
 * page ends up "reachable" only from the error page and counted as linked.
 *
 * Most people who land here were looking for a case or a figure, so the page
 * offers the case-number box itself (a plain GET form: it works before any
 * script loads), a "did you mean" read from the address that missed, and
 * the places people most often mean.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

const DOORS = [
  { href: "/", label: "Home", Icon: HouseIcon },
  { href: "/for-attorneys", label: "For attorneys", Icon: BriefcaseIcon },
  { href: "/case-search", label: "Search every filing", Icon: MagnifyingGlassIcon },
  { href: "/perm-processing-times", label: "Processing times", Icon: ClockIcon },
  { href: "/perm-employers", label: "Find an employer", Icon: BuildingsIcon },
  { href: "/visa-bulletin", label: "The visa bulletin", Icon: CalendarIcon },
  { href: "/calculators", label: "Calculators", Icon: CalculatorIcon },
  { href: "/guides", label: "Guides", Icon: NewspaperIcon },
] as const;

export default function NotFound() {
  // Every article by title and address, so a mistyped article link can be
  // matched against them. Read from the content folder when the page is built.
  const articles = getAllPosts().map((p) => ({ title: p.meta.title, href: `/${p.type}/${p.slug}`, kind: p.type }));
  return (
    <main className="relative min-h-screen bg-background">

      <div className="relative mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
        {/* The way home when this page stands alone; under the site's own
            header (a missing employer, firm or article) that header already
            carries the name, so this one steps aside. */}
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center font-heading text-xl font-bold [body:has([data-site-header])_&]:hidden"
        >
          <span className="text-primary-text">PERM</span>&nbsp;Tracker
        </Link>{" "}

        <div className="relative mt-10 overflow-hidden border border-border bg-card p-6 sm:p-10">
          {/* An oversized 404 clipped by the card. */}
          <div
            className="pointer-events-none absolute -right-4 -top-10 select-none font-heading text-[11rem] font-bold leading-none text-foreground/[0.07] sm:text-[15rem]"
            aria-hidden="true"
          >
            404
          </div>
          <div className="relative">
            <p className="inline-block border border-destructive/40 bg-destructive/10 px-3 py-1 text-sm font-bold text-destructive">
              Page not found
            </p>{" "}
            <h1 className="mt-5 font-heading text-5xl font-bold leading-none sm:text-6xl">Dead end</h1>{" "}
            <p className="mt-4 max-w-md text-lg leading-relaxed text-soft">
              This page doesn&apos;t exist or has moved. If you were after a case, put its number in here.
            </p>{" "}
            <CaseLookupForm className="mt-7 max-w-xl" label="Case number" compact source="not-found" help={null} />{" "}
            <NotFoundSuggestions articles={articles} />
          </div>
        </div>{" "}

        <h2 className="mt-12 font-heading text-xl font-bold">Or go to</h2>{" "}
        <ul className="mt-4 grid grid-cols-1 gap-3 [&>*]:min-w-0 sm:grid-cols-2">
          {DOORS.map((d) => (
            <Fragment key={d.href}>
              <li>
                <Link
                  href={d.href}
                  className="flex min-h-[56px] items-center gap-3 border border-border bg-card px-4 font-bold transition-colors hover:bg-tint"
                >
                  <d.Icon aria-hidden="true" className="size-5 shrink-0" weight="bold" />{" "}
                  <span className="flex-1">{d.label}</span>{" "}
                  <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" weight="bold" />
                </Link>
              </li>{" "}
            </Fragment>
          ))}
        </ul>
      </div>
    </main>
  );
}
