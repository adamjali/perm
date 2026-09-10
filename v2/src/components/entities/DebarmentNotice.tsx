import Link from "next/link";

import { PROGRAM_LABEL, isActive, phase, type Debarment } from "@/lib/turso/debarments";

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
 * THREE STATES, NOT TWO. This component treated anything not in force today as
 * finished, and told the reader in words that the sponsor "was barred from
 * filing in the past; the period has ended". For a debarment that has not
 * STARTED yet - one exists in the data right now, an H-2A employer barred from
 * 2026-11-01 for a year - every clause of that sentence is false, on the page
 * of a sponsor somebody may be about to sign with. See `phase()`.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const day = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;

export function DebarmentNotice({ rows, pageName, today }: { rows: Debarment[]; pageName: string; today: string }) {
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
    <aside className="mt-8 border-2 border-foreground bg-card p-5 shadow-hard sm:p-6" aria-label="Debarment notice">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        On DOL&apos;s debarment list
      </p>{" "}
      <p className="mt-2 text-base leading-relaxed">
        {lede}{" "}
        DOL&apos;s row, as published:
      </p>{" "}
      <ul className="mt-3 divide-y-2 divide-border border-y-2 border-border">
        {rows.map((d) => (
          <li key={`${d.program}-${d.entity}-${d.startDate}`} className="py-2 text-sm">
            <span className="font-bold">{d.entity}</span>
            {d.location ? <span className="text-foreground/70"> · {d.location}</span> : null} ·{" "}
            {PROGRAM_LABEL[d.program]} · {day(d.startDate)} to {day(d.endDate)}
            {phase(d, today) === "ended" ? " (ended)" : null}
            {phase(d, today) === "upcoming" ? (
              <span className="font-bold"> (not started)</span>
            ) : null}
            {d.violation ? <span className="text-foreground/80"> · {d.violation}</span> : null}
          </li>
        ))}
      </ul>{" "}
      <p className="mt-3 text-sm text-foreground/70">
        Matched on the normalised name, so read the listed name against this page&apos;s.{" "}
        <Link href="/debarments" className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
          Every list, with DOL&apos;s originals
        </Link>
        .
      </p>
    </aside>
  );
}
