"use client";

/**
 * Consulate reports from visitors (convex/consularReports.ts), newest first, with Hide and Show. Hiding takes a
 * report off every public figure without deleting it; a removal someone asks for by email is
 * `npx convex run consularReports:deleteById`. The rows hold no name, case number, key or address: only what
 * the report says, so the panel shows all of it.
 */

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABEL, OUTCOME_LABEL, type ReportCategoryId, type ReportOutcomeId } from "@/lib/consularReport";
import { shortDate } from "@convex/lib/months";

export type ConsularReportsData = FunctionReturnType<typeof api.consularReports.listForAdmin>;
type Row = ConsularReportsData[number];

function when(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

/** What a report says, one detail a phrase. */
function details(r: Row): string {
  const day = (iso: string | null) => (iso ? (shortDate(iso) ?? iso) : null);
  return [
    r.mode === "dropbox" ? "drop box" : null,
    r.nvcCompleteMonth ? `NVC complete ${r.nvcCompleteMonth}` : null,
    r.scheduledOn ? `letter ${day(r.scheduledOn)}` : null,
    r.interviewOn ? `${r.mode === "dropbox" ? "dropped off" : "interview"} ${day(r.interviewOn)}` : null,
    r.approvedOn ? `approved ${day(r.approvedOn)}` : null,
    r.resolvedOn ? `${r.outcome === "221g" ? "cleared" : "issued"} ${day(r.resolvedOn)}` : null,
    r.refusalGround ? `ground ${r.refusalGround}` : null,
    r.slipColor ? `${r.slipColor} slip` : null,
    r.askedToEmailDocs ? `asked to email documents: ${r.askedToEmailDocs}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function ReportItem({ r }: { r: Row }) {
  const setHidden = useMutation(api.consularReports.setHiddenForAdmin);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function toggle(id: Id<"consularReports">, hidden: boolean) {
    setBusy(true);
    setFailed(null);
    try {
      await setHidden({ id, hidden });
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "That didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border-2 border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-lg font-bold">
          {r.post}: {CATEGORY_LABEL[r.category as ReportCategoryId] ?? r.category},{" "}
          {(OUTCOME_LABEL[r.outcome as ReportOutcomeId] ?? r.outcome).toLowerCase()}
        </span>{" "}
        <span className="text-sm text-muted-foreground">
          Saved {when(r.createdAt)}
          {r.updatedAt > r.createdAt ? `, changed ${when(r.updatedAt)}` : ""}
        </span>
      </div>{" "}
      {details(r) ? <p className="mt-2 text-sm">{details(r)}</p> : null}{" "}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {r.hidden ? <span className="text-sm font-bold">Hidden from every figure</span> : null}{" "}
        <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => toggle(r.id, !r.hidden)}>
          {r.hidden ? "Show again" : "Hide"}
        </Button>
        {failed ? (
          <span role="alert" className="text-sm">
            {" "}
            {failed}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function ConsularReportsPanel({ data }: { data: ConsularReportsData | undefined }) {
  return (
    <section aria-labelledby="consular-reports-h">
      <h2 id="consular-reports-h" className="font-heading text-2xl font-bold">
        Consulate reports
      </h2>{" "}
      <p className="mt-1 max-w-3xl text-base text-muted-foreground">
        What visitors reported about their visa appointments, newest first. Hide takes a report off every figure and
        keeps it here; Show again puts it back.
      </p>
      {data === undefined ? (
        <Skeleton className="mt-4 h-32 w-full" />
      ) : data.length === 0 ? (
        <p className="mt-4 text-base">No consulate reports yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {data.map((r) => (
            <ReportItem key={r.id} r={r} />
          ))}
        </ol>
      )}
    </section>
  );
}
