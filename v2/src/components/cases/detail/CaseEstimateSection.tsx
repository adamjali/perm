"use client";

/**
 * The decision estimate for a saved case, folded into the case Overview (right
 * under "Next up"), plus a compact line of DOL's live status and the per-case
 * watch toggle.
 *
 * ## What it shows and where each piece comes from
 *
 * - **The estimate** is computed from the case's OWN dates (the PWD request
 *   filing date, or the ETA-9089 filing date) through the SAME central
 *   estimators the public (beneficiary) page uses, so the app and the public
 *   site can never name different days. A DOL case number is OPTIONAL: it only
 *   adds the live status and sharpens the read. `caseStepEstimate` picks the
 *   right step (wage determination vs PERM decision) and estimator.
 * - **DOL's live status** and the day our sweep saw it: the case's own
 *   `liveStatus` / `liveStatusSeenAt`, written by the 5-minute watch. Shown as a
 *   compact line here (and as a chip in the case header). It never overwrites
 *   the firm's own stage.
 *
 * Everything is labelled an estimate and dated; nothing reads as a promise on a
 * case an attorney is managing. The block renders nothing when the case has no
 * estimate and nothing to watch.
 *
 * @module
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import { useCaseCorpus } from "@/components/app/CaseCorpusProvider";
import { caseStepEstimate } from "@/lib/caseStepEstimate";
import { CaseEstimatePanel } from "@/components/tools/CaseEstimate";
import { LineAhead } from "@/components/tools/LineAhead";
import { canonicalStatus } from "@/lib/caseStatusVocabulary";
import { formatAsOf } from "@/lib/dolFormat";
import type { PwdDayEstimate } from "@/lib/perm";

export interface CaseEstimateSectionCase {
  _id: Id<"cases">;
  caseNumber?: string | null;
  caseStatus?: string | null;
  liveStatus?: string | null;
  liveStatusSeenAt?: number | null;
  liveStatusIsFinal?: boolean | null;
  watchEnabled?: boolean | null;
  // The dates and per-step numbers the estimate reads, so it works without a
  // DOL case number.
  pwdFilingDate?: string | null;
  pwdDeterminationDate?: string | null;
  pwdCaseNumber?: string | null;
  eta9089FilingDate?: string | null;
  eta9089CertificationDate?: string | null;
  eta9089DenialDate?: string | null;
  eta9089CaseNumber?: string | null;
}

/** The per-case DOL watch switch. Absent `watchEnabled` means on. */
function WatchToggle({ caseId, enabled }: { caseId: Id<"cases">; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const setWatch = useMutation(api.cases.setWatchEnabled);
  const id = `watch-${caseId}`;
  return (
    <span className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        Watch DOL
      </label>
      <Switch
        id={id}
        checked={on}
        disabled={busy}
        onCheckedChange={async (next) => {
          setOn(next);
          setBusy(true);
          try {
            await setWatch({ id: caseId, enabled: next });
          } catch {
            setOn(!next); // roll back on failure
            toast.error("Couldn't change the watch. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </span>
  );
}

const fmt = (iso: string | null | undefined) => (iso ? formatAsOf(iso) ?? iso : "");

/** The wage-determination estimate, drawn to match the PERM panel's shape. */
function PwdEstimateBlock({ pwd }: { pwd: Extract<PwdDayEstimate, { kind: "estimate" }> }) {
  return (
    <section aria-label="Estimated wage determination" className="space-y-1">
      <h2 className="font-heading text-2xl font-bold sm:text-3xl">When the wage determination could come</h2>{" "}
      <p className="font-heading text-3xl font-bold">Around {fmt(pwd.date)}</p>{" "}
      <p className="mt-1 max-w-2xl text-base leading-relaxed text-soft">
        {pwd.rangeFrom === "measured"
          ? `Going by how far recent determinations landed from their dates, between ${fmt(pwd.earliest)} and ${fmt(pwd.latest)}.`
          : `If DOL keeps its recent pace, between ${fmt(pwd.earliest)} and ${fmt(pwd.latest)}.`}{" "}
        An estimate, not a promise.
      </p>{" "}
      <p className="mt-2 text-sm text-muted-foreground">
        {pwd.requestsAhead.toLocaleString("en-US")} wage requests filed earlier are still in line; DOL finishes about{" "}
        {Math.round(pwd.pace).toLocaleString("en-US")} a working day.
      </p>
    </section>
  );
}

export function CaseEstimateSection({ caseData }: { caseData: CaseEstimateSectionCase }) {
  const corpus = useCaseCorpus();
  const today = new Date().toISOString().slice(0, 10);

  const watched = caseData.caseNumber?.trim() || null;
  const watchOff = caseData.watchEnabled === false;
  const live = watched && caseData.liveStatus ? canonicalStatus(caseData.liveStatus) : null;
  const seen =
    typeof caseData.liveStatusSeenAt === "number"
      ? formatAsOf(new Date(caseData.liveStatusSeenAt).toISOString().slice(0, 10))
      : null;

  const result = caseStepEstimate({
    corpus,
    caseStatus: caseData.caseStatus,
    caseNumber: watched,
    pwdCaseNumber: caseData.pwdCaseNumber,
    eta9089CaseNumber: caseData.eta9089CaseNumber,
    pwdFilingDate: caseData.pwdFilingDate,
    pwdDeterminationDate: caseData.pwdDeterminationDate,
    eta9089FilingDate: caseData.eta9089FilingDate,
    eta9089CertificationDate: caseData.eta9089CertificationDate,
    eta9089DenialDate: caseData.eta9089DenialDate,
    liveStatus: caseData.liveStatus,
    liveStatusIsFinal: caseData.liveStatusIsFinal,
    rfiEnteredOn: null, // the client has no per-case server read; the stage reading covers it
    today,
  });

  // Nothing to watch and nothing to estimate: render nothing.
  if (!watched && result.step === null) return null;

  return (
    <section aria-label="DOL decision estimate" className="space-y-3">
      {/* DOL's live status and the per-case watch, only when there's a number to watch. */}
      {watched ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-sm text-muted-foreground">
            {live ? (
              <>
                DOL&rsquo;s live status:{" "}
                <span className="font-semibold text-foreground">{live}</span>
                {seen ? <> &middot; seen {seen}</> : null}
              </>
            ) : watchOff ? (
              "DOL watch is off for this case."
            ) : (
              "Not seen on DOL yet. We check on weekdays."
            )}
          </p>{" "}
          <WatchToggle caseId={caseData._id} enabled={!watchOff} />
        </div>
      ) : null}

      {result.step === "perm" && result.perm.estimate ? (
        <CaseEstimatePanel est={result.perm.estimate} />
      ) : null}

      {result.step === "perm" && live === "ANALYST REVIEW" && result.perm.lineAhead && result.perm.lineAhead.length > 0 ? (
        <LineAhead rows={result.perm.lineAhead} perDay={corpus?.decisionPace?.pace ?? null} />
      ) : null}

      {result.step === "pwd" ? <PwdEstimateBlock pwd={result.pwd} /> : null}
    </section>
  );
}
