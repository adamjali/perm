"use client";

/**
 * The dashboard's shared parts: a section with its heading, one row per case,
 * and an empty state. Every list on the dashboard draws its rows the same
 * way: the case on the left, the figure that matters on the right.
 */

import { type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** A dashboard section: a plain box with a heading row. */
export const WIDGET_CONTAINER_CLASSES = "border border-border bg-card";

export function WidgetHeader({
  id,
  title,
  count,
  action,
}: {
  /** The heading's id, for the section's aria-labelledby. */
  id?: string;
  title: string;
  /** How many the section holds, said beside the heading. */
  count?: number;
  /** A link on the right: "Calendar", "All cases". */
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border px-5 py-4">
      <h2 id={id} className="font-heading text-lg font-bold">
        {title}
        {count !== undefined ? (
          <span className="ml-2 font-sans text-base font-normal text-muted-foreground">{count}</span>
        ) : null}
      </h2>
      {action ?? null}
    </div>
  );
}

/** The heading row's link. */
export function WidgetLink({ href, children }: { href: string; children: ReactNode }): ReactNode {
  return (
    <Link href={href} className="link text-sm">
      {children}
    </Link>
  );
}

/**
 * One case in a dashboard list. The whole row is the link; the right side
 * holds the figure (a countdown, a time) and its line under it.
 */
export function WidgetRow({
  href,
  title,
  detail,
  aside,
  asideDetail,
  asideClassName,
  testId,
}: {
  href: string;
  title: ReactNode;
  detail?: ReactNode;
  aside?: ReactNode;
  asideDetail?: ReactNode;
  /** Colour for the figure: the urgency of a deadline. */
  asideClassName?: string;
  testId?: string;
}): ReactNode {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="group flex min-h-14 items-center justify-between gap-4 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold group-hover:text-primary-text">{title}</span>
        {detail ? <span className="line-clamp-2 text-sm text-muted-foreground">{detail}</span> : null}
      </span>{" "}
      {aside !== undefined || asideDetail !== undefined ? (
        <span className="shrink-0 text-right">
          {aside !== undefined ? (
            <span className={cn("block whitespace-nowrap text-sm font-semibold tabular-nums", asideClassName)}>{aside}</span>
          ) : null}
          {asideDetail !== undefined ? (
            <span className="block whitespace-nowrap text-sm text-muted-foreground">{asideDetail}</span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}

/** A section with nothing in it: one line saying so, and where to go instead. */
export function WidgetEmptyState({
  message,
  description,
  cta,
}: {
  message: string;
  description?: string;
  cta?: { href: string; label: string };
}): ReactNode {
  return (
    <div className="px-5 py-8" role="status">
      <p className="text-base font-semibold">{message}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {cta ? (
        <p className="mt-3 text-sm">
          <Link href={cta.href} className="link">
            {cta.label}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
