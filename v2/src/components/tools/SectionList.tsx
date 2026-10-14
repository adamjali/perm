import Link from "next/link";

import type { SitePage } from "@/lib/siteMap";
import { cn } from "@/lib/utils";

/**
 * A data page's siblings: the pages in its group of the Data menu.
 *
 * Beside the page on a desktop ("In this section"), and at the end of it on a
 * phone ("More in this section"). A plain list: no groups to open, no icons,
 * no counts, and it doesn't follow the reader down the page. The page you're
 * on is marked and isn't a link.
 */
export function SectionList({
  title,
  pages,
  current,
  placement,
  className,
}: {
  title: string;
  pages: readonly SitePage[];
  current: string;
  placement: "side" | "end";
  className?: string;
}) {
  const heading = placement === "side" ? "In this section" : "More in this section";
  return (
    <nav aria-label={heading} className={cn("print:hidden", className)}>
      <p className="text-sm text-muted-foreground">{heading}</p>{" "}
      <p className="mt-1 font-heading text-base font-bold">{title}</p>{" "}
      <ul className={cn("mt-3", placement === "end" ? "grid gap-x-6 sm:grid-cols-2" : "space-y-0.5")}>
        {pages.map((p) => {
          const here = p.href === current;
          return (
            <li key={p.href}>
              {here ? (
                <span
                  aria-current="page"
                  className="flex min-h-11 items-center border-l-2 border-primary-text pl-3 text-base font-semibold text-foreground"
                >
                  {p.name}
                </span>
              ) : (
                <Link
                  href={p.href}
                  className="flex min-h-11 items-center border-l-2 border-transparent pl-3 text-base text-soft transition-colors hover:border-border hover:text-foreground"
                >
                  {p.name}
                </Link>
              )}{" "}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
