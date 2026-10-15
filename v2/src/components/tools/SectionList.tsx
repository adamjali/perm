import Link from "next/link";

import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { CasePromises } from "@/components/tools/CasePromises";
import { CALCULATOR_PAGES, GROUPS, SECTIONS, type SitePage } from "@/lib/siteMap";
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
                  "flex min-h-11 items-center bg-primary px-3 text-[15px] font-semibold text-black",
                  placement === "side" && "-mr-5",
                )}
              >
                {p.name}
              </span>
            ) : (
              <Link
                href={p.href}
                className="flex min-h-11 items-center px-3 text-[15px] text-soft transition-colors hover:bg-accent hover:text-foreground"
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
 * The site's main job, kept beside the data: a case number gets the likely
 * decision date and an email the day DOL moves the case. Without the number,
 * the estimate from a filing month.
 */
function CheckACase() {
  return (
    <div className="object mt-6 p-3">
      <p className="font-heading text-base font-bold">Waiting on a case?</p>{" "}
      <CasePromises compact className="mt-3" />{" "}
      <CaseLookupForm
        compact
        stack
        label="Case number"
        placeholder="Case number"
        help={null}
        source="data-list"
        className="mt-3"
      />{" "}
      <Link href="/tools/perm-timeline-calculator" className="link mt-1 inline-flex min-h-11 items-center text-sm">
        No number? Estimate your date
      </Link>
    </div>
  );
}

/** The six data groups, then the calculators, in the list's order. */
const LIST_GROUPS: readonly { name: string; pages: readonly SitePage[] }[] = [
  ...GROUPS.map((name) => ({ name, pages: SECTIONS.filter((x) => x.group === name) })),
  { name: "Calculators", pages: CALCULATOR_PAGES },
];

/**
 * Beside a data page on a wide screen: every data group at once with the
 * page's own group open, so the whole map is in view and nothing is hunted
 * for group by group, then the case lookup under it (owner, Oct 15).
 */
export function AllSectionsList({ current, group, className }: { current: string; group: string; className?: string }) {
  return (
    <nav aria-label="All data pages" className={cn("print:hidden", className)}>
      {/* Each group a fold; the page's own is open. */}
      {LIST_GROUPS.map(({ name, pages }) => {
        const open = name === group;
        return (
          <details key={name} open={open} className="group/sec border-b-2 border-foreground/10 py-1 last:border-b-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 font-heading text-base font-bold [&::-webkit-details-marker]:hidden">
              {name}{" "}
              <span className="font-body text-sm font-normal text-muted-foreground">{pages.length}</span>
            </summary>{" "}
            <PageLinks pages={pages} current={current} placement="side" />
          </details>
        );
      })}{" "}
      <CheckACase />
    </nav>
  );
}
