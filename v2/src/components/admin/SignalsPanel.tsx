"use client";

/**
 * The growth signals, split by what the admin is looking for: every alert
 * subscription (searchable, one collapsible list per kind), the latest
 * signups and in-app cases, and the weekly digest. Data from
 * `adminSignals.getSignals`, read once by the dashboard and handed down.
 *
 * Exists because the first genuine alert subscriber appeared (2026-08-28)
 * and finding out took a database query. What "searched" data is NOT here
 * is deliberate: public lookups redact case numbers from analytics, so
 * there is no per-visitor search log to display - see adminSignals.ts.
 *
 * Reworked Sep 26 2026: it was one long card that grew with every
 * subscriber. The lists now collapse, show ten rows until asked for more,
 * and one search box filters all of them.
 */

import { useMemo, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type Signals = FunctionReturnType<typeof api.adminSignals.getSignals>;
type Sub = Signals["subscriptions"]["caseAlerts"][number];

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const STATUS_CLASS: Record<string, string> = {
  confirmed: "bg-primary text-primary-foreground",
  pending: "bg-muted text-foreground",
  unsubscribed: "bg-destructive/15 text-destructive",
};

const SHOWN = 10;

function SubList({ title, rows, open }: { title: string; rows: Sub[]; open: boolean }) {
  const [all, setAll] = useState(false);
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const shown = all ? rows : rows.slice(0, SHOWN);
  return (
    <details open={open} className="border-2 border-border bg-card">
      <summary className="flex min-h-[48px] cursor-pointer flex-wrap items-center gap-x-3 px-4 py-2">
        <span className="font-bold">{title}</span>{" "}
        <span className="text-sm tabular-nums text-muted-foreground">{`${confirmed} confirmed of ${rows.length}`}</span>
      </summary>
      {rows.length === 0 ? (
        <p className="border-t-2 border-border px-4 py-3 text-sm text-muted-foreground">None match.</p>
      ) : (
        <ul className="divide-y divide-border border-t-2 border-border">
          {shown.map((r, i) => (
            <li key={`${r.email}-${r.subject}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
              <span className="font-medium">{r.email}</span>{" "}
              <span className="text-muted-foreground">{r.subject}</span>{" "}
              <span className={`px-1.5 py-0.5 text-xs font-bold ${STATUS_CLASS[r.status] ?? ""}`}>{r.status}</span>{" "}
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {when(r.createdAt)}
                {r.lastNotifiedAt ? `, alerted ${when(r.lastNotifiedAt)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > SHOWN ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="min-h-[44px] w-full border-t-2 border-border px-4 text-left text-sm font-bold hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {all ? "Show the first 10" : `Show all ${rows.length}`}
        </button>
      ) : null}
    </details>
  );
}

export function SubscriptionsPanel({ signals }: { signals: Signals }) {
  const [q, setQ] = useState("");
  const lists = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = (rows: Sub[]) =>
      needle ? rows.filter((r) => r.email.toLowerCase().includes(needle) || r.subject.toLowerCase().includes(needle)) : rows;
    const s = signals.subscriptions;
    return [
      { title: "Case status alerts", rows: f(s.caseAlerts) },
      { title: "Employer follows", rows: f(s.employerAlerts) },
      { title: "Queue month alerts", rows: f(s.queueAlerts) },
      { title: "Visa bulletin alerts", rows: f(s.bulletinAlerts) },
      { title: "Product news", rows: f(s.news) },
    ];
  }, [q, signals]);
  return (
    <section aria-labelledby="subs-h" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="subs-h" className="font-heading text-xl font-black">
          Subscriptions
        </h2>{" "}
        <label className="flex w-full flex-col gap-1 text-sm font-bold sm:w-80">
          Search by address, case, employer or series
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-h-[44px] border-2 border-border bg-background px-3 text-base font-normal focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
      </div>
      {lists.map((l) => (
        <SubList key={l.title} title={l.title} rows={l.rows} open={q.trim().length > 0 && l.rows.length > 0} />
      ))}
    </section>
  );
}

export function ActivityPanel({ signals }: { signals: Signals }) {
  const { totals, recentUsers, recentCases } = signals;
  return (
    <section aria-labelledby="activity-h" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
      <h2 id="activity-h" className="font-heading text-xl font-black">
        Recent activity
      </h2>{" "}
      <p className="mt-1 text-sm text-muted-foreground">
        {`${totals.users ?? "200+"} accounts, ${totals.signupsLast14d} new in 14 days, ${totals.activeLast7d} signed in this week.`}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-2">
        <div>
          <h3 className="text-base font-bold">Latest signups</h3>
          <ul className="mt-1 divide-y divide-border">
            {recentUsers.map((u) => (
              <li key={`${u.email}-${u.createdAt}`} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="font-medium">{u.email}</span>{" "}
                <span className="text-xs tabular-nums text-muted-foreground">{when(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-base font-bold">Latest cases added in the app</h3>
          {recentCases.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="mt-1 divide-y divide-border">
              {recentCases.map((c, i) => (
                <li key={`${c.email}-${i}`} className="flex flex-wrap items-baseline gap-x-3 py-1.5 text-sm">
                  <span className="font-medium">{c.email}</span>{" "}
                  <span className="text-muted-foreground">{c.employerName}</span>{" "}
                  {c.caseNumber ? <span className="font-mono text-xs text-muted-foreground">{c.caseNumber}</span> : null}{" "}
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{when(c.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export function DigestPanel({ signals }: { signals: Signals }) {
  const { newsletter } = signals;
  return (
    <section aria-labelledby="digest-h" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
      <h2 id="digest-h" className="font-heading text-xl font-black">
        Weekly bulletin digest
      </h2>{" "}
      <p className="mt-2 text-base">
        Sending is{" "}
        <span className={`px-1.5 py-0.5 text-sm font-bold ${newsletter.enabled ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          {newsletter.enabled ? `on, ${newsletter.dailyCap} a day` : "off"}
        </span>
        {`. ${newsletter.confirmed} confirmed of ${newsletter.staged} who ticked the box.`}
      </p>{" "}
      <p className={`mt-1 text-sm ${newsletter.health.level === "warn" ? "font-bold text-destructive" : "text-muted-foreground"}`}>
        {newsletter.health.message}
      </p>{" "}
      {newsletter.latest ? (
        <details className="mt-3 border-2 border-border bg-background">
          <summary className="min-h-[44px] cursor-pointer px-3 py-2 text-sm">
            <span className="font-bold">{newsletter.latest.subject}</span>{" "}
            <span className="text-xs text-muted-foreground">
              {`${newsletter.latest.status}${newsletter.latest.sentCount > 0 ? `, ${newsletter.latest.sentCount} sent` : ""}, built ${when(newsletter.latest.builtAt)}`}
            </span>
          </summary>{" "}
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t-2 border-border p-3 font-mono text-xs leading-relaxed">
            {newsletter.latest.text}
          </pre>
        </details>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No issue composed yet. The cron builds one every Tuesday at 9 AM Eastern.</p>
      )}
    </section>
  );
}
