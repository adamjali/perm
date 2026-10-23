"use client";

/**
 * Reviews of the site waiting for the owner, and the decided ones (convex/siteReviews.ts). Approve shows a review
 * on /reviews and the homepage at once; decline keeps it off. Declining is for spam, abuse and reviews of something
 * else, never for stars (16 CFR 465.7(b)), and the panel says so beside the buttons. A decided review can be
 * switched either way.
 *
 * SECURITY: rows carry reviewers' addresses; admin page only.
 */

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";

export type ReviewsData = FunctionReturnType<typeof api.siteReviews.listForAdmin>;
type Row = ReviewsData["waiting"][number];

const BTN =
  "inline-flex min-h-[44px] items-center border-2 border-border px-3 text-sm font-bold transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:text-muted-foreground motion-reduce:transition-none shadow-hard-sm motion-safe:hover:-translate-y-0.5";

function when(ms: number | undefined): string {
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

function ReviewCard({ r }: { r: Row }) {
  const approve = useMutation(api.siteReviews.approve);
  const decline = useMutation(api.siteReviews.decline);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const id = r._id as Id<"siteReviews">;
  const shown = r.status === "approved" && !r.insider;
  return (
    <li className="border-2 border-border bg-card p-4 shadow-hard-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-lg font-bold">{`${r.name}, ${r.rating} of 5`}</span>{" "}
        <span className="text-sm font-bold">
          {r.insider ? "Insider: never shown" : r.status === "pending" ? "Waiting" : shown ? "Shown on the site" : "Declined"}
        </span>
      </div>{" "}
      <p className="mt-2 whitespace-pre-line border-l-4 border-border pl-3 text-sm">{r.text}</p>{" "}
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr] [&>*]:min-w-0">
        <dt className="font-bold">Left</dt> <dd>{`${when(r.createdAt)}${r.source === "senja" ? ", on Senja" : ""}`}</dd>{" "}
        <dt className="font-bold">Email</dt>{" "}
        <dd className="break-all">
          {r.email ? `${r.email}${r.watchesCase ? " (watches a case on the site)" : ""}` : "None given"}
        </dd>{" "}
        {r.reviewedAt ? (
          <>
            <dt className="font-bold">Decided</dt> <dd>{when(r.reviewedAt)}</dd>{" "}
          </>
        ) : null}
      </dl>{" "}
      {r.insider ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.status !== "approved" ? (
            <button type="button" disabled={busy} onClick={() => run(() => approve({ id }))} className={`${BTN} bg-primary text-primary-foreground`}>
              Approve and show
            </button>
          ) : null}{" "}
          {r.status !== "declined" ? (
            <button type="button" disabled={busy} onClick={() => run(() => decline({ id }))} className={`${BTN} bg-background`}>
              {r.status === "approved" ? "Take it down" : "Decline"}
            </button>
          ) : null}
        </div>
      )}{" "}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-bold">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function ReviewsPanel({ data }: { data: ReviewsData | undefined }) {
  if (!data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-8">
      <section aria-labelledby="reviews-waiting">
        <h2 id="reviews-waiting" className="font-heading text-xl font-bold">
          {data.waiting.length ? `Waiting for you: ${data.waiting.length}` : "Nothing waiting"}
        </h2>{" "}
        <p className="mt-1 text-sm text-muted-foreground">
          Decline only spam, abuse or a review of something else, never a review for its stars. An approved review shows
          on /reviews and the homepage within about 10 minutes.
        </p>{" "}
        {data.waiting.length ? (
          <ul className="mt-4 space-y-4">
            {data.waiting.map((r) => (
              <ReviewCard key={r._id} r={r} />
            ))}
          </ul>
        ) : null}
      </section>{" "}
      <section aria-labelledby="reviews-decided">
        <h2 id="reviews-decided" className="font-heading text-xl font-bold">
          Decided
        </h2>{" "}
        {data.decided.length ? (
          <ul className="mt-4 space-y-4">
            {data.decided.map((r) => (
              <ReviewCard key={r._id} r={r} />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No reviews decided yet.</p>
        )}
      </section>
    </div>
  );
}
