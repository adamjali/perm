import Link from "next/link";

import { BarRows } from "@/components/data/BarRows";
import { FinePrint } from "@/components/data/FinePrint";
import type { FieldWait, FiledToday } from "@/lib/db/employerWait";
import type { WaitSummary } from "@/lib/waitSummary";
import { formatInt } from "@/lib/format";

/**
 * How long this employer's PERM cases are taking, set against every
 * employer's, and what a case it files today would wait.
 *
 * The comparison is the point: DOL works one national line in filing order,
 * so most employers' cases take about as long as everyone's, and a sponsor
 * whose cases run much longer usually has audits or requests for information
 * in the mix. Saying that plainly is more useful than a per-sponsor
 * "processing time" that is really the national one wearing a name.
 */

const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function EmployerWait({
  name,
  mine,
  field,
  today,
  level = 2,
  className,
}: {
  /** The heading's level: 3 inside a page's own chapter. */
  level?: 2 | 3;
  name: string;
  mine: WaitSummary;
  field: FieldWait | null;
  today: FiledToday | null;
  className?: string;
}) {
  if (!field && !today && mine.n === 0) return null;
  const rows = [];
  if (mine.p50 !== null) {
    rows.push({
      key: "mine",
      label: <span translate="no">{name}</span>,
      sub: `median of ${formatInt(mine.n)} ${mine.n === 1 ? "decision" : "decisions"} in the last ${field?.windowDays ?? 90} days`,
      value: mine.p50,
      text: `${formatInt(mine.p50)} days`,
    });
  }
  if (field?.p50 != null) {
    rows.push({
      key: "field",
      label: "Every employer",
      sub: `median of ${formatInt(field.n)} decisions in the same ${field.windowDays} days`,
      value: field.p50,
      text: `${formatInt(field.p50)} days`,
      tone: "blue" as const,
    });
  }
  const gap = mine.p50 !== null && field?.p50 != null ? mine.p50 - field.p50 : null;
  const Heading = level === 3 ? "h3" : "h2";
  const verdict =
    mine.p50 === null
      ? `${mine.n === 0 ? "None" : `Only ${formatInt(mine.n)}`} of their cases ${mine.n === 1 ? "was" : "were"} decided in the last ${field?.windowDays ?? 90} days, too few for a median of their own.`
      : gap !== null && Math.abs(gap) <= 14
        ? "About the same as everyone: DOL works one national line in filing order."
        : gap !== null && gap > 14
          ? `${formatInt(gap)} days longer than everyone's, which usually means audits or requests for information in the mix.`
          : gap !== null
            ? `${formatInt(-gap)} days shorter than everyone's over this window.`
            : null;
  return (
    <section aria-labelledby="wait-h" className={className}>
      <Heading id="wait-h" className="font-heading text-lg font-bold">
        Filing to decision
      </Heading>{" "}
      {rows.length > 0 ? <BarRows label="Median days to a decision, this employer against every employer" className="mt-4" rows={rows} /> : null}{" "}
      {verdict ? <p className="mt-3 text-base leading-relaxed text-soft">{verdict}</p> : null}{" "}
      {today ? (
        <p className="mt-4 border-l-4 border-primary bg-sage px-4 py-3 text-base leading-relaxed">
          <b className="font-bold">Filed today:</b> decided around{" "}
          <b className="font-bold">{day(today.estimatedDate)}</b>
          {today.earliestDate && today.latestDate ? (
            <>
              {" "}
              ({day(today.earliestDate)} to {day(today.latestDate)})
            </>
          ) : null}
          {today.casesAhead !== null ? <>, behind {formatInt(today.casesAhead)} cases in the same line as anyone&apos;s</> : null}.{" "}
          <Link href="/tools/perm-timeline-calculator" className="link">
            Estimate another date
          </Link>
        </p>
      ) : null}{" "}
      <FinePrint summary="How this is counted" className="mt-2">
        <p>Filing to decision, over decisions this site watched DOL make in the last {field?.windowDays ?? 90} days; withdrawals left out.</p>
      </FinePrint>
    </section>
  );
}
