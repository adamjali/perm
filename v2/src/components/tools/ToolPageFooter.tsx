import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/ssr";

import { TOOL_NAV_LINKS } from "@/lib/constants/navigation";

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
  /** The page rendering this, so it does not link to itself. */
  currentHref: string;
  reading: readonly RelatedReading[];
}

export function ToolPageFooter({ currentHref, reading }: ToolPageFooterProps) {
  const others = TOOL_NAV_LINKS.filter((t) => t.href !== currentHref);

  return (
    <>
      {reading.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-black">The rules behind these numbers</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {reading.map((r) => (
              <li key={r.href} className="flex">
                <Link
                  href={r.href}
                  className="group flex w-full flex-col border-2 border-border bg-card p-5 shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0 active:shadow-hard-sm"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-heading text-base font-black leading-tight">
                      {r.label}
                    </span>
                    <ArrowUpRight
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
                      aria-hidden="true"
                    />
                  </span>{" "}
                  <span className="mt-2 text-base leading-relaxed text-foreground/70">
                    {r.note}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Other calculators</h2>
        <ul className="mt-6 flex flex-wrap gap-3">
          {others.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-card px-4 py-2 font-bold shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0 active:shadow-hard-sm"
              >
                {t.label}
                <ArrowRight className="h-4 w-4 text-primary" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
