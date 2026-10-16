import type { ReactNode } from "react";
import { TriangleIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

/**
 * The site's notes and caveats (round 3, Oct 15 2026: grey paragraphs under a
 * heading read as boring and awkwardly set).
 *
 * - `AlertMark`: a rounded triangle outlined in PT green with a black "!",
 *   for a note that changes how the figures read.
 * - `NoteBanner`: a framed text banner with a lime edge, the mark optional.
 * - `CaveatBox`: the soft yellow box (what a page can't tell you, a
 *   provisional figure), with the mark.
 *
 * Plain server markup, no state. Text stays ink on every ground.
 */

export function AlertMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-7 shrink-0 items-center justify-center", className)}>
      <TriangleIcon weight="bold" className="absolute inset-0 size-7 text-[#2ECC40]" />
      <span className="relative top-[2px] font-heading text-sm font-black leading-none text-black dark:text-white">!</span>
    </span>
  );
}

export function NoteBanner({
  children,
  alert = false,
  className,
}: {
  children: ReactNode;
  /** Show the triangle: the note changes how the figures read. */
  alert?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 border-2 border-l-[6px] border-border border-l-primary bg-card px-4 py-3 text-base leading-relaxed text-foreground shadow-hard-sm",
        className,
      )}
    >
      {alert ? <AlertMark className="mt-px" /> : null}{" "}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function CaveatBox({
  title,
  children,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 border-2 border-data-warn bg-soft-wait p-4 text-base leading-relaxed text-foreground", className)}>
      <AlertMark className="mt-px" />{" "}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-heading font-bold">{title}</p> : null}{" "}
        <div className={title ? "mt-1" : undefined}>{children}</div>
      </div>
    </div>
  );
}
