"use client";

/**
 * Growth signals for the admin dashboard: recent signups, every email-alert
 * subscription with its real state, and the latest in-app case additions.
 *
 * Exists because the first genuine alert subscriber appeared (2026-08-28)
 * and finding out took a database query. What "searched" data is NOT here
 * is deliberate: public lookups redact case numbers from analytics, so
 * there is no per-visitor search log to display - see adminSignals.ts.
 */

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const STATUS_TONE: Record<string, string> = {
  confirmed: "bg-primary/15 text-foreground",
  pending: "bg-muted text-muted-foreground",
  unsubscribed: "bg-destructive/10 text-destructive",
};

function SubList({
  title,
  rows,
}: {
  title: string;
  rows: {
    email: string;
    subject: string;
    status: string;
    createdAt: number;
    lastNotifiedAt: number | null;
  }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title} · {rows.length}
      </p>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">None yet.</p>
      ) : (
        <ul className="mt-1 divide-y divide-border/60">
          {rows.map((r, i) => (
            <li
              key={`${r.email}-${r.subject}-${i}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5 text-sm"
            >
              <span className="font-medium">{r.email}</span>{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {r.subject}
              </span>{" "}
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[r.status] ?? ""}`}
              >
                {r.status}
              </span>{" "}
              <span className="ml-auto text-xs text-muted-foreground">
                {when(r.createdAt)}
                {r.lastNotifiedAt
                  ? ` · alerted ${when(r.lastNotifiedAt)}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SignalsPanel({ skip }: { skip: boolean }) {
  const signals = useQuery(api.adminSignals.getSignals, skip ? "skip" : {});

  if (skip) return null;
  if (!signals) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Signals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { totals, recentUsers, subscriptions, recentCases } = signals;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signals</CardTitle>
        <p className="text-sm text-muted-foreground">
          {totals.users ?? "200+"} accounts · {totals.signupsLast14d} new in 14
          days · {totals.activeLast7d} signed in this week
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Latest signups
            </p>
            <ul className="mt-1 divide-y divide-border/60">
              {recentUsers.map((u) => (
                <li
                  key={`${u.email}-${u.createdAt}`}
                  className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
                >
                  <span className="font-medium">{u.email}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {when(u.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Latest case additions
            </p>
            {recentCases.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="mt-1 divide-y divide-border/60">
                {recentCases.map((c, i) => (
                  <li
                    key={`${c.email}-${i}`}
                    className="flex flex-wrap items-baseline gap-x-3 py-1.5 text-sm"
                  >
                    <span className="font-medium">{c.email}</span>{" "}
                    <span className="text-muted-foreground">
                      {c.employerName}
                    </span>{" "}
                    {c.caseNumber ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.caseNumber}
                      </span>
                    ) : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {when(c.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <SubList title="Case status alerts" rows={subscriptions.caseAlerts} />
          <SubList
            title="Queue milestone alerts"
            rows={subscriptions.queueAlerts}
          />
          <SubList
            title="Visa bulletin alerts"
            rows={subscriptions.bulletinAlerts}
          />
          <SubList title="Product news list" rows={subscriptions.news} />
        </div>
      </CardContent>
    </Card>
  );
}
