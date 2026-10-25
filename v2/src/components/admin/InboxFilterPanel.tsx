"use client";

/**
 * The spam filter on mail to our addresses and the contact form
 * (convex/inboundFilter.ts). Held mail first, with why it was held: "Not spam"
 * sends it to the owner's inbox now and lets that sender through from then on;
 * "Delete" removes it. Held mail is deleted by itself 30 days after it was held.
 * Below, the newest mail that got through, each with "Spam", which holds that
 * sender's mail from then on.
 *
 * SECURITY: the rows carry senders' addresses and words; admin page only.
 */

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";

export type InboxFilterData = FunctionReturnType<typeof api.inboundFilter.forAdmin>;
type Row = InboxFilterData["held"][number];

const BTN =
  "inline-flex min-h-[44px] items-center border-2 border-border px-3 text-sm font-bold transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:text-muted-foreground motion-reduce:transition-none shadow-hard-sm motion-safe:hover:-translate-y-0.5";

function when(ms: number | undefined): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function useAct() {
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
  return { busy, error, run };
}

function Sender({ r }: { r: Row }) {
  return (
    <span className="min-w-0 break-words">
      <span className="font-bold">{r.fromName || r.fromEmail}</span>{" "}
      {r.fromName ? <span className="text-muted-foreground">{r.fromEmail}</span> : null}
    </span>
  );
}

function HeldRow({ r }: { r: Row }) {
  const release = useMutation(api.inboundFilter.release);
  const remove = useMutation(api.inboundFilter.deleteHeld);
  const { busy, error, run } = useAct();
  const id = r.id as Id<"supportEmails">;
  return (
    <li className="border-2 border-border bg-card p-4 shadow-hard-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <Sender r={r} />{" "}
        <span className="text-muted-foreground">
          to {r.toEmail}, held {when(r.heldAt ?? r.receivedAt)}
        </span>
      </div>{" "}
      <p className="mt-2 break-words font-heading text-base font-bold">{r.subject}</p>{" "}
      {r.snippet ? <p className="mt-1 break-words text-sm text-muted-foreground">{r.snippet}</p> : null}{" "}
      {r.reasons.length > 0 ? (
        <p className="mt-2 text-sm">
          <span className="font-bold">Why it was held:</span> {r.reasons.join("; ")}
          {typeof r.score === "number" ? ` (score ${r.score})` : ""}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" className={BTN} disabled={busy} onClick={() => run(() => release({ id }))}>
          Not spam
        </button>{" "}
        <button type="button" className={BTN} disabled={busy} onClick={() => run(() => remove({ id }))}>
          Delete
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function RecentRow({ r }: { r: Row }) {
  const markSpam = useMutation(api.inboundFilter.markSpam);
  const { busy, error, run } = useAct();
  const [done, setDone] = useState(false);
  const id = r.id as Id<"supportEmails">;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <span className="min-w-0 flex-1 text-sm">
        <Sender r={r} />{" "}
        <span className="block break-words text-muted-foreground">
          {r.subject}, {when(r.receivedAt)}
        </span>
      </span>{" "}
      {done ? (
        <span className="text-sm font-bold">This sender is held from now on</span>
      ) : (
        <button
          type="button"
          className={BTN}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await markSpam({ id });
              setDone(true);
            })
          }
        >
          Spam
        </button>
      )}
      {error ? (
        <p role="alert" className="w-full text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function InboxFilterPanel({ data }: { data: InboxFilterData | undefined }) {
  if (!data) return <Skeleton className="h-64" />;
  return (
    <section aria-labelledby="inbox-filter" className="space-y-6">
      <div>
        <h2 id="inbox-filter" className="font-heading text-2xl font-bold">
          Spam filter
        </h2>{" "}
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Mail to our addresses and the contact form. Held mail never reached your inbox; it&apos;s deleted 30 days
          after it was held.
        </p>
      </div>
      <div>
        <h3 className="font-heading text-lg font-bold">
          Held{data.held.length > 0 ? ` (${data.held.length})` : ""}
        </h3>{" "}
        {data.held.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing held.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {data.held.map((r) => (
              <HeldRow key={r.id} r={r} />
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-heading text-lg font-bold">Let through lately</h3>{" "}
        {data.recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No mail yet.</p>
        ) : (
          <ul className="mt-2 border-2 border-border bg-card px-4">
            {data.recent.map((r) => (
              <RecentRow key={r.id} r={r} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
