import Link from "next/link";
import { BellIcon } from "@phosphor-icons/react/ssr";

/**
 * The free case alert, said once on every data page: a lime tab at the right
 * end of the breadcrumb bar, with the one-line pitch beside it where there's
 * room.
 *
 * Oct 8 2026: the data pages answered "how is the queue doing" and never said
 * the site will also watch your own case, which is what most visitors are
 * waiting on. It was a bordered box above each page's heading until Oct 11,
 * when it read as an alert competing with the heading; in the bar it costs the
 * page no height. No motion and no dismiss button (a dismissed offer would
 * have to be hidden after the first paint, and every page here arrives as one
 * picture).
 *
 * The timing claim is the measured one: watched cases are asked about every
 * 5 minutes through the weekday and every half hour otherwise, and a change is
 * emailed at once (see "Oct 7 2026: alerts within minutes" in v2/CLAUDE.md).
 */
export function WatchLink() {
  return (
    <div className="flex shrink-0 items-stretch print:hidden">
      <p className="hidden items-center pr-4 text-sm text-soft xl:flex">
        Waiting on a case? Get a free email within minutes of DOL moving it.
      </p>{" "}
      <Link
        href="/perm-case-status"
        // On a phone, a 44px bell square, the twin of the sections handle on
        // the left; the words come back from `sm`.
        className="flex min-h-11 w-11 items-center justify-center gap-2 border-l border-border bg-primary font-heading text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/85 motion-reduce:transition-none sm:w-auto sm:px-4"
      >
        <BellIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 sm:size-4" />
        <span className="sr-only sm:not-sr-only">Watch my case</span>
      </Link>
    </div>
  );
}

/** Pages that already carry a case lookup or an alert form at the top. */
const QUIET_ON = ["/perm-case-status", "/email-preferences", "/uscis-case-status"];

export function showsWatchBanner(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return !QUIET_ON.some((p) => path === p || path.startsWith(`${p}/`));
}
