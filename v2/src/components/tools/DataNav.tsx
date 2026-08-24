import Link from "next/link";

/**
 * The persistent section nav for the public data surface.
 *
 * Before this existed, every calculator was an island: reaching a sibling tool
 * meant backing out to /tools and clicking again. The rival product keeps its
 * whole data surface one click deep from anywhere, and that is the correct
 * shape for an instrument — sections, not pages.
 *
 * Server component on purpose: the active state is set by the page that mounts
 * it (each page knows its own section), so no client JS is spent on a nav.
 */

export type DataSection =
  | "overview"
  | "calculators"
  | "processing-times"
  | "visa-bulletin"
  | "methodology";

const SECTIONS: { key: DataSection; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "/tools" },
  { key: "calculators", label: "Calculators", href: "/tools#calculators" },
  { key: "processing-times", label: "Processing times", href: "/perm-processing-times" },
  { key: "visa-bulletin", label: "Visa bulletin", href: "/tools/priority-date-calculator" },
  { key: "methodology", label: "Methodology", href: "/methodology" },
];

export function DataNav({ active }: { active: DataSection }) {
  return (
    <nav
      aria-label="Data sections"
      className="sticky top-16 z-30 -mx-4 border-b-2 border-border bg-background/95 backdrop-blur-sm px-4 sm:-mx-6 sm:px-6"
      style={{ top: "calc(4rem + var(--security-banner-h, 0px))" }}
    >
      <div className="mx-auto flex max-w-4xl items-center gap-1 overflow-x-auto py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s) => {
          const isActive = s.key === active;
          return (
            <Link
              key={s.key}
              href={s.href}
              aria-current={isActive ? "page" : undefined}
              className={
                "whitespace-nowrap border-b-4 px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors " +
                (isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-foreground/60 hover:border-border hover:text-foreground")
              }
            >
              {s.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
