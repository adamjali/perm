"use client";

/**
 * Alert email on the admin page: the daily budgets, the outbox, what went
 * out, and who follows which employer. Data from `adminDelivery.getDelivery`.
 *
 * The budget pools lead because they answer the operational question: is it
 * time to move off Resend's free plan. A pool that turned anyone away in the
 * last week says yes, loudly, at the top.
 */

import Link from "next/link";
import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { formatInt } from "@/lib/format";
import { EASTERN_TIMEZONE, MS_PER_HOUR } from "@/lib/time";
import type { api } from "@convex/_generated/api";
import { between } from "./elapsed";

export type Delivery = FunctionReturnType<typeof api.adminDelivery.getDelivery>;

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function ago(ms: number): string {
  const h = Math.floor((Date.now() - ms) / MS_PER_HOUR);
  if (h < 1) return "under an hour";
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${Math.floor(h / 24)} days`;
}

const KIND_LABEL = { case: "Case status", queue: "Queue month", bulletin: "Visa bulletin", employer: "Employer" } as const;

const STATUS_CLASS: Record<string, string> = {
  sent: "bg-primary text-primary-foreground",
  queued: "bg-data-warn-ink text-background",
  failed: "bg-destructive text-background",
  dropped: "bg-muted text-foreground",
};

/** Every pool as a row: label, a usage bar against the ceiling, the numbers. */
export function BudgetPools({
  pools,
  queue,
  day,
}: {
  pools: Delivery["pools"];
  queue?: Delivery["confirmationQueue"];
  day?: Delivery["emailDay"];
}) {
  const refused = pools.reduce((a, p) => a + p.refusedLast7d, 0);
  const waited = pools.reduce((a, p) => a + p.queuedLast7d, 0);
  return (
    <section aria-labelledby="pools-h" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
      <h2 id="pools-h" className="font-heading text-xl font-black">
        Daily email budgets
      </h2>{" "}
      {refused > 0 ? (
        <p className="mt-3 border-2 border-border bg-data-warn-ink px-4 py-3 text-base font-bold text-background">
          {`${formatInt(refused)} ${refused === 1 ? "person was" : "people were"} turned away in the last 7 days: the queue was full or a request waited more than seven days.`}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No one has been turned away in the last 7 days.</p>
      )}{" "}
      {waited > 0 ? (
        <p className="mt-2 text-sm font-bold">
          {`${formatInt(waited)} confirmation${waited === 1 ? "" : "s"} waited in the queue this week because a pool was full. The queue sends them as soon as Resend's count for the day leaves room.`}
        </p>
      ) : null}{" "}
      {day ? (
        <p className="mt-3 text-sm">
          <span className="font-bold">{`Today: ${formatInt(day.used)} of ${formatInt(day.cap)} sent.`}</span>{" "}
          {`List mail stops at ${formatInt(day.listCeiling)}; the rest is kept for sign-in codes. Resend's day resets at 8 PM Eastern in summer.`}
          {day.retrying > 0
            ? ` ${formatInt(day.retrying)} failed ${day.retrying === 1 ? "email is" : "emails are"} waiting to retry${day.oldestRetryAt ? `, the oldest since ${new Date(day.oldestRetryAt).toLocaleString("en-US", { timeZone: EASTERN_TIMEZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} Eastern` : ""}.`
            : ""}
          {day.lostToday > 0 ? ` ${formatInt(day.lostToday)} given up on today.` : ""}
        </p>
      ) : null}{" "}
      {queue && queue.waiting > 0 ? (
        <p className="mt-2 border-2 border-border bg-background px-4 py-3 text-sm font-bold">
          {`${formatInt(queue.waiting)} waiting now${queue.oldestQueuedAt ? `, the oldest since ${new Date(queue.oldestQueuedAt).toLocaleString("en-US", { timeZone: EASTERN_TIMEZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} Eastern` : ""}.`}
        </p>
      ) : null}
      <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
        {pools.map((p) => {
          const share = Math.min(1, p.usedLast24h / p.limit);
          const full = p.usedLast24h >= p.limit;
          return (
            <li key={p.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold">{p.label}</span>{" "}
                <span className="text-sm tabular-nums">
                  <span className="font-heading text-base font-black">{formatInt(p.usedLast24h)}</span>
                  {` of ${formatInt(p.limit)}`}
                </span>
              </div>{" "}
              <div className="mt-1.5 h-3 w-full border-2 border-border bg-background" role="img" aria-label={`${p.usedLast24h} of ${p.limit} used in the last 24 hours`}>
                <div className={`h-full ${full ? "bg-destructive" : "bg-foreground"}`} style={{ width: `${share * 100}%` }} />
              </div>{" "}
              {p.refusedLast7d > 0 ? (
                <p className="mt-1 text-sm font-bold text-destructive">{`${formatInt(p.refusedLast7d)} turned away this week`}</p>
              ) : null}{" "}
              {p.queuedLast7d > 0 ? (
                <p className="mt-1 text-sm">{`${formatInt(p.queuedLast7d)} queued this week`}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted-foreground">
        Each pool is a rolling 24-hour bound on one kind of email, counted from the same limits the senders enforce. The day&apos;s total is guarded by Resend&apos;s own count, shown above; a request either one holds back waits in a queue.
      </p>
    </section>
  );
}

function Figure({ value, label, tone }: { value: string; label: string; tone?: "warn" }) {
  return (
    <div className={`border-2 border-border p-3 ${tone === "warn" ? "bg-data-warn-ink text-background" : "bg-background"}`}>
      <p className="font-heading text-2xl font-black tabular-nums">{value}</p>{" "}
      <p className={`text-sm font-semibold ${tone === "warn" ? "" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}

export function DeliveryPanel({ data }: { data: Delivery }) {
  const w = data.outbox.last7d;
  // Read the clock once at mount; a render must not call it (react-hooks/purity).
  const [now] = useState(() => Date.now());
  const stale = data.outbox.oldestQueuedAt !== null && now - data.outbox.oldestQueuedAt > 26 * MS_PER_HOUR;
  return (
    <div className="space-y-8">
      <section aria-labelledby="outbox-h" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 id="outbox-h" className="font-heading text-xl font-black">
          Alert delivery, last 7 days
        </h2>{" "}
        <p className="mt-1 text-sm text-muted-foreground">
          One email per person per day at most. Several updates for one person wait in the outbox and go out together.
        </p>{" "}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Figure value={formatInt(w.emails)} label="emails sent" />
          <Figure value={formatInt(w.items)} label="alerts inside them" />
          <Figure value={formatInt(w.bundles)} label="bundled emails" />
          <Figure value={formatInt(data.outbox.queued)} label={data.outbox.oldestQueuedAt ? `waiting, oldest ${ago(data.outbox.oldestQueuedAt)}` : "waiting"} tone={stale ? "warn" : undefined} />
          <Figure value={formatInt(w.failed)} label="gave up after 6 tries" tone={w.failed > 0 ? "warn" : undefined} />
          <Figure value={formatInt(w.dropped)} label="dropped by an opt-out" />
        </div>{" "}
        <p className="mt-3 text-sm">
          {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[])
            .map((k) => `${KIND_LABEL[k]} ${formatInt(w.byKind[k])}`)
            .join(", ")}
        </p>
      </section>{" "}

      <section aria-labelledby="recent-h">
        <h2 id="recent-h" className="font-heading text-xl font-black">
          Latest alerts
        </h2>{" "}
        {data.recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No alert email recorded in the last 7 days. The outbox has recorded
            sends since 26 September 2026; anything sent before that isn&apos;t
            listed here.
          </p>
        ) : (
          <>
          {(data.recentTotal ?? 0) > data.recent.length ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {`The newest ${formatInt(data.recent.length)} of ${formatInt(data.recentTotal ?? 0)} in the last 7 days.`}
            </p>
          ) : null}
          <div className="mt-3 overflow-x-auto border-2 border-border">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 font-bold">{"Sent "}</th>
                  <th className="px-3 py-2 font-bold">{"Signed up "}</th>
                  <th className="px-3 py-2 font-bold">{"To "}</th>
                  <th className="px-3 py-2 font-bold">{"What "}</th>
                  <th className="px-3 py-2 font-bold">{"State "}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={`${r.email}-${r.createdAt}-${i}`} className="border-t-2 border-border align-top">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{`${when(r.sentAt ?? r.createdAt)} `}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {r.signedUpAt ? (
                        <>
                          {when(r.signedUpAt)}{" "}
                          <span className="block text-sm text-muted-foreground">
                            {`${between(r.signedUpAt, r.sentAt ?? r.createdAt)} before${r.confirmedAt ? `, confirmed after ${between(r.signedUpAt, r.confirmedAt)}` : ", never confirmed"}`}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">subscription removed</span>
                      )}{" "}
                    </td>
                    <td className="px-3 py-2 [overflow-wrap:anywhere]">{`${r.email} `}</td>
                    <td className="px-3 py-2">
                      <span className="font-bold">{`${KIND_LABEL[r.kind]}: ${r.title}`}</span>{" "}
                      <span className="block text-muted-foreground">{`${r.line} `}</span>
                      {r.lastError ? <span className="block text-sm text-destructive">{`${r.lastError} `}</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`px-1.5 py-0.5 text-sm font-bold ${STATUS_CLASS[r.status] ?? ""}`}>{r.status}</span>{" "}
                      <span className="text-sm text-muted-foreground">
                        {r.direct ? "straight out" : r.bundleSize && r.bundleSize > 1 ? `in a bundle of ${r.bundleSize}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>{" "}

      <section aria-labelledby="follows-h" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 id="follows-h" className="font-heading text-xl font-black">
          Employer follows
        </h2>{" "}
        <div className="mt-3 grid grid-cols-3 gap-3 sm:max-w-md">
          <Figure value={formatInt(data.follows.confirmed)} label="following" />
          <Figure value={formatInt(data.follows.pending)} label="not confirmed" />
          <Figure value={formatInt(data.follows.unsubscribed)} label="stopped" />
        </div>{" "}
        {(data.follows.employers ?? 0) > data.follows.top.length ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {`The ${formatInt(data.follows.top.length)} most-followed of ${formatInt(data.follows.employers ?? 0)} employers.`}
          </p>
        ) : null}{" "}
        {data.follows.top.length > 0 ? (
          <ol className="mt-4 divide-y-2 divide-border border-y-2 border-border">
            {data.follows.top.map((f) => (
              <li key={f.slug} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <Link href={`/perm-employers/${f.slug}`} className="min-w-0 font-bold underline decoration-primary-text decoration-2 underline-offset-2 [overflow-wrap:anywhere]">
                  {f.name}
                </Link>{" "}
                <span className="tabular-nums">{`${formatInt(f.followers)} following`}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No one follows an employer yet. The form is on every employer page.</p>
        )}
      </section>
    </div>
  );
}
