"use client";

import { Fragment, useState } from "react";

import { ChangeFeed } from "./ChangeFeed";
import { usePublicQuery } from "@/lib/usePublicQuery";
// One line, deliberately: no-server-only-in-client.test.ts checks each import
// line on its own, so a type import wrapped over several lines reads as a
// runtime import of a "server-only" module.
import type { ChangeFeed as Feed } from "@/lib/turso/changes";

/**
 * Pick a day and see what DOL moved on it.
 *
 * WHY A CLIENT PICKER AND NOT A ROUTE PARAM. Reading `searchParams` in the
 * page would make `/perm-decision-activity` dynamic, and a dynamic page is a
 * server render on every visit. That is precisely the cost that took Turso to
 * 11.6 billion rows read in two days in August. The page stays static, ships
 * the newest day in its HTML, and any other day is one JSON request.
 *
 * SO THE FIRST DAY IS ALWAYS IN THE PRERENDERED HTML. `initial` is the
 * server-rendered feed and it renders before any effect runs, which means the
 * content is readable with JavaScript broken and is visible to an extractor.
 * Only a day the reader explicitly asks for is fetched.
 *
 * THE DAY LIST COMES FROM THE FEED, NOT FROM A CALENDAR. Only days carrying at
 * least one adjudication event exist, and the record is short and grows
 * nightly. A free date input would let someone pick a day that can never have
 * data and read the empty answer as "DOL did nothing", which is false. The
 * control offers the days that exist, each with its own count.
 */
export function ChangeFeedBrowser({ initial }: { initial: Feed }) {
  const [date, setDate] = useState(initial.date);
  const days = initial.availableDays;

  // The initial day is already rendered; asking for it again would be a
  // request whose answer we are holding.
  // 60 matches what the page renders for the initial day. A different cap
  // would make one day look busier than another for a reason that is ours,
  // not DOL's, and the "showing N of M" line would move for no visible cause.
  const url = date === initial.date ? "skip" : `/api/case-changes?date=${date}&limit=60`;
  const { data, failed } = usePublicQuery<{ feed: Feed | null }>(url);

  const feed = date === initial.date ? initial : data?.feed ?? null;
  const at = days.findIndex((d) => d.date === date);
  const fmt = (n: number) => n.toLocaleString("en-US");
  const longDate = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const NAV =
    "min-h-[44px] border-2 border-border bg-card px-4 font-mono text-xs font-bold uppercase tracking-wider hover:bg-tint-primary disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <label
            htmlFor="activity-day"
            className="block font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Day observed
          </label>{" "}
          <select
            id="activity-day"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 min-h-[44px] w-full min-w-0 border-2 border-border bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary sm:w-auto"
          >
            {days.map((d) => (
              <Fragment key={d.date}>
                <option value={d.date}>
                  {longDate(d.date)} — {fmt(d.total)} changes
                </option>
              </Fragment>
            ))}
          </select>
        </div>{" "}
        {/* Newer is earlier in the list, so "previous day" walks forward. */}
        <button
          type="button"
          className={NAV}
          disabled={at < 0 || at >= days.length - 1}
          onClick={() => {
            const next = days[at + 1];
            if (next) setDate(next.date);
          }}
        >
          Earlier day
        </button>{" "}
        <button
          type="button"
          className={NAV}
          disabled={at <= 0}
          onClick={() => {
            const prev = days[at - 1];
            if (prev) setDate(prev.date);
          }}
        >
          Later day
        </button>
      </div>{" "}
      {feed ? (
        <ChangeFeed feed={feed} />
      ) : failed ? (
        <p className="border-2 border-border bg-tint-primary p-4 text-base">
          That day could not be loaded just now. The other days still work, and
          reloading usually clears it.
        </p>
      ) : (
        <p className="text-base text-foreground/60">Loading that day&apos;s changes…</p>
      )}
    </div>
  );
}
