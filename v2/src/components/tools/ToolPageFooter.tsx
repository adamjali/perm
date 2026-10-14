import Link from "next/link";
import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";


/**
 * The end of a calculator page: the other calculators, and the writing that
 * explains the thing it just calculated.
 *
 * Exists because the suite shipped as a closed loop. Every calculator linked to
 * other calculators and to signup, and nothing pointed back at the guides that
 * explain the rules behind the numbers, so a reader who wanted the reasoning
 * had to go and find it. Links running one way are half a link graph.
 */

export interface RelatedReading {
  href: string;
  label: string;
  /** Why this is worth reading from here, in one clause. */
  note: string;
}

export interface ToolPageFooterProps {
  /** The page rendering this. Kept for callers; its siblings are the section list. */
  currentHref?: string;
  reading: readonly RelatedReading[];
}

/** A page ends with a few related reads, never a wall of links. */
const MAX_READING = 3;

export function ToolPageFooter({ reading }: ToolPageFooterProps) {
  return (
    <>
      {reading.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-bold">The rules behind these numbers</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {reading.slice(0, MAX_READING).map((r) => (
              <li key={r.href} className="flex">
                <Link
                  href={r.href}
                  className="group flex w-full flex-col border border-border bg-card p-5 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-heading text-base font-bold leading-tight">
                      {r.label}
                    </span>
                    <ArrowUpRightIcon
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary transition-transform duration-150 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </span>{" "}
                  <span className="mt-2 text-base leading-relaxed text-muted-foreground">
                    {r.note}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

    </>
  );
}
