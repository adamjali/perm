import type { ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

/**
 * A whole section kept shut until it's asked for. Its heading is the summary,
 * so the page outline keeps it, and the body stays in the HTML open or shut,
 * so search engines and the page's own find read every word. Native
 * `<details>`: keyboard and screen readers work with no script.
 *
 * Folds stack into a list: put them in a `FoldList`, which draws the rule
 * above the first one.
 */
export function Fold({
  title,
  hint,
  id,
  children,
  className,
}: {
  title: ReactNode;
  /** One line under the heading saying what opening it shows. */
  hint?: ReactNode;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details id={id} className={cn("group border-b border-border", className)}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <h2 className="font-heading text-lg font-bold">{title}</h2>{" "}
          {hint ? <span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span> : null}
        </span>{" "}
        <CaretDownIcon
          className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>{" "}
      <div className="pb-10 pt-2">{children}</div>
    </details>
  );
}

/** A run of folds under one rule, the way a page ends with its detail. */
export function FoldList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-12 border-t border-border sm:mt-16", className)}>{children}</div>;
}
