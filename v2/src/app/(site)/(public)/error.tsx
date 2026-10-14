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
import { ArrowClockwiseIcon, ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr";
import { claimAutoReload, isReloadCurable, reportCaughtError } from "@/components/error/recovery";

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
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Stale code after a deploy or a request dropped mid-navigation: a fresh
    // load cures it, so do that instead of leaving this screen up (once a
    // minute at most, so a page that fails every load still shows it).
    const reload = isReloadCurable(error) && claimAutoReload();
    reportCaughtError("PublicDataError", error, { autoReloaded: reload });
    if (reload) window.location.reload();
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:py-24">
      <p className="text-sm font-semibold text-muted-foreground">
        Data unavailable
      </p>{" "}
      <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl mt-3">
        This page&rsquo;s figures didn&rsquo;t load
      </h1>{" "}
      <p className="mt-4 text-base leading-relaxed text-soft">
        Something went wrong reading our copy of the federal data. The
        underlying records are published by the agencies below and are
        unaffected.
      </p>{" "}
      <div className="mt-8 flex flex-wrap gap-3">
        {/* A full reload, not React's reset(): reset re-renders the same state
            the page broke on, and a reload fetches everything again. */}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-[44px] items-center gap-2 border border-border bg-primary px-5 py-3 font-heading text-sm font-bold text-primary-foreground transition-colors duration-200"
        >
          <ArrowClockwiseIcon className="size-4" weight="bold" aria-hidden="true" />
          Try again
        </button>{" "}
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center border border-border bg-card px-5 py-3 font-heading text-sm font-bold transition-colors duration-200"
        >
          Home
        </Link>
      </div>{" "}
      <section className="mt-12 border-t border-border pt-6">
        <h2 className="font-heading text-lg font-bold">Go straight to the source</h2>{" "}
        <ul className="mt-4 grid gap-3">
          {PRIMARY_SOURCES.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="link inline-flex min-h-[44px] items-center gap-2"
              >
                {s.label}
                <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
              </a>{" "}
              <span className="block text-sm text-muted-foreground">{s.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
