"use client";

/**
 * Ratings from the last alert email of each case (convex/alertRatings.ts), newest first, with everything known
 * about who gave each one: every open of the email's boxes and every tap on the page (when, which score, which
 * browser, and whether it looked like a mail scanner), their note, the watch it came from, the name on their
 * account, and any review they left on the site.
 *
 * SECURITY: rows carry addresses; admin page only.
 */

import type { FunctionReturnType } from "convex/server";

import type { api } from "@convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";

export type AlertRatingsData = FunctionReturnType<typeof api.alertRatings.forAdmin>;
type Row = AlertRatingsData[number];

function when(ms: number | null | undefined): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

/** The browser line cut to the part a person reads: the device and the browser, not the engine's version list. */
function shortBrowser(line: string | undefined): string {
  if (!line) return "No browser line";
  const device = /\(([^)]*)\)/.exec(line)?.[1]?.split(";")[0]?.trim();
  const browser = /(Edg|CriOS|Chrome|FxiOS|Firefox|Version)\/[\d.]+/.exec(line)?.[0];
  const name = browser?.startsWith("Version") ? "Safari" : browser?.split("/")[0]?.replace("CriOS", "Chrome").replace("FxiOS", "Firefox").replace("Edg", "Edge");
  return device && name ? `${name} on ${device}` : line.slice(0, 80);
}

function RatingItem({ r }: { r: Row }) {
  const people = r.clicks.filter((c) => !c.scanner);
  const scanners = r.clicks.length - people.length;
  return (
    <li className="border-2 border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-lg font-bold">
          {r.score === null ? "No rating yet: only a mail scanner opened the links" : `${r.score} of 5`}
        </span>{" "}
        <span className="text-sm text-muted-foreground">{`Last changed ${when(r.updatedAt)}`}</span>
      </div>{" "}
      {r.note ? (
        <p className="mt-2 whitespace-pre-line border-l-4 border-border pl-3 text-sm [overflow-wrap:anywhere]">{r.note}</p>
      ) : null}{" "}
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr] [&>*]:min-w-0">
        <dt className="font-bold">Who</dt>{" "}
        <dd className="break-all">
          {r.anonymous ? "Asked to leave their email off" : [r.name, r.email].filter(Boolean).join(", ") || "Unknown"}
          {r.name === null && r.email ? " (no account)" : ""}
        </dd>{" "}
        {r.caseNumber ? (
          <>
            <dt className="font-bold">Case</dt>{" "}
            <dd>
              <a className="link" href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`} target="_blank" rel="noopener noreferrer">
                {r.caseNumber}
              </a>
              {r.watch?.lastSeenStatus ? `, ${r.watch.lastSeenStatus}` : ""}
            </dd>{" "}
          </>
        ) : null}
        {r.watch ? (
          <>
            <dt className="font-bold">Alerts</dt>{" "}
            <dd>
              {[
                `signed up ${when(r.watch.signedUpAt)}${r.watch.source ? ` from ${r.watch.source}` : ""}`,
                r.watch.confirmedAt ? `confirmed ${when(r.watch.confirmedAt)}` : "never confirmed",
                `${r.watch.alertCount} sent${r.watch.lastAlertSentAt ? `, the last ${when(r.watch.lastAlertSentAt)}` : ""}`,
                r.watch.unsubscribedAt ? `stopped ${when(r.watch.unsubscribedAt)}` : null,
              ]
                .filter(Boolean)
                .join("; ")}
            </dd>{" "}
          </>
        ) : null}
        <dt className="font-bold">Review</dt>{" "}
        <dd>{r.review ? `${r.review.rating} of 5, ${r.review.status}, ${when(r.review.at)}` : "None from this address"}</dd>{" "}
        <dt className="font-bold">First rated</dt> <dd>{when(r.createdAt)}</dd>
      </dl>{" "}
      <details className="mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-bold">
          {`Every open and tap (${r.clicks.length}${scanners ? `, ${scanners} by a scanner` : ""})`}
        </summary>{" "}
        <ol className="mt-2 space-y-1 text-sm">
          {r.clicks
            .slice()
            .reverse()
            .map((c, i) => (
              <li key={`${c.at}-${i}`} className={c.scanner ? "text-muted-foreground" : undefined}>
                {`${when(c.at)}: ${c.score} of 5, ${c.via === "email" ? "the email's box" : "on the page"}, ${shortBrowser(c.browser)}${c.scanner ? " (scanner, not counted)" : ""}`}
              </li>
            ))}
        </ol>
      </details>
    </li>
  );
}

export function AlertRatingsPanel({ data }: { data: AlertRatingsData | undefined }) {
  return (
    <section aria-labelledby="alert-ratings">
      <h2 id="alert-ratings" className="font-heading text-xl font-bold">
        Ratings from alert emails
      </h2>{" "}
      <p className="mt-1 text-sm text-muted-foreground">
        Saved the moment a box in a case&rsquo;s last alert is opened. Opens of several boxes within a minute, or from a
        browser line that names a fetcher, are a mail scanner&rsquo;s and don&rsquo;t count.
      </p>{" "}
      {!data ? (
        <Skeleton className="mt-4 h-40" />
      ) : data.length ? (
        <ul className="mt-4 space-y-4">
          {data.map((r) => (
            <RatingItem key={r.id} r={r} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No ratings yet.</p>
      )}
    </section>
  );
}
