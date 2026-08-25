import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { QueueTape } from "@/components/tools/QueueTape";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";

/**
 * The homepage's evidence band.
 *
 * It replaces a count-up stats section whose four numbers were definitional
 * ("5 PERM stages covered") rather than evidential. This shows the one thing
 * a visitor cannot get from any brochure: where DOL's queue actually stands,
 * today, from DOL's own figures — the same data the product runs on.
 *
 * Server component; the page passes the already-fetched snapshot so the
 * homepage makes exactly one Convex query.
 */

export interface LiveDataBandProps {
  frontierMonth: string | null;
  asOf: string | null;
  averageDays: number | null;
}

export function LiveDataBand({ frontierMonth, asOf, averageDays }: LiveDataBandProps) {
  if (!frontierMonth) return null;

  return (
    <section aria-label="Live DOL queue position" className="border-y-2 border-border bg-card">
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
              Live from the Department of Labor
              {asOf ? ` · ${formatAsOf(asOf)}` : null}
            </p>{" "}
            <h2 className="mt-2 font-heading text-3xl font-black leading-tight sm:text-4xl">
              DOL is deciding cases filed{" "}
              <span className="whitespace-nowrap bg-primary px-2 text-black">
                {formatMonth(frontierMonth)}
              </span>
            </h2>{" "}
            {averageDays != null ? (
              <p className="mt-3 max-w-xl text-base leading-relaxed text-foreground/70">
                {averageDays} days on average to a determination. The tracker
                turns dates like these into your case&apos;s own deadlines.
              </p>
            ) : null}
          </div>
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-background px-5 py-2.5 font-bold shadow-hard-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
          >
            Open the data
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <QueueTape frontierMonth={frontierMonth} className="mt-8" monthsBehind={6} monthsAhead={8} />

        {/* The homepage linked to none of the data pages: they were reachable
            only through the nav, so each had exactly one inbound body link
            from its own index. These are the entry points. */}
        <nav aria-label="Data pages" className="mt-10 grid [&>*]:min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { href: "/perm-by-state", label: "By state", what: "Filings and wages per worksite state" },
            { href: "/perm-wages", label: "Wages", what: "Median offered wage by occupation" },
            { href: "/perm-employers", label: "Employers", what: "Who sponsors the most" },
            { href: "/perm-attorneys", label: "Law firms", what: "Who files the most" },
            { href: "/perm-denial-risk", label: "Denial rates", what: "What actually gets denied" },
          ].map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="group flex flex-col border-2 border-border bg-background p-4 shadow-hard-sm transition-all duration-150 hover:-translate-y-[2px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
            >
              <span className="font-heading text-base font-black">{d.label}</span>{" "}
              <span className="mt-1 text-sm leading-snug text-foreground/60">{d.what}</span>{" "}
              <span className="mt-3 font-mono text-xs font-bold uppercase tracking-wider text-foreground/50 group-hover:text-primary">
                Open →
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
