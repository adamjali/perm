"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * A `next/link` that confirms the click while a slow navigation resolves.
 *
 * WHY THIS EXISTS AND NOT `loading.tsx`. The entity routes (employer, attorney,
 * wage, queue-month) deliberately have no loading boundary: one would make Next
 * stream a 200 before the page's own `notFound()` could run, turning a junk
 * slug into a soft 404 (see the not-found tests). Next only prefetches a
 * dynamic route that HAS a `loading.tsx`, so these are also un-prefetched: a
 * click is a cold server round-trip with, until now, no feedback at all — the
 * "clicking a lot of the links does nothing / takes forever" report.
 *
 * `useLinkStatus` is Next 16's answer for exactly this shape — a pending signal
 * that needs no boundary and so cannot reintroduce the soft 404. It must be
 * read in a DESCENDANT of the `<Link>`, which is why the dot is its own
 * component.
 *
 * THE DOT NEVER MOVES THE LAYOUT AND NEVER PULSES. It is always in the DOM at a
 * fixed size, so its appearance shifts nothing, and it is the lime queue accent
 * the rest of the site uses. It reveals only after 150ms of pending, so a fast
 * navigation (a prefetched or warm route) never flashes it — the delay is on
 * the show transition only, so it hides instantly when navigation completes.
 * A single opacity transition, not an animation: the project bans pulsing.
 */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-pending={pending || undefined}
      className={cn(
        "ml-1.5 inline-block size-2 shrink-0 translate-y-px bg-primary align-baseline",
        "opacity-0 transition-opacity duration-150",
        "data-[pending]:opacity-100 data-[pending]:[transition-delay:150ms]",
      )}
    />
  );
}

export function PendingLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <PendingDot />
    </Link>
  );
}
