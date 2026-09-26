"use client";

import { useEffect, useId, useState } from "react";

import { monthBefore } from "@/lib/bulletinNext";
import { ordinal, type ReleaseSummary } from "@/lib/bulletinRelease";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthName(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ""} ${ym.slice(0, 4)}`;
}

function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export interface BulletinReleaseProps {
  /** From `releaseByDay`: bulletins captured by each day 1 to 31 of the month before. */
  rows: Array<{ day: number; captured: number; of: number }>;
  summary: ReleaseSummary;
  /** The bulletin the reader is waiting for, `YYYY-MM`. */
  next: string;
  /** The day the captures were measured, `YYYY-MM-DD`. */
  measured: string;
  /** Eastern date, `YYYY-MM-DD`. Read in the browser when absent, so a cached page never carries an old "today". */
  today?: string;
}

/**
 * When in the month before a bulletin has come out, as a floor: the share of
 * bulletins the Internet Archive had already captured by each day. The
 * State Department announces no date; this is the only evidence there is.
 */
export function BulletinRelease({ rows, summary, next, measured, today: todayProp }: BulletinReleaseProps) {
  const titleId = `${useId()}-release`;
  const [today, setToday] = useState<string | null>(todayProp ?? null);
  useEffect(() => {
    if (!todayProp) setToday(todayEastern());
  }, [todayProp]);

  const prior = monthBefore(next);
  const priorName = MONTHS[Number(prior.slice(5, 7)) - 1] ?? "";
  const waiting = today !== null && today.slice(0, 7) === prior;
  const todayDay = waiting ? Number(today!.slice(8, 10)) : null;
  const byToday = todayDay ? rows[Math.min(todayDay, 31) - 1] : null;

  const W = 720;
  const H = 180;
  const PAD = { l: 8, r: 8, t: 16, b: 34 };
  const bw = (W - PAD.l - PAD.r) / 31;
  const plotH = H - PAD.t - PAD.b;

  return (
    <div className="mt-4 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
      <p className="text-lg leading-relaxed">
        Of the {summary.months} bulletins the archive caught before their month began ({monthName(summary.first)} to{" "}
        {monthName(summary.last)}), half were out by the{" "}
        <b className="font-bold">{summary.halfBy ? ordinal(summary.halfBy) : "end"}</b> of the month before
        {summary.ninetyBy ? (
          <>
            , and nine in ten by the <b className="font-bold">{ordinal(summary.ninetyBy)}</b>
          </>
        ) : null}
        . The earliest came out by the {summary.earliestDay ? ordinal(summary.earliestDay) : "start"}.
      </p>{" "}
      {byToday ? (
        <p className="mt-3 border-l-4 border-primary pl-3 text-base leading-relaxed">
          Today is {priorName} {todayDay}. In at least <b className="font-bold tabular-nums">{byToday.captured}</b> of the{" "}
          {byToday.of} months with evidence, the bulletin was already out by this day of the month before, so the{" "}
          {monthName(next)} bulletin may well be up on the State Department&apos;s page.
        </p>
      ) : null}{" "}
      <div className="mt-5 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px] text-foreground" role="img" aria-labelledby={titleId}>
          <title id={titleId}>{`Share of bulletins out by each day of the month before, ${summary.months} bulletins`}</title>
          {rows.map((r, i) => {
            const h = r.of ? (plotH * r.captured) / r.of : 0;
            const isToday = todayDay === r.day;
            return (
              <rect
                key={r.day}
                x={PAD.l + i * bw + 1}
                y={H - PAD.b - h}
                width={Math.max(bw - 2, 1)}
                height={h}
                className={isToday ? "fill-primary" : "fill-foreground/75"}
              >
                <title>{`By the ${ordinal(r.day)}: ${r.captured} of ${r.of} bulletins out `}</title>
              </rect>
            );
          })}
          <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="stroke-foreground" strokeWidth={2} />
          {[1, 10, 20, 31].map((d) => (
            <text
              key={d}
              x={PAD.l + (d - 0.5) * bw}
              y={H - 10}
              fontSize={16}
              textAnchor={d === 1 ? "start" : d === 31 ? "end" : "middle"}
              className="fill-foreground"
            >{`${ordinal(d)} `}</text>
          ))}
        </svg>
      </div>{" "}
      <p className="mt-3 text-base text-foreground/75">
        Each bar is the share of those {summary.months} bulletins the Internet Archive had captured by that day of the
        month before. A capture only shows the page was up by then, so the real share is at least this high.
        {summary.setAside > 0
          ? ` ${summary.setAside} more ${summary.setAside === 1 ? "was" : "were"} first captured only after their month began, mostly because the archive didn't crawl these pages before December 2017, so they say nothing about the day and aren't counted. A bulletin published in a month's last days could be missed the same way, which makes these days read a little early.`
          : ""}{" "}
        Measured {measured}; the archive has captured no bulletin since July 2026, when the State Department began
        refusing its crawler.
      </p>
    </div>
  );
}
