import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { PageSection } from "@/components/data/PageSection";
import type { DayGroup, SameDay } from "@/lib/sameDay";
import { prettyStatus } from "@/components/queue/stages";
import { cn } from "@/lib/utils";
import { longDate } from "@convex/lib/months";

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
  { key: "withdrawn", label: "Withdrawn", tone: "bg-chart-purple" },
  { key: "aside", label: "On hold, RFI or appeal", tone: "bg-data-warn" },
  { key: "inLine", label: "Still in line", tone: "bg-card bg-hatch text-input" },
];
// The neighbour squares carry a number, so "still in line" is a plain card
// there: a hatch behind small type would fight it. A number on a coloured fill
// is set in black in both themes, the withdrawn purple included (black on it is
// 5.3:1 in dark mode; white was 4.0:1, a leftover from when withdrawn was slate).
const INK: Record<DayGroup, string> = {
  certified: "text-black",
  denied: "text-black",
  withdrawn: "text-black",
  aside: "text-black",
  inLine: "text-foreground",
};
const TONE = Object.fromEntries(
  GROUPS.map((g) => [g.key, cn(g.key === "inLine" ? "bg-card" : g.tone, INK[g.key])]),
) as Record<DayGroup, string>;
const LABEL = Object.fromEntries(GROUPS.map((g) => [g.key, g.label])) as Record<DayGroup, string>;

const longDay = (iso: string) => longDate(iso) ?? iso;

export function SameDayCases({ data, className }: { data: SameDay; className?: string }) {
  const decided = data.counts.certified + data.counts.denied + data.counts.withdrawn;
  const shown = GROUPS.filter((g) => data.counts[g.key] > 0);
  return (
    <PageSection
      id="same-day"
      title="Filed the same day"
      className={className}
      lede={
        <>
          <b className="font-semibold text-foreground">{data.total.toLocaleString("en-US")}</b> PERM cases were filed
          on {longDay(data.day)}. <b className="font-semibold text-foreground">{decided.toLocaleString("en-US")}</b>{" "}
          have been decided.
        </>
      }
    >
      <ChartTips label={`Cases filed on ${longDay(data.day)}, by what has happened to them`}>
      <div className="flex h-5 w-full overflow-hidden border-input border" aria-hidden="true">
        {shown.map((g) => (
          <div
            key={g.key}
            data-tip={`${g.label}\n${data.counts[g.key].toLocaleString("en-US")} of the ${data.total.toLocaleString("en-US")} filed ${longDay(data.day)}`}
            className={cn("h-full", g.tone)}
            style={{ width: `${(data.counts[g.key] / data.total) * 100}%` }}
          />
        ))}
      </div>
      </ChartTips>{" "}
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {shown.map((g) => (
          <Fragment key={g.key}>{" "}
          <li className="flex items-center gap-1.5">
            <span className={cn("inline-block size-3.5 shrink-0 border-input border", g.tone)} aria-hidden="true" />{" "}
            <span className="text-soft">{g.label}</span>{" "}
            <span className="font-mono font-semibold tabular-nums">{data.counts[g.key].toLocaleString("en-US")}</span>
          </li>
          </Fragment>
        ))}
      </ul>{" "}

      {data.nearby.length > 1 ? (
        <>
          <h3 className="mt-8 text-base font-semibold">The cases numbered beside it</h3>{" "}
          <ol className="mt-3 flex flex-wrap gap-1.5" translate="no">
            {data.nearby.map((n) => (
              <Fragment key={n.caseNumber}>{" "}
              <li>
                <a
                  href={`/perm-case-status?case=${n.caseNumber}`}
                  rel="nofollow"
                  title={`${n.caseNumber}: ${n.status ? prettyStatus(n.status) : "no status"}`}
                  className={cn(
                    "flex size-11 items-center justify-center border-input font-mono text-sm font-semibold tabular-nums transition-[color,background-color,border-color,box-shadow,transform] hover:border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:-translate-y-0.5 border",
                    TONE[n.group],
                    n.isThis && "outline outline-2 outline-offset-2 outline-primary-text",
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
    </PageSection>
  );
}
