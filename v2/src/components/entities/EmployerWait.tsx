import Link from "next/link";

import { BarRows } from "@/components/data/BarRows";
import type { FieldWait, FiledToday } from "@/lib/turso/employerWait";
import type { WaitSummary } from "@/lib/waitSummary";
import { cn } from "@/lib/utils";

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
const int = (n: number) => n.toLocaleString("en-US");

export function EmployerWait({
  name,
  mine,
  field,
  today,
  className,
}: {
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
      sub: `median of ${int(mine.n)} ${mine.n === 1 ? "decision" : "decisions"} in the last ${field?.windowDays ?? 90} days`,
      value: mine.p50,
      text: `${int(mine.p50)} days`,
    });
  }
  if (field?.p50 != null) {
    rows.push({
      key: "field",
      label: "Every employer",
      sub: `median of ${int(field.n)} decisions in the same ${field.windowDays} days`,
      value: field.p50,
      text: `${int(field.p50)} days`,
      tone: "ink" as const,
    });
  }
  const gap = mine.p50 !== null && field?.p50 != null ? mine.p50 - field.p50 : null;
  return (
    <section
      aria-labelledby="wait-h"
      className={cn("border-2 border-border bg-card p-6 shadow-hard sm:p-8", className)}
    >
      <h2 id="wait-h" className="font-heading text-xl font-black sm:text-2xl">
        How long their cases are taking
      </h2>{" "}
      {rows.length > 0 ? <BarRows className="mt-5 max-w-3xl" rows={rows} /> : null}{" "}
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/80">
        {mine.p50 === null
          ? `${mine.n === 0 ? "None" : `Only ${int(mine.n)}`} of their cases ${mine.n === 1 ? "was" : "were"} decided in the last ${field?.windowDays ?? 90} days, too few for a median of their own. `
          : gap !== null && Math.abs(gap) <= 14
            ? "About the same as everyone: DOL works one national line in filing order. "
            : gap !== null && gap > 14
              ? `${int(gap)} days longer than everyone's, which usually means audits or requests for information in the mix. `
              : gap !== null
                ? `${int(-gap)} days shorter than everyone's over this window. `
                : ""}
        Counted from filing to decision, over decisions DOL made while we were watching; withdrawals are left out.
      </p>{" "}
      {today ? (
        <p className="mt-4 max-w-2xl border-t-2 border-border pt-4 text-base leading-relaxed text-foreground/80">
          <b className="font-bold text-foreground">Filed today:</b> a new case joins the same line as anyone&apos;s
          {today.casesAhead !== null ? <>, behind {int(today.casesAhead)} cases</> : null}, and would be decided around{" "}
          <b className="font-bold text-foreground">{day(today.estimatedDate)}</b>
          {today.earliestDate && today.latestDate ? (
            <>
              {" "}
              (between {day(today.earliestDate)} and {day(today.latestDate)})
            </>
          ) : null}
          .{" "}
          <Link
            href="/tools/perm-timeline-calculator"
            className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
          >
            Estimate another date
          </Link>
        </p>
      ) : null}
    </section>
  );
}
