"use client";

/**
 * The DOL decision estimate for a saved case, folded into the case Overview
 * beside the deadlines (right under "Next up"). It shows the estimated decision
 * date and window, the line ahead when the case is in analyst review, and one
 * compact line for DOL's live status plus the per-case watch toggle.
 *
 * The estimate is the shared corpus (useCaseCorpus) plus the case's DOL filing
 * date (decoded from its number) run through the SAME `buildCaseEstimate` the
 * public case page uses, so the app and the public site can never name
 * different days. DOL's live word is shown here and as a chip in the case
 * header; it never overwrites the attorney's own stage (that stays the case's
 * `progressStatus`).
 *
 * Renders nothing for a case with no DOL case number, and nothing when there is
 * no estimate, no live status, and the watch is off.
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
import { appCaseEstimate } from "@/lib/appCaseEstimate";
import { CaseEstimatePanel } from "@/components/tools/CaseEstimate";
import { LineAhead } from "@/components/tools/LineAhead";
import { parseCaseNumber } from "@/lib/permCaseNumber";
import { canonicalStatus } from "@/lib/caseStatusVocabulary";
import { formatAsOf } from "@/lib/dolFormat";

export interface CaseEstimateSectionCase {
  _id: Id<"cases">;
  caseNumber?: string | null;
  caseStatus?: string | null;
  liveStatus?: string | null;
  liveStatusSeenAt?: number | null;
  liveStatusIsFinal?: boolean | null;
  watchEnabled?: boolean | null;
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

export function CaseEstimateSection({ caseData }: { caseData: CaseEstimateSectionCase }) {
  const corpus = useCaseCorpus();
  const parsed = caseData.caseNumber ? parseCaseNumber(caseData.caseNumber) : null;

  // No DOL number: nothing to estimate or watch. Keep the Overview clean.
  if (!parsed) return null;

  const watchOff = caseData.watchEnabled === false;
  const liveStatus = caseData.liveStatus ?? null;
  const live = liveStatus ? canonicalStatus(liveStatus) : null;
  const seen =
    typeof caseData.liveStatusSeenAt === "number"
      ? formatAsOf(new Date(caseData.liveStatusSeenAt).toISOString().slice(0, 10))
      : null;

  const today = new Date().toISOString().slice(0, 10);
  const est = corpus
    ? appCaseEstimate({
        corpus,
        filingDate: parsed.filingDate,
        status: live,
        isFinal: caseData.liveStatusIsFinal === true,
        today,
      })
    : null;

  // Nothing worth a block: no estimate, no live status, and not watching.
  if (!est?.estimate && !live && watchOff) return null;

  return (
    <section aria-label="DOL decision estimate" className="space-y-3">
      {/* DOL's live status and the per-case watch, one compact line. */}
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

      {est?.estimate ? <CaseEstimatePanel est={est.estimate} /> : null}

      {est?.lineAhead && live === "ANALYST REVIEW" && est.lineAhead.length > 0 ? (
        <LineAhead rows={est.lineAhead} perDay={corpus?.decisionPace?.pace ?? null} />
      ) : null}
    </section>
  );
}
