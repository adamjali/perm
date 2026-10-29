/**
 * A compact chip for DOL's live status on a saved case: a tone dot and the
 * status word. Used on the case card for an at-a-glance read across the list,
 * and its tone logic by the case-detail estimate section.
 *
 * Never colour alone: the status word is always present, and the dot is a
 * secondary cue. Lime for a certification, the destructive token for a denial,
 * slate for everything in between.
 *
 * @module
 */

import { canonicalStatus } from "@/lib/caseStatusVocabulary";

export type LiveStatusTone = "good" | "bad" | "neutral";

/** Outcome tone for a DOL status word. */
export function liveStatusTone(status: string): LiveStatusTone {
  const s = status.toUpperCase();
  if (s.includes("CERTIFIED") && !s.includes("EXPIRED")) return "good";
  if (s.includes("DENIED") || s.includes("REJECTED")) return "bad";
  return "neutral";
}

export const LIVE_DOT: Record<LiveStatusTone, string> = {
  good: "bg-primary",
  bad: "bg-[var(--destructive)]",
  neutral: "bg-muted-foreground",
};

export function LiveStatusChip({ status, className = "" }: { status: string; className?: string }) {
  const label = canonicalStatus(status);
  const tone = liveStatusTone(label);
  return (
    <span
      className={`inline-flex items-center gap-1.5 border border-border px-2 py-0.5 text-xs font-medium ${className}`}
      title={`DOL's live status: ${label}`}
    >
      <span className={`inline-block h-2 w-2 shrink-0 ${LIVE_DOT[tone]}`} aria-hidden="true" />
      <span className="text-muted-foreground">DOL:</span>{" "}
      <span className="font-semibold">{label}</span>
    </span>
  );
}
