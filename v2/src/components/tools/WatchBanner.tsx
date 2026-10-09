import Link from "next/link";
import { BellIcon } from "@phosphor-icons/react/ssr";

/**
 * One quiet line above every data page: the free case alert, said once.
 *
 * Oct 8 2026: the data pages answered "how is the queue doing" and never said
 * the site will also watch your own case, which is what most visitors are
 * waiting on. A competitor carries the same offer as a top line and sells it;
 * ours is free, so it says so. It is a single bordered line with one link, no
 * motion and no dismiss button (a dismissed banner would have to be hidden
 * after the first paint, and every page here arrives as one picture).
 *
 * The timing claim is the measured one: watched cases are asked about every
 * 5 minutes through the weekday and every half hour otherwise, and a change is
 * emailed at once (see "Oct 7 2026: alerts within minutes" in v2/CLAUDE.md).
 */
export function WatchBanner() {
  return (
    <aside
      aria-label="Free case alerts"
      className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-2 border-border bg-primary/10 px-4 py-2 text-base print:hidden"
    >
      <BellIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />{" "}
      <span className="min-w-0 flex-1">
        Waiting on a case? <strong>Get a free email within minutes of DOL moving it.</strong>
      </span>{" "}
      <Link
        href="/perm-case-status"
        className="inline-flex min-h-[44px] items-center font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
      >
        Watch my case
      </Link>
    </aside>
  );
}

/** Pages that already carry a case lookup or an alert form at the top. */
const QUIET_ON = ["/perm-case-status", "/email-preferences", "/uscis-case-status"];

export function showsWatchBanner(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return !QUIET_ON.some((p) => path === p || path.startsWith(`${p}/`));
}
