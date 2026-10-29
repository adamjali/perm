import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { PageSection } from "@/components/data/PageSection";
import { Bold } from "@/components/i18n/Bold";
import type { DayGroup, SameDay } from "@/lib/sameDay";
import { prettyStatus } from "@/components/queue/stages";
import { cn } from "@/lib/utils";
import { localizedPath, type Lang } from "@/lib/i18n/lang";
import { dayLabel, intLabel } from "@/lib/i18n/format";

import { SAME_DAY, type SameDayText } from "./SameDayCases.messages";

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
export function SameDayCases({ data, className, lang = "en" }: { data: SameDay; className?: string; lang?: Lang }) {
  const t: SameDayText = SAME_DAY[lang];
  const n = (x: number) => intLabel(x, lang);
  const day = dayLabel(data.day, lang) ?? data.day;
  const decided = data.counts.certified + data.counts.denied + data.counts.withdrawn;
  const shown = GROUPS.filter((g) => data.counts[g.key] > 0);
  const [filed, decidedLine] = t.lede(n(data.total), day, n(decided));
  return (
    <PageSection
      id="same-day"
      title={t.title}
      className={className}
      lede={
        <>
          <Bold parts={filed} className="font-semibold text-foreground" />
          <Bold parts={decidedLine} className="font-semibold text-foreground" />
        </>
      }
    >
      <ChartTips label={t.chartLabel(day)}>
      <div className="flex h-5 w-full overflow-hidden border-input border" aria-hidden="true">
        {shown.map((g) => (
          <div
            key={g.key}
            data-tip={t.tip(t.group[g.key], n(data.counts[g.key]), n(data.total), day)}
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
            <span className="text-soft">{t.group[g.key]}</span>{" "}
            <span className="font-mono font-semibold tabular-nums">{n(data.counts[g.key])}</span>
          </li>
          </Fragment>
        ))}
      </ul>{" "}

      {data.nearby.length > 1 ? (
        <>
          <h3 className="mt-8 text-base font-semibold">{t.nearbyTitle}</h3>{" "}
          <ol className="mt-3 flex flex-wrap gap-1.5" translate="no">
            {data.nearby.map((c) => (
              <Fragment key={c.caseNumber}>{" "}
              <li>
                <a
                  href={localizedPath(`/perm-case-status?case=${c.caseNumber}`, lang)}
                  rel="nofollow"
                  title={`${c.caseNumber}: ${c.status ? prettyStatus(c.status) : t.noStatus}`}
                  className={cn(
                    "flex size-11 items-center justify-center border-input font-mono text-sm font-semibold tabular-nums transition-[color,background-color,border-color,box-shadow,transform] hover:border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:-translate-y-0.5 border",
                    TONE[c.group],
                    c.isThis && "outline outline-2 outline-offset-2 outline-primary-text",
                  )}
                >
                  <span aria-hidden="true">{c.isThis ? t.thisShort : c.caseNumber.slice(-3)}</span>{" "}
                  <span className="sr-only">
                    {c.isThis ? t.thisCase : c.caseNumber}, {t.group[c.group]}
                  </span>
                </a>
              </li>
              </Fragment>
            ))}
          </ol>{" "}
          <p className="mt-2 text-sm text-muted-foreground">
            {t.digitsNote}
          </p>
        </>
      ) : null}
    </PageSection>
  );
}
