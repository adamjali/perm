"use client";

import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";

import { api } from "@convex/_generated/api";
import { formatInt } from "@/lib/format";
import { EASTERN_TIMEZONE } from "@/lib/time";

type Summary = FunctionReturnType<typeof api.adminDevelopers.summary>;

const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const signedUp = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: EASTERN_TIMEZONE });

/**
 * Who uses the API and the assistants: accounts with their plan, keys,
 * webhooks and calls, calls a day with and without a key, working keys by
 * scope, webhook health, and live DOL lookups against the API-wide ceiling. For the admin page only
 * (convex/adminDevelopers.ts joins the counts to their accounts).
 */
export function DevelopersPanel() {
  const load = useAction(api.adminDevelopers.summary);
  const [state, setState] = useState<{ kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; s: Summary }>({
    kind: "loading",
  });

  useEffect(() => {
    let live = true;
    load({})
      .then((s) => live && setState({ kind: "ready", s }))
      .catch((e: unknown) => live && setState({ kind: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [load]);

  if (state.kind === "loading") return <p className="text-sm text-muted-foreground">Loading API use...</p>;
  if (state.kind === "error") return <p className="text-sm text-destructive">{state.message}</p>;
  const { accounts, days, usageReadable, keys, webhooks, live } = state.s;
  const total = days.reduce((n, d) => n + d.keyed + d.mcp + d.extension + d.other, 0);
  const max = Math.max(1, ...days.map((d) => d.keyed + d.mcp + d.extension + d.other));

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 [&>*]:min-w-0">
        {[
          ["API accounts", formatInt(accounts.length)],
          ["Working keys", `${formatInt(keys.live)}${keys.sandbox ? ` + ${formatInt(keys.sandbox)} sandbox` : ""}`],
          ["On Plus", formatInt(accounts.filter((a) => a.plan === "Plus").length)],
          ["Calls, 30 days", usageReadable ? formatInt(total) : "unreadable"],
          ["Webhook endpoints", `${formatInt(webhooks.endpoints)}${webhooks.paused ? ` (${formatInt(webhooks.paused)} paused)` : ""}`],
          ["Live lookups today", live.readable ? `${formatInt(live.today)} of ${formatInt(live.ceiling)}` : "unreadable"],
        ].map(([label, value]) => (
          <div key={label} className="border-2 border-border bg-card p-4">
            <dt className="text-sm font-bold text-foreground/70">{label}</dt>{" "}
            <dd className="mt-1 font-heading text-2xl font-black">{value}</dd>
          </div>
        ))}
      </dl>{" "}

      <section aria-labelledby="dev-days">
        <h3 id="dev-days" className="font-heading text-xl font-black">Calls a day</h3>{" "}
        {!usageReadable ? (
          <p className="mt-2 text-base text-destructive">The call counts couldn&apos;t be read from the public-data database.</p>
        ) : days.length === 0 ? (
          <p className="mt-2 text-base text-muted-foreground">No calls in the last 30 days.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {days.map((d) => {
              const n = d.keyed + d.mcp + d.extension + d.other;
              return (
                <li key={d.day} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm">
                  <span className="font-bold">{shortDay(d.day)} </span>{" "}
                  <span className="flex h-4 border-2 border-border bg-muted" aria-hidden="true">
                    <span className="bg-primary" style={{ width: `${(d.keyed / max) * 100}%` }} />{" "}
                    <span className="bg-foreground/60" style={{ width: `${((d.mcp + d.extension + d.other) / max) * 100}%` }} />
                  </span>{" "}
                  <span className="tabular-nums">
                    {`${formatInt(n)} (${formatInt(d.keyed)} keyed, ${formatInt(d.mcp)} MCP, ${formatInt(d.extension)} extension) `}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-sm text-muted-foreground">Green: calls with a key. Grey: the MCP server and the browser extension, which need none. UTC days.</p>
      </section>{" "}

      <section aria-labelledby="dev-keys">
        <h3 id="dev-keys" className="font-heading text-xl font-black">Keys and webhooks</h3>{" "}
        <ul className="mt-3 space-y-1.5 text-base">
          <li>
            {`Working keys by scope: ${
              Object.entries(keys.byScope)
                .map(([scope, n]) => `${scope} ${formatInt(n)}`)
                .join(", ")
            }. `}
          </li>{" "}
          <li>
            {`Webhooks, last 24 hours: ${formatInt(webhooks.deliveredSince)} delivered, ${formatInt(webhooks.failedSince)} failed. ` +
              `${formatInt(webhooks.pending)} waiting, ${formatInt(webhooks.held)} held for paused endpoints, ${formatInt(webhooks.watches)} watches. `}
          </li>{" "}
          <li>
            {live.readable
              ? `Live DOL lookups through the API: ${formatInt(live.today)} today and ${formatInt(live.yesterday)} yesterday (UTC), of ${formatInt(live.ceiling)} a day for every account together. `
              : "Live DOL lookups couldn't be read from the public-data database. "}
          </li>
        </ul>{" "}
        {(webhooks.paused > 0 || webhooks.failedSince > 0) && (
          <p className="mt-2 text-base text-destructive">
            {webhooks.paused > 0
              ? `${formatInt(webhooks.paused)} endpoint${webhooks.paused === 1 ? " is" : "s are"} paused after a day of failures; its owner was emailed once.`
              : "Some deliveries failed in the last day; they're retried for 24 hours."}
          </p>
        )}
      </section>{" "}

      <section aria-labelledby="dev-accounts">
        <h3 id="dev-accounts" className="font-heading text-xl font-black">Accounts</h3>{" "}
        {accounts.length === 0 ? (
          <p className="mt-2 text-base text-muted-foreground">Nobody has made a key yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  {["Email ", "Plan ", "Keys ", "Webhooks ", "Since ", "Yesterday ", "30 days "].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-3 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...accounts].sort((a, b) => b.calls30d - a.calls30d).map((a) => (
                  <tr key={a.account} className="border-b border-border/40">
                    <td className="py-2 pr-3">{`${a.email ?? "account deleted"} `}</td>
                    <td className="py-2 pr-3">{`${a.plan} `}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {`${a.activeKeys}${a.sandboxKeys ? ` + ${a.sandboxKeys} sandbox` : ""}${a.revokedKeys ? ` (+${a.revokedKeys} revoked)` : ""} `}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {a.endpoints === 0 && a.watches === 0
                        ? "none "
                        : `${a.endpoints} endpoint${a.endpoints === 1 ? "" : "s"}${a.pausedEndpoints ? ` (${a.pausedEndpoints} paused)` : ""}, ${a.watches} watch${a.watches === 1 ? "" : "es"} `}
                    </td>
                    <td className="py-2 pr-3">{`${signedUp(a.createdAt)} `}</td>
                    <td className="py-2 pr-3 tabular-nums">{`${formatInt(a.callsYesterday)} `}</td>
                    <td className="py-2 tabular-nums">{`${formatInt(a.calls30d)} `}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Put an account on Plus by hand: <code>npx convex run apiKeys:setPlan</code> with its email, against prod.
        </p>
      </section>
    </div>
  );
}
