import Link from "next/link";

import { PROGRAM_LABEL, isActive, phase, type Debarment } from "@/lib/db/debarments";
import { cn } from "@/lib/utils";
import { shortDate } from "@convex/lib/months";

/**
 * A dated notice on an employer or law-firm page when a name on DOL's
 * debarment lists matches the page's own.
 *
 * It prints DOL's row: the program, the period, the violation in DOL's
 * words, and the source. It does not say the match is certain: the join is
 * the normalised name, and the reader can see the listed name beside the
 * page's. An expired debarment shows as ended rather than vanishing, because
 * the page is a record.
 *
 * THREE STATES, NOT TWO. Treating anything not in force today as finished
 * would tell the reader that the sponsor "was barred from filing in the past;
 * the period has ended", and for a debarment that has not STARTED yet every
 * clause of that sentence is false, on the page of a sponsor somebody may be
 * about to sign with. See `phase()`.
 */

/** "2026-09-11" to "Sep 11, 2026"; anything else prints as given. */
const day = (iso: string) => shortDate(iso) ?? iso;

export function DebarmentNotice({
  rows,
  pageName,
  today,
  className = "mt-8",
}: {
  rows: Debarment[];
  pageName: string;
  today: string;
  /** Spacing from what sits around it; a page placing it first passes its own. */
  className?: string;
}) {
  if (rows.length === 0) return null;
  const active = rows.filter((d) => isActive(d, today));
  const upcoming = rows.filter((d) => phase(d, today) === "upcoming");
  // Ordered by what the reader most needs to know: barred today beats barred
  // from a known future date, and both beat a period that has run out.
  const lede =
    active.length > 0
      ? `A name matching ${pageName} is barred from filing today.`
      : upcoming.length > 0
        ? `A name matching ${pageName} is barred from filing from ${day(upcoming[0]!.startDate)}. The period has not started yet.`
        : `A name matching ${pageName} was barred from filing in the past; the period has ended.`;
  return (
    <aside id="debarment" className={cn(className, "border-2 border-foreground bg-card p-5 sm:p-6 shadow-hard")} aria-label="Debarment notice">
      <p className="text-sm font-bold text-muted-foreground">
        On DOL&apos;s debarment list
      </p>{" "}
      <p className="mt-2 text-base leading-relaxed">
        {lede}{" "}
        DOL&apos;s row, as published:
      </p>{" "}
      <ul className="mt-3 divide-y divide-border border-y-2 border-border">
        {rows.map((d) => (
          <li key={`${d.program}-${d.entity}-${d.startDate}`} className="py-2 text-sm">
            <span className="font-bold">{d.entity}</span>
            {d.location ? <span className="text-muted-foreground"> · {d.location}</span> : null} ·{" "}
            {PROGRAM_LABEL[d.program]} · {day(d.startDate)} to {day(d.endDate)}
            {phase(d, today) === "ended" ? " (ended)" : null}
            {phase(d, today) === "upcoming" ? (
              <span className="font-bold"> (not started)</span>
            ) : null}
            {d.violation ? <span className="text-soft"> · {d.violation}</span> : null}
          </li>
        ))}
      </ul>{" "}
      <p className="mt-3 text-sm text-muted-foreground">
        Matched on the normalised name, so read the listed name against this page&apos;s.{" "}
        <Link href="/debarments" className="link">
          Every list, with DOL&apos;s originals
        </Link>
        .
      </p>
    </aside>
  );
}
