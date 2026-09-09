"use client";

import { useId, useMemo, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui";
import { calculatePriorityDateRetention, RETENTION_DAYS, type RetentionResult } from "@/lib/perm";

type Outcome = { kind: "error"; error: string } | { kind: "ok"; r: RetentionResult; warnings: string[] };

/**
 * Priority date retention and I-485 portability, from three dates.
 *
 * The I-140 approval date is the only required input. The I-485 receipt
 * date adds the portability clock; an employer withdrawal date is judged
 * against the 180 days. The verdict on the priority date is the rule's,
 * with its citation, and the sentence under it says what the rule does not
 * decide.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const int = (n: number) => n.toLocaleString("en-US");
const long = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export function PriorityDateRetentionCalculator() {
  const approvedId = useId();
  const i485Id = useId();
  const withdrewId = useId();
  const [approved, setApproved] = useState("");
  const [i485, setI485] = useState("");
  const [withdrew, setWithdrew] = useState("");

  const result = useMemo((): Outcome | null => {
    if (!DATE_RE.test(approved)) return null;
    try {
      const r = calculatePriorityDateRetention({
        i140Approved: approved,
        ...(DATE_RE.test(i485) ? { i485Filed: i485 } : {}),
        ...(DATE_RE.test(withdrew) ? { employerWithdrew: withdrew } : {}),
      });
      const warnings: string[] = [];
      if (DATE_RE.test(withdrew) && withdrew < approved) warnings.push("The withdrawal date is before the approval date. Check both dates.");
      return { kind: "ok", r, warnings };
    } catch {
      return { kind: "error", error: "Enter dates as YYYY-MM-DD." };
    }
  }, [approved, i485, withdrew]);

  return (
    <div className="border-2 border-border bg-card p-5 shadow-hard sm:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        <div>
          <Label htmlFor={approvedId}>I-140 approval date</Label>{" "}
          <DateInput id={approvedId} value={approved} onChange={(e) => setApproved(e.target.value)} className="mt-1.5" />
        </div>{" "}
        <div>
          <Label htmlFor={i485Id}>I-485 receipt date (optional)</Label>{" "}
          <DateInput id={i485Id} value={i485} onChange={(e) => setI485(e.target.value)} className="mt-1.5" />
        </div>{" "}
        <div>
          <Label htmlFor={withdrewId}>Employer withdrew or closed (optional)</Label>{" "}
          <DateInput id={withdrewId} value={withdrew} onChange={(e) => setWithdrew(e.target.value)} className="mt-1.5" />
        </div>
      </div>{" "}

      {result?.kind === "error" ? (
        <p className="mt-5 flex items-start gap-2 border-2 border-border bg-background p-3 text-sm">
          <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {result.error}
        </p>
      ) : null}{" "}

      {result?.kind === "ok" ? (
        <div className="mt-6">
          {result.warnings.map((w) => (
            <p key={w} className="mb-3 flex items-start gap-2 border-2 border-border bg-background p-3 text-sm">
              <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {w}
            </p>
          ))}{" "}
          <dl className="border-t-2 border-border">
            <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border [&>*]:min-w-0 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4">
              <dt className="text-base">An employer withdrawal no longer revokes the I-140 from ({RETENTION_DAYS} days after approval)</dt>{" "}
              <dd className="font-heading text-xl font-black tabular-nums">{long(result.r.withdrawalSafeFrom)}</dd>
            </div>{" "}
            {result.r.portableFrom ? (
              <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border [&>*]:min-w-0 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4">
                <dt className="text-base">The job can change to a same-or-similar one under 204(j) from ({RETENTION_DAYS} days after the I-485 was filed)</dt>{" "}
                <dd className="font-heading text-xl font-black tabular-nums">{long(result.r.portableFrom)}</dd>
              </div>
            ) : null}{" "}
            {result.r.withdrawal ? (
              <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border [&>*]:min-w-0 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4">
                <dt className="text-base">
                  A withdrawal on {long(result.r.withdrawal.on)}, {int(result.r.withdrawal.daysAfterApproval)} days after approval
                </dt>{" "}
                <dd className={`font-heading text-xl font-black ${result.r.withdrawal.autoRevokes ? "text-foreground/70" : ""}`}>
                  {result.r.withdrawal.autoRevokes ? "Revokes the I-140 automatically" : "Does not revoke the I-140"}
                </dd>
              </div>
            ) : null}{" "}
            <div className="grid grid-cols-1 gap-y-1 border-b-2 border-border [&>*]:min-w-0 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4">
              <dt className="text-base">The priority date, for a future EB-1, EB-2 or EB-3 petition</dt>{" "}
              <dd className="font-heading text-xl font-black">Retained</dd>
            </div>
          </dl>{" "}
          <p className="mt-3 text-sm leading-relaxed text-foreground/70">
            Retained unless USCIS revoked the approval for fraud, willful misrepresentation, material error, or an invalidated
            labor certification, which the dates cannot tell. Whether a new job is &ldquo;same or similar&rdquo; is USCIS&apos;s
            finding on Supplement J, not arithmetic.
          </p>{" "}
          <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
            {result.r.citations.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
