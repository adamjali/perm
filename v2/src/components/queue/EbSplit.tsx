import Link from "next/link";

import type { EbSplit as Split } from "@/lib/db/ebSplit";
import { formatInt, formatShareOf } from "@/lib/format";
import { monthYear } from "@convex/lib/months";

/**
 * Which line the jobs in DOL's queue can join: the share whose own minimum meets the EB-2 bar,
 * from their wage requests. The employer picks the category at the I-140, so this is what the
 * jobs could file, never what they did.
 */
export function EbSplit({ split, className }: { split: Split | null; className?: string }) {
  if (!split) return null;
  const known = split.eb2 + split.eb3;
  if (known === 0) return null;
  const eb2 = (split.eb2 / known) * 100;
  return (
    <section aria-labelledby="eb-split-h" className={className}>
      <h2 id="eb-split-h" className="font-heading text-2xl font-bold sm:text-3xl">
        EB-2 or EB-3: what the jobs require
      </h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-soft">
        The employer picks the line at the <span className="whitespace-nowrap">I-140</span>, after the PERM. The job decides which it can pick: a master&rsquo;s or
        higher, or a bachelor&rsquo;s and five years, meets the EB-2 bar.
      </p>{" "}
      <div className="mt-6 max-w-3xl">
        <div aria-hidden="true" className="flex h-12 w-full border-2 border-border">
          <span className="h-full bg-chart-blue" style={{ width: `${eb2}%` }} />
          <span className="h-full bg-chart-yellow" style={{ width: `${100 - eb2}%` }} />
        </div>{" "}
        <dl className="mt-3 grid grid-cols-2 gap-4 [&>*]:min-w-0">
          <div>
            <dt className="flex items-center gap-1.5 text-sm text-soft">
              <span aria-hidden="true" className="size-3 border-2 border-data-info-ink bg-chart-blue" /> Meets the EB-2 bar
            </dt>{" "}
            <dd className="font-heading text-3xl font-bold tabular-nums">{formatShareOf(split.eb2, known)}</dd>{" "}
            <dd className="text-sm text-soft">{formatInt(split.eb2)} jobs</dd>
          </div>{" "}
          <div>
            <dt className="flex items-center gap-1.5 text-sm text-soft">
              <span aria-hidden="true" className="size-3 border-2 border-data-warn bg-chart-yellow" /> EB-3 only
            </dt>{" "}
            <dd className="font-heading text-3xl font-bold tabular-nums">{formatShareOf(split.eb3, known)}</dd>{" "}
            <dd className="text-sm text-soft">{formatInt(split.eb3)} jobs</dd>
          </div>
        </dl>
      </div>{" "}
      <p className="mt-5 max-w-3xl text-sm leading-relaxed text-soft">
        Every PERM job whose wage DOL set from {monthYear(split.from.slice(0, 7))} to {monthYear(split.to.slice(0, 7))}, the
        jobs being filed and decided now, by its required education and experience and any alternative (8 CFR 204.5(k)(2)).
        A job that meets the bar can still go EB-3. The two lines&rsquo; cutoffs are on the{" "}
        <Link href="/tools/eb2-vs-eb3" className="link">
          EB-2 and EB-3 comparison
        </Link>
        .
      </p>
    </section>
  );
}
