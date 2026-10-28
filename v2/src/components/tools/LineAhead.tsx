import { Fragment } from "react";

import { PageSection } from "@/components/data/PageSection";
import { ChartTips } from "@/components/data/ChartTips";
import type { Lang } from "@/lib/i18n/lang";
import { intLabel, monthShortLabel } from "@/lib/i18n/format";
import type { LineAheadRow } from "@/lib/queueAhead";

import { LINE_AHEAD, type LineAheadText } from "./LineAhead.messages";

/**
 * A row's month in the reader's language. English keeps the row's own label ("September 2025",
 * "Before May 2025"); the short form elsewhere fits the label column.
 */
function rowLabel(r: LineAheadRow, lang: Lang, t: LineAheadText): string {
  if (lang === "en") return r.label;
  const before = r.key.startsWith("before:");
  const month = monthShortLabel(before ? r.key.slice("before:".length) : r.key, lang) ?? r.label;
  return before ? t.before(month) : month;
}

/**
 * The line ahead of a case in DOL's ordinary queue, month by month.
 *
 * Oct 8 2026: the case page said "and 6,891 cases in DOL's normal queue" in a
 * sentence, which a reader skims past. Drawn as a bar per filing month it
 * shows what the number is made of: almost all of it is the reader's own and
 * the month before, and a long thin tail of older cases. The rows come from
 * `lineAheadByMonth`, which splits the same count the date is built from, so
 * the bars can never add up to a different figure than the estimate uses.
 */
export function LineAhead({
  rows,
  perDay,
  lang = "en",
}: {
  rows: readonly LineAheadRow[];
  /** DOL's measured decisions per calendar day, when the pace is known. */
  perDay: number | null;
  lang?: Lang;
}) {
  const t: LineAheadText = LINE_AHEAD[lang];
  const formatInt = (x: number) => intLabel(x, lang);
  const total = rows.reduce((a, r) => a + r.n, 0);
  if (total <= 0) return null;
  const max = Math.max(...rows.map((r) => r.n));
  const days = perDay && perDay > 0 ? Math.max(1, Math.round(total / perDay)) : null;
  return (
    <PageSection
      id="line-ahead"
      title={t.title}
      aside={
        <p className="font-heading text-3xl font-bold tabular-nums">
          {formatInt(total)} <span className="text-base font-semibold">{t.cases}</span>
        </p>
      }
      lede={
        <>
          {t.lede}
          {days !== null && perDay ? t.pace(formatInt(Math.round(perDay)), formatInt(days), days) : ""}
        </>
      }
    >
      <ChartTips label={t.chartLabel}>
        <ol className="space-y-2">
          {rows.map((r) => (
            <Fragment key={r.key}>{" "}
            <li
              className="grid grid-cols-[7.75rem_minmax(0,1fr)_4rem] items-center gap-x-3"
              data-tip={`${rowLabel(r, lang, t)}${r.own ? t.ownSuffix : ""}\n${t.tipCount(formatInt(r.n))}`}
              data-href={r.key.startsWith("before:") ? undefined : `/perm-queue/${r.key}`}
            >
              <span className={`font-mono text-sm ${r.own ? "font-semibold" : "text-soft"}`}>{rowLabel(r, lang, t)}</span>{" "}
              {/* Soft colours, no black or grey (round 3, Oct 15 2026): the
                  line ahead of you soft green, your own month lime. */}
              <span className="block h-4 border border-foreground/30 bg-card" aria-hidden="true">
                <span
                  className={`block h-full border-r-2 border-foreground/50 ${r.own ? "bg-primary" : "bg-chart-green"}`}
                  style={{ width: `${Math.max(1, Math.round((r.n / max) * 100))}%` }}
                />
              </span>{" "}
              <span className="text-right font-mono text-sm tabular-nums">{formatInt(r.n)}</span>
            </li>
            </Fragment>
          ))}
        </ol>
      </ChartTips>{" "}
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {rows.some((r) => r.own) ? t.ownNote : ""}
        {t.outOfLine}
      </p>
    </PageSection>
  );
}
