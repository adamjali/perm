"use client";

import { useEffect, useId, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * What people report for a case after DOL, and a form to add a report.
 *
 * USCIS publishes nothing per case, so the I-140 and I-485 stages have no
 * federal record this site can read. These are unverified user reports and
 * every render says so. Counts, not conclusions: a case with two reported
 * I-140 approvals is a case two people said that about, nothing more.
 */

const KINDS = [
  { kind: "i140-filed", label: "I-140 filed" },
  { kind: "i140-approved", label: "I-140 approved" },
  { kind: "i485-filed", label: "I-485 filed" },
  { kind: "i485-approved", label: "I-485 approved" },
] as const;

interface Summary {
  reports: number;
  reporters: number;
  kinds: { kind: string; label: string; count: number; latest: string | null }[];
}

/** Convex HTTP actions live on the `.convex.site` twin of the cloud URL. */
function endpoint(path: string): string | null {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!cloud) return null;
  return `${cloud.replace(".convex.cloud", ".convex.site")}${path}`;
}

const long = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export function CaseMilestones({ caseNumber, className }: { caseNumber: string; className?: string }) {
  const kindId = useId();
  const dateId = useId();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["kind"]>("i140-filed");
  const [date, setDate] = useState("");
  const [state, setState] = useState<{ kind: "idle" } | { kind: "sending" } | { kind: "done" | "refused"; message: string }>({ kind: "idle" });

  const summaryUrl = endpoint(`/milestone/summary?case=${encodeURIComponent(caseNumber)}`);
  const reportUrl = endpoint("/milestone/report");

  useEffect(() => {
    if (!summaryUrl) return;
    let live = true;
    fetch(summaryUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Summary | null) => {
        if (live && s) setSummary(s);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [summaryUrl]);

  if (!reportUrl) return null;

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "sending" || !reportUrl) return;
    setState({ kind: "sending" });
    try {
      const res = await fetch(reportUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseNumber, kind, eventDate: date }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      setState({ kind: res.ok ? "done" : "refused", message: body?.message ?? "That did not go through. Try again in a moment." });
      if (res.ok && summaryUrl) {
        // Past the browser cache: the GET is cached for a minute, and the count has to move now.
        const s = (await fetch(summaryUrl, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as Summary | null;
        if (s) setSummary(s);
      }
    } catch {
      setState({ kind: "refused", message: "That did not go through, which usually means the connection dropped." });
    }
  }

  const reported = summary?.kinds.filter((k) => k.count > 0) ?? [];

  return (
    <section className={cn("border-2 border-border bg-card p-5 shadow-hard sm:p-6", className)}>
      <h2 className="font-heading text-xl font-black">After DOL: what people report for this case</h2>{" "}
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/70">
        USCIS publishes nothing per case, so the I-140 and I-485 stages have no federal record here. What follows
        is reported by visitors and is not verified. One report per person per milestone; a repeat updates the earlier one.
      </p>{" "}
      {summary ? (
        reported.length > 0 ? (
          <dl className="mt-4 grid gap-px border-2 border-border bg-border">
            {reported.map((k) => (
              <div key={k.kind} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-card px-4 py-3">
                <dt className="font-heading text-base font-black">{k.label}</dt>{" "}
                <dd className="text-sm text-foreground/80">
                  {k.count} {k.count === 1 ? "report" : "reports"}
                  {k.latest ? `, latest ${long(k.latest)}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-foreground/70">No reports for this case yet.</p>
        )
      ) : null}{" "}
      {state.kind === "done" ? (
        <p className="mt-4 text-sm leading-relaxed text-foreground/80">{state.message}</p>
      ) : (
        <form onSubmit={submit} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end [&>*]:min-w-0">
          <div>
            <Label htmlFor={kindId}>Milestone</Label>{" "}
            <select
              id={kindId}
              value={kind}
              onChange={(e) => setKind(e.target.value as (typeof KINDS)[number]["kind"])}
              className="mt-1.5 min-h-11 w-full border-2 border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>{" "}
          <div>
            <Label htmlFor={dateId}>Date it happened</Label>{" "}
            <DateInput id={dateId} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" required />
          </div>{" "}
          <button
            type="submit"
            disabled={state.kind === "sending" || !/^\d{4}-\d{2}-\d{2}$/.test(date)}
            className="min-h-11 border-2 border-border bg-primary px-5 font-bold text-primary-foreground shadow-hard transition-transform hover:-translate-y-[1px] disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {state.kind === "sending" ? "Sending" : "Report it"}
          </button>{" "}
          {state.kind === "refused" ? (
            <p className="flex items-start gap-2 text-sm sm:col-span-3">
              <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {state.message}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
