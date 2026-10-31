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
import { choiceVariants } from "@/components/ui/choice";
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

/** The reasons 16 CFR 465.7(b) allows for keeping a review off the site, in the owner's words. */
const REASONS: { id: "spam" | "abusive" | "personal" | "unrelated" | "other"; label: string }[] = [
  { id: "spam", label: "Spam or fake" },
  { id: "abusive", label: "Abusive or obscene" },
  { id: "personal", label: "Someone's personal details" },
  { id: "unrelated", label: "Not about PERM Tracker" },
  { id: "other", label: "Other lawful reason" },
];
const REASON_LABEL = Object.fromEntries(REASONS.map((x) => [x.id, x.label])) as Record<string, string>;

/** Where a review came from, after its date. An alert rating is stars only and shows as "Case alert reader". */
const SOURCE_NOTE: Record<Row["source"], string> = {
  site: "",
  senja: ", on Senja",
  alert: ", tapped in a case's alert email (stars only; shows as Case alert reader with the month)",
};

type Filter = "all" | "waiting" | "posted" | "declined";
const isPosted = (r: Row) => r.status === "approved" && !r.insider;

function ReviewCard({ r }: { r: Row }) {
  const [choosing, setChoosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const approve = useMutation(api.siteReviews.approve);
  const remove = useMutation(api.siteReviews.remove);
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
      {r.scrubbed ? (
        <p className="mt-2 text-sm text-muted-foreground">Its words, name and email were deleted 90 days after it was declined.</p>
      ) : r.text ? (
        <p className="mt-2 whitespace-pre-line border-l-4 border-border pl-3 text-sm [overflow-wrap:anywhere]">{r.text}</p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">A rating with no words.</p>
      )}{" "}
      {r.privateNote ? (
        <div className="mt-3 border-2 border-dashed border-border p-3">
          <p className="text-sm font-bold">Private note from the reviewer (never shown; deleted after 90 days)</p>{" "}
          <p className="mt-1 whitespace-pre-line text-sm [overflow-wrap:anywhere]">{r.privateNote}</p>
        </div>
      ) : null}{" "}
      {r.quick || r.viaLink ? (
        <p className="mt-2 text-sm font-bold">
          {[r.quick ? "Sent unusually fast (could be a script)" : null, r.viaLink ? "Email confirmed by a link we sent" : null]
            .filter(Boolean)
            .join(". ")}
        </p>
      ) : null}{" "}
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr] [&>*]:min-w-0">
        <dt className="font-bold">Left</dt> <dd>{`${when(r.createdAt)}${SOURCE_NOTE[r.source]}`}</dd>{" "}
        <dt className="font-bold">Email</dt>{" "}
        <dd className="break-all">
          {r.email ? `${r.email}${r.watchesCase ? " (watches a case on the site)" : ""}` : "None given"}
        </dd>{" "}
        {r.reviewedAt ? (
          <>
            <dt className="font-bold">Decided</dt>{" "}
            <dd>{`${when(r.reviewedAt)}${r.declineReason ? `: ${REASON_LABEL[r.declineReason] ?? r.declineReason}` : ""}`}</dd>{" "}
          </>
        ) : null}
      </dl>{" "}
      {r.insider ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.status !== "approved" && !r.scrubbed ? (
            <button type="button" disabled={busy} onClick={() => run(() => approve({ id }))} className={`${BTN} bg-primary text-primary-foreground`}>
              Approve and show
            </button>
          ) : null}{" "}
          {r.status !== "declined" && !choosing ? (
            <button type="button" disabled={busy} onClick={() => setChoosing(true)} className={`${BTN} bg-background`}>
              {r.status === "approved" ? "Take it down" : "Decline"}
            </button>
          ) : null}{" "}
          {!deleting ? (
            <button type="button" disabled={busy} onClick={() => setDeleting(true)} className={`${BTN} bg-background`}>
              Delete for good
            </button>
          ) : null}
        </div>
      )}{" "}
      {deleting ? (
        <div className="mt-3">
          <p className="text-sm font-bold">
            Delete this review and its note for good? Use it when the reviewer asks, or for a test. Declining keeps the
            rating and reason; this keeps nothing.
          </p>{" "}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => run(() => remove({ id }))} className={`${BTN} bg-background`}>
              Yes, delete it
            </button>{" "}
            <button type="button" disabled={busy} onClick={() => setDeleting(false)} className={`${BTN} bg-background`}>
              Keep it
            </button>
          </div>
        </div>
      ) : null}{" "}
      {choosing ? (
        <fieldset className="mt-3">
          <legend className="text-sm font-bold">Why? Never for its stars.</legend>{" "}
          <div className="mt-2 flex flex-wrap gap-2">
            {REASONS.map((x) => (
              <button
                key={x.id}
                type="button"
                disabled={busy}
                onClick={() => run(async () => {
                  await decline({ id, reason: x.id });
                  setChoosing(false);
                })}
                className={`${BTN} bg-background`}
              >
                {x.label}
              </button>
            ))}{" "}
            <button type="button" disabled={busy} onClick={() => setChoosing(false)} className={`${BTN} bg-background`}>
              Cancel
            </button>
          </div>
        </fieldset>
      ) : null}{" "}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-bold">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function ReviewsPanel({ data }: { data: ReviewsData | undefined }) {
  const [filter, setFilter] = useState<Filter>("all");
  if (!data) return <Skeleton className="h-64" />;
  const posted = data.decided.filter(isPosted);
  const declined = data.decided.filter((r) => !isPosted(r));
  const choices: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "waiting", label: `Waiting (${data.waiting.length})` },
    { id: "posted", label: `Posted (${posted.length})` },
    { id: "declined", label: `Declined or kept off (${declined.length})` },
  ];
  const decidedShown = filter === "posted" ? posted : filter === "declined" ? declined : data.decided;
  return (
    <div className="space-y-8">
      <div role="group" aria-label="Show reviews" className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={choiceVariants({ on: filter === c.id })}
          >
            {c.label}
          </button>
        ))}
      </div>{" "}
      {filter === "posted" || filter === "declined" ? null : (
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
      </section>
      )}{" "}
      {filter === "waiting" ? null : (
      <section aria-labelledby="reviews-decided">
        <h2 id="reviews-decided" className="font-heading text-xl font-bold">
          {filter === "posted" ? "Posted on the site" : filter === "declined" ? "Declined or kept off" : "Decided"}
        </h2>{" "}
        {decidedShown.length ? (
          <ul className="mt-4 space-y-4">
            {decidedShown.map((r) => (
              <ReviewCard key={r._id} r={r} />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">None here yet.</p>
        )}
      </section>
      )}
    </div>
  );
}
