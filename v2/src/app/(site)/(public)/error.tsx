"use client";

/**
 * Error boundary for the public data pages.
 *
 * WHY THIS FILE EXISTS. Every authenticated route had a boundary and the
 * public tree had none, so a failure on /perm-cases or /perm-employers fell
 * all the way to `global-error.tsx` - which replaces the whole document,
 * taking the header, the nav and every route out with it. That is the
 * harshest fallback in the app, and it was covering the pages MOST likely to
 * fail: these read an external database (Turso) on every regeneration, and
 * `src/lib/turso/client.ts` throws rather than degrading, deliberately, so an
 * outage is loud instead of rendering an empty page that looks like real data.
 * Loud is right; losing the entire site's chrome is not.
 *
 * WHAT IT DOES DIFFERENTLY FROM THE AUTHENTICATED ONES. Those offer a retry
 * and a route home, which is all you can do when a user's own data will not
 * load. Here the failure is almost always our copy of a PUBLIC dataset being
 * unreachable - and the dataset itself is still up, at the agency that
 * publishes it. So this sends people to the primary source. We are a
 * convenience layer over government data; when the convenience breaks, the
 * honest thing is to point at the thing itself rather than to apologise and
 * offer a button that reloads the same broken query.
 */

import Link from "next/link";
import { useEffect } from "react";
import { ArrowClockwise, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";

/** Where each dataset actually comes from, for the outage case. */
const PRIMARY_SOURCES = [
  {
    href: "https://flag.dol.gov/processingtimes",
    label: "DOL processing times",
    note: "Where the analyst-review queue is published",
  },
  {
    href: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
    label: "DOL disclosure files",
    note: "The quarterly case records every figure here is built from",
  },
  {
    href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
    label: "State Department visa bulletin",
    note: "The current priority-date cutoffs",
  },
];

export default function PublicDataError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Dynamic import: Sentry is lazy-loaded and may not be initialised on a
    // public page, so a static import would throw inside the error handler.
    import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.captureException(error, {
          tags: {
            component: "PublicDataError",
            ...(error.digest && { digest: error.digest }),
          },
        });
      })
      .catch(() => {
        // Reporting the failure must never become a second failure.
      });
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:py-24">
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Data unavailable
      </p>{" "}
      <h1 className="mt-3 font-heading text-3xl font-black sm:text-4xl">
        This page&rsquo;s figures didn&rsquo;t load
      </h1>{" "}
      <p className="mt-4 text-base leading-relaxed text-foreground/80">
        Something went wrong reading our copy of the federal data. The
        underlying records are published by the agencies below and are
        unaffected.
      </p>{" "}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[44px] items-center gap-2 border-3 border-border bg-primary px-5 py-3 font-heading text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-hard transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg"
        >
          <ArrowClockwise className="size-4" weight="bold" aria-hidden="true" />
          Try again
        </button>{" "}
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center border-3 border-border bg-card px-5 py-3 font-heading text-sm font-bold uppercase tracking-wider shadow-hard transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg"
        >
          Home
        </Link>
      </div>{" "}
      <section className="mt-12 border-t-2 border-border pt-6">
        <h2 className="font-heading text-lg font-bold">Go straight to the source</h2>{" "}
        <ul className="mt-4 grid gap-3">
          {PRIMARY_SOURCES.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                {s.label}
                <ArrowSquareOut className="size-4" aria-hidden="true" />
              </a>{" "}
              <span className="block text-sm text-muted-foreground">{s.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
