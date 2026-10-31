import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One tile of a board: its claim as the heading (the figure first), then its
 * picture, then where to go for the whole of it. The numbers board and the
 * wage-request page share it, so a compact card looks the same everywhere and
 * its "more" link leads to the full page (owner, Oct 31 2026: the important
 * thing first, the rest a click away).
 */
export function Tile({
  id,
  figure,
  claim,
  sub,
  children,
  foot,
  more,
  action,
  object = false,
  className,
}: {
  id: string;
  figure?: ReactNode;
  claim: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
  more?: { href: string; label: string };
  /** The tile's one button, after everything else. */
  action?: ReactNode;
  object?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-h`}
      className={cn("flex min-w-0 flex-col p-5 sm:p-6", object ? "object bg-card" : "bg-tint", className)}
    >
      <h2 id={`${id}-h`} className="font-heading">
        {figure !== undefined ? (
          <span className="block text-4xl font-bold leading-none tabular-nums">{figure}</span>
        ) : null}{" "}
        <span className={cn("block font-bold", figure !== undefined ? "mt-2 text-xl" : "text-2xl")}>{claim}</span>
      </h2>{" "}
      {sub ? <p className="mt-2 text-base text-soft">{sub}</p> : null}{" "}
      {children ? <div className="mt-5 flex flex-1 flex-col">{children}</div> : null}{" "}
      {foot ? <div className="mt-4 text-sm leading-relaxed text-muted-foreground">{foot}</div> : null}{" "}
      {more ? (
        <p className="mt-4">
          <Link href={more.href} className="link inline-flex min-h-[44px] items-center text-base font-semibold">
            {more.label}
          </Link>
        </p>
      ) : null}{" "}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
