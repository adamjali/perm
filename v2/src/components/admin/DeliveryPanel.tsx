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
import type { api } from "../../../convex/_generated/api";

export type Delivery = FunctionReturnType<typeof api.adminDelivery.getDelivery>;

const int = (n: number) => n.toLocaleString("en-US");
const when = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function ago(ms: number): string {
  const h = Math.floor((Date.now() - ms) / 3_600_000);
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
export function BudgetPools({ pools }: { pools: Delivery["pools"] }) {
  const refused = pools.reduce((a, p) => a + p.refusedLast7d, 0);
  return (
    <section aria-labelledby="pools-h" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
      <h2 id="pools-h" className="font-heading text-xl font-black">
        Daily email budgets
      </h2>{" "}
      {refused > 0 ? (
        <p className="mt-3 border-2 border-border bg-data-warn-ink px-4 py-3 text-base font-bold text-background">
          {`${int(refused)} ${refused === 1 ? "person was" : "people were"} turned away by a full budget in the last 7 days. Resend Pro ($20 a month, 50,000 emails, no daily cap) would have sent every one.`}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No one has been turned away in the last 7 days. The free plan is holding.</p>
      )}
      <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
        {pools.map((p) => {
          const share = Math.min(1, p.usedLast24h / p.limit);
          const full = p.usedLast24h >= p.limit;
          return (
            <li key={p.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold">{p.label}</span>{" "}
                <span className="text-sm tabular-nums">
                  <span className="font-heading text-base font-black">{int(p.usedLast24h)}</span>
                  {` of ${int(p.limit)}`}
                </span>
              </div>{" "}
              <div className="mt-1.5 h-3 w-full border-2 border-border bg-background" role="img" aria-label={`${p.usedLast24h} of ${p.limit} used in the last 24 hours`}>
                <div className={`h-full ${full ? "bg-destructive" : "bg-foreground"}`} style={{ width: `${share * 100}%` }} />
              </div>{" "}
              {p.refusedLast7d > 0 ? (
                <p className="mt-1 text-xs font-bold text-destructive">{`${int(p.refusedLast7d)} turned away this week`}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">
        Rolling 24 hours, counted from the same limits the senders enforce. Resend&apos;s free plan allows 100 a day across all of these plus sign-in mail.
      </p>
    </section>
  );
}

function Figure({ value, label, tone }: { value: string; label: string; tone?: "warn" }) {
  return (
    <div className={`border-2 border-border p-3 ${tone === "warn" ? "bg-data-warn-ink text-background" : "bg-background"}`}>
      <p className="font-heading text-2xl font-black tabular-nums">{value}</p>{" "}
      <p className={`text-xs font-semibold ${tone === "warn" ? "" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}

export function DeliveryPanel({ data }: { data: Delivery }) {
  const w = data.outbox.last7d;
  // Read the clock once at mount; a render must not call it (react-hooks/purity).
  const [now] = useState(() => Date.now());
  const stale = data.outbox.oldestQueuedAt !== null && now - data.outbox.oldestQueuedAt > 26 * 3_600_000;
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
          <Figure value={int(w.emails)} label="emails sent" />
          <Figure value={int(w.items)} label="alerts inside them" />
          <Figure value={int(w.bundles)} label="bundled emails" />
          <Figure value={int(data.outbox.queued)} label={data.outbox.oldestQueuedAt ? `waiting, oldest ${ago(data.outbox.oldestQueuedAt)}` : "waiting"} tone={stale ? "warn" : undefined} />
          <Figure value={int(w.failed)} label="gave up after 6 tries" tone={w.failed > 0 ? "warn" : undefined} />
          <Figure value={int(w.dropped)} label="dropped by an opt-out" />
        </div>{" "}
        <p className="mt-3 text-sm">
          {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[])
            .map((k) => `${KIND_LABEL[k]} ${int(w.byKind[k])}`)
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
          <div className="mt-3 overflow-x-auto border-2 border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 font-bold">{"When "}</th>
                  <th className="px-3 py-2 font-bold">{"To "}</th>
                  <th className="px-3 py-2 font-bold">{"What "}</th>
                  <th className="px-3 py-2 font-bold">{"State "}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={`${r.email}-${r.createdAt}-${i}`} className="border-t-2 border-border align-top">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{`${when(r.sentAt ?? r.createdAt)} `}</td>
                    <td className="px-3 py-2">{`${r.email} `}</td>
                    <td className="px-3 py-2">
                      <span className="font-bold">{`${KIND_LABEL[r.kind]}: ${r.title}`}</span>{" "}
                      <span className="block text-muted-foreground">{`${r.line} `}</span>
                      {r.lastError ? <span className="block text-xs text-destructive">{`${r.lastError} `}</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`px-1.5 py-0.5 text-xs font-bold ${STATUS_CLASS[r.status] ?? ""}`}>{r.status}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {r.direct ? "straight out" : r.bundleSize && r.bundleSize > 1 ? `in a bundle of ${r.bundleSize}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>{" "}

      <section aria-labelledby="follows-h" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 id="follows-h" className="font-heading text-xl font-black">
          Employer follows
        </h2>{" "}
        <div className="mt-3 grid grid-cols-3 gap-3 sm:max-w-md">
          <Figure value={int(data.follows.confirmed)} label="following" />
          <Figure value={int(data.follows.pending)} label="not confirmed" />
          <Figure value={int(data.follows.unsubscribed)} label="stopped" />
        </div>{" "}
        {data.follows.top.length > 0 ? (
          <ol className="mt-4 divide-y-2 divide-border border-y-2 border-border">
            {data.follows.top.map((f) => (
              <li key={f.slug} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <Link href={`/perm-employers/${f.slug}`} className="font-bold underline decoration-primary decoration-2 underline-offset-2">
                  {f.name}
                </Link>{" "}
                <span className="tabular-nums">{`${int(f.followers)} following`}</span>
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
