import Link from "next/link";
import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { formatInt } from "@/lib/format";
import type { WarnNotice } from "@/lib/db/warn";

/**
 * The notices matched to a sponsor, drawn two ways before the table: by the
 * state that published them, and by the sponsors whose notices named the
 * most employees. The page had opened on three counts and a 491-row table.
 *
 * NOT BY MONTH. The four states publish different windows (New York's list is
 * the current year, Texas's portal reaches back to 2019), so a month-by-month
 * chart climbs where coverage begins and reads as a wave of layoffs that isn't
 * one. Each state's bar says the dates its notices span instead.
 *
 * Employees are as each state printed them; a notice that printed none adds
 * to the counts and nothing to the employees.
 */

const SPONSORS_DRAWN = 8;

const STATE_NAME: Record<string, string> = { CA: "California", NY: "New York", TX: "Texas", WA: "Washington" };

const monthShort = (d: string) =>
  new Date(`${d.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export function WarnOverview({ rows }: { rows: WarnNotice[] }) {
  if (rows.length === 0) return null;
  const byState = new Map<string, { notices: number; employees: number; first: string; last: string }>();
  for (const r of rows) {
    const b = byState.get(r.state) ?? { notices: 0, employees: 0, first: r.noticeDate, last: r.noticeDate };
    b.notices += 1;
    b.employees += r.employees ?? 0;
    if (r.noticeDate < b.first) b.first = r.noticeDate;
    if (r.noticeDate > b.last) b.last = r.noticeDate;
    byState.set(r.state, b);
  }
  const states = [...byState].sort((a, b) => b[1].employees - a[1].employees);
  const maxState = Math.max(1, ...states.map(([, b]) => b.employees));

  // One row per sponsor page, named by the spelling its notices use most.
  const bySponsor = new Map<string, { slug: string; names: Map<string, number>; notices: number; employees: number }>();
  for (const r of rows) {
    if (!r.employerSlug) continue;
    const s = bySponsor.get(r.employerSlug) ?? { slug: r.employerSlug, names: new Map(), notices: 0, employees: 0 };
    s.names.set(r.company, (s.names.get(r.company) ?? 0) + 1);
    s.notices += 1;
    s.employees += r.employees ?? 0;
    bySponsor.set(r.employerSlug, s);
  }
  const top = [...bySponsor.values()]
    .sort((a, b) => b.employees - a.employees || b.notices - a.notices)
    .slice(0, SPONSORS_DRAWN)
    .map((s) => ({ ...s, name: [...s.names].sort((a, b) => b[1] - a[1])[0]![0] }));
  const maxTop = Math.max(1, ...top.map((s) => s.employees));

  return (
    <section aria-labelledby="warn-overview" className="mt-10 grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-2">
      <h2 id="warn-overview" className="sr-only">
        The notices, by month and by sponsor
      </h2>{" "}
      <figure className="m-0 bg-tint p-5 sm:p-6">
        <figcaption>
          <span className="block font-heading text-xl font-bold">By the state that published them</span>{" "}
          <span className="mt-1 block text-sm text-muted-foreground">
            Each state publishes its own window, so each bar says the dates its notices span.
          </span>
        </figcaption>{" "}
        <ChartTips label="Employees named in sponsors' layoff notices, by state" className="mt-5">
          <ol className="space-y-3">
            {states.map(([st, b]) => (
              <Fragment key={st}>
                <li
                  data-tip={`${STATE_NAME[st] ?? st}\n${formatInt(b.notices)} ${b.notices === 1 ? "notice" : "notices"}\n${formatInt(b.employees)} employees\n${monthShort(b.first)} to ${monthShort(b.last)}`}
                  className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_4.5rem] items-center gap-3 [&>*]:min-w-0"
                >
                  <span className="text-sm">
                    <span className="block font-bold">{STATE_NAME[st] ?? st}</span>{" "}
                    <span className="block text-muted-foreground">
                      {monthShort(b.first)} to {monthShort(b.last)}
                    </span>
                  </span>{" "}
                  <span aria-hidden="true" className="block h-5">
                    <span
                      className="block h-full border border-input bg-data-warn-ink"
                      style={{ width: `${Math.max(3, (b.employees / maxState) * 100)}%` }}
                    />
                  </span>{" "}
                  <span className="text-right text-sm font-bold tabular-nums">{formatInt(b.employees)}</span>
                </li>{" "}
              </Fragment>
            ))}
          </ol>
        </ChartTips>
      </figure>{" "}
      <figure className="m-0 bg-tint p-5 sm:p-6">
        <figcaption>
          <span className="block font-heading text-xl font-bold">The sponsors whose notices named the most</span>{" "}
          <span className="mt-1 block text-sm text-muted-foreground">Every notice held, each sponsor by its own page.</span>
        </figcaption>{" "}
        <ChartTips label="Sponsors by employees named in their layoff notices" className="mt-5">
          <ol className="space-y-2">
            {top.map((s) => (
              <Fragment key={s.slug}>
                <li
                  data-tip={`${s.name}\n${formatInt(s.notices)} ${s.notices === 1 ? "notice" : "notices"}\n${formatInt(s.employees)} employees`}
                  className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4.5rem] items-center gap-3 [&>*]:min-w-0"
                >
                  <Link
                    href={`/perm-employers/${s.slug}`}
                    className="link truncate text-sm"
                  >
                    {s.name}
                  </Link>{" "}
                  <span aria-hidden="true" className="block h-5">
                    <span
                      className="block h-full border border-input bg-data-warn-ink"
                      style={{ width: `${Math.max(3, (s.employees / maxTop) * 100)}%` }}
                    />
                  </span>{" "}
                  <span className="text-right text-sm font-bold tabular-nums">{formatInt(s.employees)}</span>
                </li>{" "}
              </Fragment>
            ))}
          </ol>
        </ChartTips>
      </figure>
    </section>
  );
}
