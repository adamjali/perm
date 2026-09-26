import { Fragment } from "react";

import type { DayGroup, SameDay } from "@/lib/sameDay";
import { prettyStatus } from "@/components/queue/stages";
import { cn } from "@/lib/utils";

/**
 * "Are people who filed when I did hearing back?", answered from the record.
 *
 * Two pictures, one question each. The bar is the whole day: every PERM case
 * DOL numbered that day, split by what has happened to it. The squares are
 * the cases with the serials right beside this one, in order, so a reader
 * sees their immediate neighbours decided or still waiting. Colour carries
 * the group and each square also has a text label, so nothing depends on
 * colour alone.
 */

const GROUPS: { key: DayGroup; label: string; tone: string }[] = [
  { key: "certified", label: "Certified", tone: "bg-data-good" },
  { key: "denied", label: "Denied", tone: "bg-data-bad" },
  { key: "withdrawn", label: "Withdrawn", tone: "bg-data-none" },
  { key: "aside", label: "On hold, RFI or appeal", tone: "bg-data-warn" },
  { key: "inLine", label: "Still in line", tone: "bg-background" },
];
const TONE = Object.fromEntries(GROUPS.map((g) => [g.key, g.tone])) as Record<DayGroup, string>;
const LABEL = Object.fromEntries(GROUPS.map((g) => [g.key, g.label])) as Record<DayGroup, string>;

const longDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export function SameDayCases({ data, className }: { data: SameDay; className?: string }) {
  const decided = data.counts.certified + data.counts.denied + data.counts.withdrawn;
  const shown = GROUPS.filter((g) => data.counts[g.key] > 0);
  return (
    <section
      aria-labelledby="same-day-h"
      className={cn("border-2 border-border bg-card p-5 shadow-hard sm:p-6", className)}
    >
      <h2 id="same-day-h" className="font-heading text-xl font-black sm:text-2xl">
        Filed the same day
      </h2>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/80">
        <b className="font-bold text-foreground">{data.total.toLocaleString("en-US")}</b> PERM cases were filed on{" "}
        {longDay(data.day)}.{" "}
        <b className="font-bold text-foreground">{decided.toLocaleString("en-US")}</b> have been decided.
      </p>{" "}
      <div className="mt-4 flex h-5 w-full overflow-hidden border-2 border-border" aria-hidden="true">
        {shown.map((g) => (
          <div
            key={g.key}
            className={cn("h-full", g.tone, g.key === "inLine" && "bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,var(--border)_4px,var(--border)_5px)]")}
            style={{ width: `${(data.counts[g.key] / data.total) * 100}%` }}
          />
        ))}
      </div>{" "}
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {shown.map((g) => (
          <Fragment key={g.key}>{" "}
          <li className="flex items-center gap-1.5">
            <span className={cn("inline-block h-3.5 w-3.5 shrink-0 border-2 border-border", g.tone)} aria-hidden="true" />{" "}
            <span className="text-foreground/80">{g.label}</span>{" "}
            <span className="font-mono font-bold tabular-nums">{data.counts[g.key].toLocaleString("en-US")}</span>
          </li>
          </Fragment>
        ))}
      </ul>

      {data.nearby.length > 1 ? (
        <>
          <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            The cases numbered beside it
          </h3>{" "}
          <ol className="mt-3 flex flex-wrap gap-1.5" translate="no">
            {data.nearby.map((n) => (
              <Fragment key={n.caseNumber}>{" "}
              <li>
                <a
                  href={`/perm-case-status?case=${n.caseNumber}`}
                  rel="nofollow"
                  title={`${n.caseNumber}: ${n.status ? prettyStatus(n.status) : "no status"}`}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center border-2 border-border font-mono text-sm font-bold tabular-nums transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none",
                    TONE[n.group],
                    n.isThis && "outline outline-4 outline-offset-2 outline-primary",
                  )}
                >
                  <span aria-hidden="true">{n.isThis ? "this" : n.caseNumber.slice(-3)}</span>{" "}
                  <span className="sr-only">
                    {n.isThis ? "This case" : n.caseNumber}, {LABEL[n.group]}
                  </span>
                </a>
              </li>
              </Fragment>
            ))}
          </ol>{" "}
          <p className="mt-2 text-sm text-muted-foreground">
            Last three digits of each case number, in the order DOL issued them. Tap one to look it up.
          </p>
        </>
      ) : null}
    </section>
  );
}
