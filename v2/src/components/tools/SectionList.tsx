import Link from "next/link";

import { GROUPS, SECTIONS, type SitePage } from "@/lib/siteMap";
import { cn } from "@/lib/utils";

/**
 * The pages beside a data page: its section's pages, the current one marked.
 *
 * Beside the page on a wide screen ("side"), the current page is a lime tab
 * that runs past the column's edge toward the page it names: "you are here",
 * in the colour the tape uses for the reader's own month. Under the page on a
 * phone ("end"), the same list in two columns.
 */
function PageLinks({ pages, current, placement }: { pages: readonly SitePage[]; current: string; placement: "side" | "end" }) {
  return (
    <ul className={cn("mt-2", placement === "end" ? "grid gap-x-6 sm:grid-cols-2" : "space-y-px")}>
      {pages.map((p) => {
        const here = p.href === current;
        return (
          <li key={p.href}>
            {here ? (
              <span
                aria-current="page"
                className={cn(
                  "flex min-h-10 items-center bg-primary px-3 text-[15px] font-semibold text-black",
                  placement === "side" && "-mr-5",
                )}
              >
                {p.name}
              </span>
            ) : (
              <Link
                href={p.href}
                className="flex min-h-10 items-center px-3 text-[15px] text-soft transition-colors hover:bg-accent hover:text-foreground"
              >
                {p.name}
              </Link>
            )}{" "}
          </li>
        );
      })}
    </ul>
  );
}

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
      <p className="px-3 font-heading text-base font-bold">{title}</p>{" "}
      <PageLinks pages={pages} current={current} placement={placement} />
    </nav>
  );
}

/**
 * Every data group at once, the current one open (sample option B): the whole
 * map beside the page, for comparison with the one-section list above.
 */
export function AllSectionsList({ current, group, className }: { current: string; group: string; className?: string }) {
  return (
    <nav aria-label="All data pages" className={cn("print:hidden", className)}>
      {GROUPS.map((g) => {
        const pages = SECTIONS.filter((x) => x.group === g);
        const open = g === group;
        return (
          <details key={g} open={open} className="group/sec border-b-2 border-foreground/10 py-1 last:border-b-0">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 font-heading text-base font-bold [&::-webkit-details-marker]:hidden">
              {g}{" "}
              <span className="font-body text-sm font-normal text-muted-foreground">{pages.length}</span>
            </summary>{" "}
            <PageLinks pages={pages} current={current} placement="side" />
          </details>
        );
      })}
    </nav>
  );
}
