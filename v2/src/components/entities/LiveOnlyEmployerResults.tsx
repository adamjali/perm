import { Fragment } from "react";
import Link from "next/link";

import type { LiveEmployerHit } from "@/lib/entityPayload";

/**
 * Employers the published files have never named.
 *
 * ## Why these are not rows in the table above
 *
 * The employer table's columns are filings, certified, denied, approval rate
 * and median days. Every one of those comes from a DECIDED case in DOL's
 * quarterly disclosure files, and these employers have none - their filings
 * are newer than the last published quarter, or still waiting, or both. A
 * packed row of zeros would render as a genuine record of a company that
 * certified nothing and rank it top of a volume sort. So they get their own
 * block, their own words, and only the two counts we actually hold.
 *
 * `cases` and `pending` are what our live corpus holds TODAY, not a lifetime
 * total, and the copy has to say so: an employer with twenty years of history
 * can show three here because three is what is newer than the last file.
 */

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function LiveOnlyEmployerResults({
  hits,
  query,
}: {
  hits: LiveEmployerHit[];
  query: string;
}) {
  if (hits.length === 0) return null;
  return (
    <section className="mt-6 border-2 border-border bg-card p-5 shadow-hard-sm sm:p-6">
      <h3 className="font-heading text-lg font-black sm:text-xl">
        {fmt(hits.length)} more {hits.length === 1 ? "sponsor" : "sponsors"},
        not in a published DOL file yet
      </h3>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
        These match &ldquo;{query}&rdquo; in our live record of individual
        cases. DOL publishes its disclosure files quarterly and only after a
        case is decided, so nothing here has an approval rate, a median wait or
        a wage yet. What we can show is the case itself.
      </p>
      <ul className="mt-4 divide-y divide-border/60">
        {hits.map((h) => (
          // Keyed Fragment with a leading space: array items render with
          // NOTHING between them, so one sponsor's case count welds to the
          // next one's name for anything walking the DOM.
          <Fragment key={h.slug}>{" "}
          <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5">
            <Link
              href={`/perm-employers/${h.slug}`}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              {h.name}
            </Link>{" "}
            <span className="ml-auto whitespace-nowrap font-mono text-sm tabular-nums text-foreground/70">
              {fmt(h.cases)} live {h.cases === 1 ? "case" : "cases"}
              {h.pending > 0 ? `, ${fmt(h.pending)} waiting` : ""}
            </span>
          </li>
          </Fragment>
        ))}
      </ul>{" "}
      {/* Same pair the rendered audit caught on the live-only employer page:
          the last list item's case count welds to "Name search here" for
          anything walking the DOM, and the source-level gate cannot see it
          because `ul` is not in its tag list. */}
      <p className="mt-4 border-t-2 border-border pt-3 text-sm leading-relaxed text-foreground/70">
        Name search here matches from the START of the name, so a word from the
        middle finds nothing. If you have the case number,{" "}
        <Link
          href="/perm-case-status"
          className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
        >
          look the case up directly
        </Link>
        .
      </p>
    </section>
  );
}
