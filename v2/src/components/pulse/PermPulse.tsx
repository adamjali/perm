import { Fragment } from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react/ssr";

import { ChartTips } from "@/components/data/ChartTips";
import { federalHolidayName } from "@/lib/perm";
import type { ActivityDay } from "@/lib/activityStats";
import { type ClosedDay, certifiedShare, lastDays, pulseHeadline, pulseSummary, recentWeekdays } from "@/lib/pulseStats";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";
import { checkedLabel } from "@/lib/time";

/**
 * PERM decisions, day by day: DOL's last working day under our check (a
 * weekend or a federal holiday after it is named, never led with), the 30
 * days before it, and the shape of a week.
 *
 * Every figure is a count of DOL's own decisions, dated by the day DOL worked:
 * the day our sweep saw them change, or the day before when it saw them before
 * 7 AM Eastern (src/lib/dolDay.ts); nothing is modelled.
 *
 * THE BARS ARE HTML, NOT SVG. SVG text scales with its viewBox, and this
 * repo measured 13px labels rendering at 5.5px in a phone column. Divs keep
 * every label at its CSS size at any width, and a screen-reader table carries
 * the same numbers the bars draw.
 *
 * Server component: it renders once per regeneration, and the sweep expires
 * the pages it sits on when it finishes (/api/revalidate-sweep).
 */

const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function weekdayLong(iso: string): string {
  return WEEKDAY_LONG[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7]!;
}

function dayLabel(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

/** "Monday, Oct 12 was Columbus Day, a federal holiday: DOL was closed." */
function closedSentence(closed: readonly ClosedDay[]): string {
  return closed
    .map((c) => `${dayLabel(c.date, { weekday: "long", month: "short", day: "numeric" })} was ${c.name}, a federal holiday: DOL was closed.`)
    .join(" ");
}

export interface PermPulseProps {
  /** `sweep-observed` days, any order. Eight weeks covers the comparison and the bars. */
  days: readonly ActivityDay[];
  /** When the sweep last wrote its coverage record, epoch ms. */
  checkedAt: number | null;
  /** Link through to the full record (off on the page that IS the full record). */
  showLink?: boolean;
  /**
   * "band" fills a full-width band; "block" sits inside a page's column;
   * "charts" is the two figures alone, for a band that already names the day
   * (the homepage board carries the day's number, so the band shows its shape).
   */
  variant?: "band" | "block" | "charts";
  className?: string;
}

export function PermPulse({ days, checkedAt, showLink = true, variant = "band", className }: PermPulseProps) {
  const head = pulseHeadline(days);
  if (!head) return null;
  const { day, changePct, typical, closedAfter } = head;
  const bars = lastDays(days, 30);
  const lastBar = bars[bars.length - 1]!;
  const holidayOf = new Map(bars.flatMap((b) => {
    const name = federalHolidayName(b.date);
    return name ? [[b.date, name] as const] : [];
  }));
  const week = recentWeekdays(days, 4);
  const max = Math.max(1, ...bars.map((b) => b.total));
  const weekMax = Math.max(1, ...week.map((w) => w.mean));
  const share = certifiedShare(day);
  const weekday = weekdayLong(day.date);
  const up = changePct !== null && changePct >= 0;
  const summary = pulseSummary(days);
  const summaryFigures = summary
    ? [
        { label: "Last 7 days", value: formatInt(summary.last7) },
        { label: "Last 30 days", value: formatInt(summary.last30) },
        { label: "A typical weekday", value: summary.weekdayAvg === null ? null : formatInt(summary.weekdayAvg) },
        { label: "Certified, last 30 days", value: summary.certifiedPct === null ? null : `${summary.certifiedPct}%` },
      ].filter((f): f is { label: string; value: string } => f.value !== null)
    : [];

  const body = (
    <div className={cn(variant === "band" ? "mx-auto max-w-[1400px] px-4 py-12 sm:px-8 sm:py-14" : "", className)}>
      {variant === "charts" ? null : (
      <>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <h2 id="pulse-heading" className="font-heading text-3xl font-bold sm:text-4xl">
          PERM decisions, day by day
        </h2>{" "}
        {checkedAt ? (
          <p className="text-sm text-muted-foreground">
            Checked against DOL {checkedLabel(checkedAt)}
          </p>
        ) : null}
      </div>{" "}

      {/* The day. One dominant figure, then its split. */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4 [&>*]:min-w-0">
        <div className="dark col-span-2 p-5 sm:p-6 border-2 shadow-hard border-black bg-[#141414] text-foreground">
          <p className="text-sm text-soft">
            Decided on {weekday}, {dayLabel(day.date, { month: "short", day: "numeric" })}
          </p>{" "}
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
            <p className="font-heading text-6xl font-bold leading-none tabular-nums">
              {formatInt(day.total)}
            </p>{" "}
            {changePct !== null && typical !== null ? (
              <p
                className="mb-1 inline-flex items-center gap-1.5 bg-card px-2 py-1 text-sm font-semibold"
              >
                {up ? (
                  <ArrowUpIcon className="size-4 text-data-good-ink" weight="bold" aria-hidden="true" />
                ) : (
                  <ArrowDownIcon className="size-4 text-muted-foreground" weight="bold" aria-hidden="true" />
                )}
                {`${up ? "+" : "−"}${Math.abs(changePct)}% vs a typical ${weekday} (${formatInt(typical)})`}
              </p>
            ) : null}
          </div>{" "}
          {closedAfter.length > 0 ? (
            <p className="mt-3 text-sm text-soft">{closedSentence(closedAfter)}</p>
          ) : null}
        </div>{" "}
        <div className="p-5 border-2 shadow-hard-sm bg-card border-border">
          <p className="text-sm text-muted-foreground">Certified</p>{" "}
          <p className="mt-2 font-heading text-4xl font-bold leading-none tabular-nums">{formatInt(day.certified)}</p>{" "}
          {share !== null ? <p className="mt-2 text-sm text-muted-foreground">{share}% of the day</p> : null}
        </div>{" "}
        {/* Two labelled numbers, never "62 · 21": a reader should not have to
            guess which figure is which. */}
        <dl className="m-0 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:gap-4 [&>*]:min-w-0 border-2 shadow-hard-sm bg-card border-border">
          <div>
            <dt className="text-sm text-muted-foreground">Denied</dt>{" "}
            <dd className="m-0 mt-1 font-heading text-3xl font-bold leading-none tabular-nums sm:mt-2">{formatInt(day.denied)}</dd>
          </div>{" "}
          <div>
            <dt className="text-sm text-muted-foreground">Withdrawn</dt>{" "}
            <dd className="m-0 mt-1 font-heading text-3xl font-bold leading-none tabular-nums sm:mt-2">{formatInt(day.withdrawn)}</dd>
          </div>
        </dl>
      </div>{" "}

      </>
      )}{" "}
      {/* The numbers first: what a reader wants before reading any chart. */}
      <dl className={cn("m-0 grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4 [&>*]:min-w-0", variant !== "charts" ? "mt-8" : "mt-8")}>
        {summaryFigures.map((f) => (
          <Fragment key={f.label}>
            {" "}
            <div>
              <dt className="text-sm text-muted-foreground">{f.label}</dt>{" "}
              <dd className="m-0 mt-1 font-heading text-3xl font-bold leading-none tabular-nums">{f.value}</dd>
            </div>
          </Fragment>
        ))}
      </dl>{" "}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        {/* Thirty days. Weekends sit low because DOL decides little then.
            Withdrawn is the employer's own step, so it takes the withdrawn
            purple the status chips use (Oct 27 2026; no grey marks). */}
        <figure className="m-0 bg-card p-5 lg:col-span-2 border-2 shadow-hard-sm border-border">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <span className="text-base font-semibold">The last {bars.length} days</span>{" "}
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-soft">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 bg-data-good-ink" />
                Certified
              </span>{" "}
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 bg-data-bad-ink" />
                Denied
              </span>{" "}
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 bg-chart-purple" />
                Withdrawn
              </span>
            </span>
          </figcaption>{" "}
          <div className="mt-4 flex items-baseline justify-between text-sm tabular-nums text-muted-foreground">
            <span>{formatInt(max)}</span>
          </div>
          <ChartTips label="Decisions per day, the last 30 days">
          <div
            className="flex h-40 items-end gap-[2px] border-b-2 border-l-2 border-border pl-px sm:h-48"
            role="img"
            aria-label={`Decisions per day, ${dayLabel(bars[0]!.date, { month: "long", day: "numeric" })} to ${dayLabel(lastBar.date, { month: "long", day: "numeric" })}, from ${formatInt(Math.min(...bars.map((b) => b.total)))} to ${formatInt(max)} a day.`}
          >
            {bars.map((b) => (
              <div
                key={b.date}
                data-href={`/perm-decision-activity?day=${b.date}#day`}
                data-tip={`${dayLabel(b.date, { weekday: "short", month: "short", day: "numeric" })}\n${formatInt(b.total)} decided\n${formatInt(b.certified)} certified\n${formatInt(b.denied)} denied\n${formatInt(b.withdrawn)} withdrawn${holidayOf.has(b.date) ? `\n${holidayOf.get(b.date)}: DOL closed` : ""}`}
                className={cn("flex flex-1 flex-col-reverse", b.date === day.date && "outline outline-2 outline-offset-1 outline-foreground")}
                style={{ height: `${(b.total / max) * 100}%` }}
              >
                <div className="bg-data-good-ink" style={{ height: `${b.total ? (b.certified / b.total) * 100 : 0}%` }} />
                <div className="bg-data-bad-ink" style={{ height: `${b.total ? (b.denied / b.total) * 100 : 0}%` }} />
                <div className="bg-chart-purple" style={{ height: `${b.total ? (b.withdrawn / b.total) * 100 : 0}%` }} />
              </div>
            ))}
          </div>
          </ChartTips>{" "}
          <div className="mt-2 flex justify-between text-sm tabular-nums text-muted-foreground">
            <span>{dayLabel(bars[0]!.date, { month: "short", day: "numeric" })}</span>{" "}
            <span>{dayLabel(lastBar.date, { month: "short", day: "numeric" })}</span>
          </div>
        </figure>{" "}

        {/* The shape of a week, over the last four: working days in the
            decided green, the weekend in sage, each with a darker cap so the
            soft fill still reads against the card. */}
        <figure className="m-0 bg-card p-5 border-2 shadow-hard-sm border-border">
          <figcaption className="text-base font-semibold">A typical week</figcaption>{" "}
          <ChartTips label="Average decisions by day of the week">
          <div className="mt-4 flex h-40 items-end gap-2 sm:h-48" role="img" aria-label="Average decisions by day of the week over the last four weeks.">
            {week.map((w) => (
              <div
                key={w.label}
                data-tip={w.days ? `${WEEKDAY_LONG[w.weekday]}\nAbout ${formatInt(w.mean)} decided\nAverage of the last ${w.days} ${WEEKDAY_LONG[w.weekday]}s` : `${WEEKDAY_LONG[w.weekday]}\nNone on record yet`}
                className="flex h-full flex-1 flex-col justify-end text-center"
              >
                <span className="mb-1 text-sm font-semibold tabular-nums">{w.days ? formatInt(w.mean) : ""}</span>{" "}
                <div
                  className={cn(w.days && "border-t-2 border-data-good-ink", w.weekday >= 5 ? "bg-chart-sage" : "bg-chart-green")}
                  style={{ height: w.days ? `${Math.max(2, (w.mean / weekMax) * 100)}%` : "0" }}
                />
              </div>
            ))}
          </div>
          </ChartTips>{" "}
          <div className="mt-2 flex gap-2 text-center text-sm text-muted-foreground">
            {week.map((w) => (
              <Fragment key={w.label}>
                <span className="flex-1">{w.label.slice(0, 2)}</span>{" "}
              </Fragment>
            ))}
          </div>
        </figure>
      </div>{" "}

      {/* sr-only on a <table> can't shrink it below its content; a div can. */}
      <div className="sr-only">
        <table>
          <caption>PERM decisions per day, from DOL&apos;s case status</caption>
          <thead>
            <tr>
              <th scope="col">Date{" "}</th>
              <th scope="col">Decided{" "}</th>
              <th scope="col">Certified{" "}</th>
              <th scope="col">Denied{" "}</th>
              <th scope="col">Withdrawn{" "}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.date}>
                <td>{b.date}{" "}</td>
                <td>{b.total}{" "}</td>
                <td>{b.certified}{" "}</td>
                <td>{b.denied}{" "}</td>
                <td>{b.withdrawn}{" "}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>{" "}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-sm text-muted-foreground">
          Counted from DOL&apos;s own case status, by the day DOL worked: a change our check saw before 7 AM counts on the day before.
        </p>{" "}
        {showLink ? (
          <Link href="/perm-decision-activity" className="link inline-flex min-h-11 items-center">
            Every day, and every case that moved
          </Link>
        ) : null}
      </div>
    </div>
  );

  if (variant === "charts") return body;
  return variant === "band" ? (
    <section aria-labelledby="pulse-heading" className="border-b-2 border-border bg-background">
      {body}
    </section>
  ) : (
    <section aria-labelledby="pulse-heading">{body}</section>
  );
}
