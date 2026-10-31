import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { PageSection } from "@/components/data/PageSection";
import type { DayGroup, SameDay } from "@/lib/sameDay";
import { prettyStatus } from "@/components/queue/stages";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";
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

const GROUP_NAME: Record<DayGroup, string> = {
  certified: "Certified",
  denied: "Denied",
  withdrawn: "Withdrawn",
  aside: "On hold, RFI or appeal",
  inLine: "Still in line",
};

const GROUPS: { key: DayGroup; tone: string }[] = [
  { key: "certified", tone: "bg-data-good" },
  { key: "denied", tone: "bg-data-bad" },
  { key: "withdrawn", tone: "bg-chart-purple" },
  { key: "aside", tone: "bg-data-warn" },
  { key: "inLine", tone: "bg-card bg-hatch text-input" },
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
export function SameDayCases({ data, className }: { data: SameDay; className?: string }) {
  const n = formatInt;
  const day = longDate(data.day) ?? data.day;
  const decided = data.counts.certified + data.counts.denied + data.counts.withdrawn;
  const shown = GROUPS.filter((g) => data.counts[g.key] > 0);
  return (
    <PageSection
      id="same-day"
      title="Filed the same day"
      className={className}
      lede={
        <>
          <b className="font-semibold text-foreground">{n(data.total)}</b>
          {` PERM cases were filed on ${day}. `}
          <b className="font-semibold text-foreground">{n(decided)}</b>
          {" have been decided."}
        </>
      }
    >
      <ChartTips label={`Cases filed on ${day}, by what has happened to them`}>
      <div className="flex h-5 w-full overflow-hidden border-input border" aria-hidden="true">
        {shown.map((g) => (
          <div
            key={g.key}
            data-tip={`${GROUP_NAME[g.key]}\n${n(data.counts[g.key])} of the ${n(data.total)} filed ${day}`}
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
            <span className="text-soft">{GROUP_NAME[g.key]}</span>{" "}
            <span className="font-mono font-semibold tabular-nums">{n(data.counts[g.key])}</span>
          </li>
          </Fragment>
        ))}
      </ul>{" "}

      {data.nearby.length > 1 ? (
        <>
          <h3 className="mt-8 text-base font-semibold">The cases numbered beside it</h3>{" "}
          <ol className="mt-3 flex flex-wrap gap-1.5" translate="no">
            {data.nearby.map((c) => (
              <Fragment key={c.caseNumber}>{" "}
              <li>
                <a
                  href={`/perm-case-status?case=${c.caseNumber}`}
                  rel="nofollow"
                  title={`${c.caseNumber}: ${c.status ? prettyStatus(c.status) : "no status"}`}
                  className={cn(
                    "flex size-11 items-center justify-center border-input font-mono text-sm font-semibold tabular-nums transition-[color,background-color,border-color,box-shadow,transform] hover:border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:-translate-y-0.5 border",
                    TONE[c.group],
                    c.isThis && "outline outline-2 outline-offset-2 outline-primary-text",
                  )}
                >
                  <span aria-hidden="true">{c.isThis ? "this" : c.caseNumber.slice(-3)}</span>{" "}
                  <span className="sr-only">
                    {c.isThis ? "This case" : c.caseNumber}, {GROUP_NAME[c.group]}
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
