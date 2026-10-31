import { Fragment } from "react";

import { formatInt } from "@/lib/format";
import { daysBetween } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * A deadline drawn as a ruler: the date that starts the clock at one end, the
 * deadline at the other, ink for the days gone and lime for the days left,
 * today where the two meet, and the dates in between ticked and named.
 *
 * Before the reader enters a date it is drawn anyway, hatched and labelled
 * with what it will show. An embedded calculator sits on someone else's page
 * in a frame of fixed height; an empty form in a blank frame reads as
 * unfinished, and the ghost of the answer says what the form is for.
 *
 * Every date it prints comes in as an argument. The arithmetic belongs to the
 * central PERM rules, never to this file.
 */

export interface RulerMark {
  at: string;
  /** Short words that read on into the date: "File the PERM by", "PERM filed". */
  label: string;
  /** warn: a date that must not be missed; good: a date after which something is safe. */
  tone?: "ink" | "warn" | "good";
}

const short = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const TICK: Record<NonNullable<RulerMark["tone"]>, string> = {
  ink: "bg-foreground",
  warn: "bg-data-warn-ink",
  good: "bg-primary-text",
};

/** A label's anchor: centred on its tick, unless that would run off an end. */
function anchor(pct: number): string {
  if (pct < 18) return "translate-x-0";
  if (pct > 82) return "-translate-x-full";
  return "-translate-x-1/2";
}

export function DateRuler({
  from,
  to,
  fromLabel,
  toLabel,
  today,
  marks = [],
  emptyHint,
  leftWord = "left",
  className,
}: {
  /** The date that starts the clock; null until the reader enters it. */
  from: string | null;
  to: string | null;
  fromLabel: string;
  toLabel: string;
  today?: string;
  marks?: RulerMark[];
  /** Said inside the hatched bar before any date is entered. */
  emptyHint: string;
  /** "left" for a deadline; another word where the end is not a deadline. */
  leftWord?: string;
  className?: string;
}) {
  const ready = from !== null && to !== null && to >= from;
  const span = ready ? Math.max(1, daysBetween(from, to)) : 1;
  const pct = (iso: string) => (ready ? Math.min(100, Math.max(0, (daysBetween(from, iso) / span) * 100)) : 0);
  const todayPct = ready && today && today >= from ? pct(today) : null;
  const left = ready && today ? daysBetween(today, to) : null;
  const shown = ready ? marks.filter((m) => m.at >= from && m.at <= to) : [];
  const placeholder = <span aria-hidden="true" className="inline-block h-6 w-28 bg-foreground/10 align-middle" />;

  return (
    <figure className={cn("bg-tint p-4 sm:p-5 border-2 border-border", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{fromLabel}{" "}</p>{" "}
          <p className="mt-0.5 font-heading text-lg font-bold tabular-nums">{ready ? short(from) : placeholder}{" "}</p>
        </div>{" "}
        <div className="min-w-0 text-right">
          <p className="text-sm text-muted-foreground">{toLabel}{" "}</p>{" "}
          <p className="mt-0.5 font-heading text-2xl font-bold tabular-nums sm:text-3xl">{ready ? short(to) : placeholder}{" "}</p>
        </div>
      </div>{" "}

      <div aria-hidden="true" className="relative mt-4 h-10 border-input border">
        {ready ? (
          <>
            <div className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${todayPct ?? 0}%` }} />
            <div
              className="absolute inset-y-0 right-0 bg-primary"
              style={{ width: `${todayPct === null ? 100 : 100 - todayPct}%` }}
            />
            {shown.map((m) => (
              <span
                key={`${m.at}-${m.label}`}
                className={cn("absolute -bottom-2 -top-2 w-1 -translate-x-1/2", TICK[m.tone ?? "ink"])}
                style={{ left: `${pct(m.at)}%` }}
              />
            ))}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground bg-hatch">
            <span className="bg-background px-2 text-sm font-bold text-muted-foreground">{emptyHint}</span>
          </div>
        )}
      </div>{" "}

      {todayPct !== null ? (
        <div aria-hidden="true" className="relative mt-2 h-6">
          <span className={cn("absolute top-0 whitespace-nowrap text-sm font-bold", anchor(todayPct))} style={{ left: `${todayPct}%` }}>
            Today
          </span>
        </div>
      ) : null}{" "}
      {shown.length > 0 ? (
        <ul aria-label="Dates along the way" className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {shown.map((m) => (
            <Fragment key={`${m.at}-${m.label}`}>
              {" "}
              <li className="text-sm">
                <span aria-hidden="true" className={cn("mr-1.5 inline-block size-2.5 align-middle", TICK[m.tone ?? "ink"])} />
                {m.label} <span className="font-bold tabular-nums">{short(m.at)}</span>{" "}
              </li>
            </Fragment>
          ))}
        </ul>
      ) : null}{" "}

      {left !== null ? (
        <p className="mt-4 border-t-2 border-border pt-3 text-base">
          {left >= 0 ? (
            <>
              <span className="font-heading text-3xl font-bold tabular-nums">{formatInt(left)}</span>{" "}
              {left === 1 ? "day" : "days"} {leftWord}, of {formatInt(span)} in all.
            </>
          ) : (
            <>
              <span className="font-heading text-3xl font-bold tabular-nums">{formatInt(Math.abs(left))}</span>{" "}
              {Math.abs(left) === 1 ? "day" : "days"} past.
            </>
          )}
        </p>
      ) : null}
    </figure>
  );
}
