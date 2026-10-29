"use client";

/**
 * DOL's live status for a saved case, and the estimated decision date, drawn
 * with the public site's own estimate visual.
 *
 * ## What it shows and where each piece comes from
 *
 * - DOL's live status and the day our sweep saw it: the case's own
 *   `liveStatus` / `liveStatusSeenAt`, written by the 5-minute watch
 *   (convex/appCaseWatch.ts). This is INDEPENDENT of the shared corpus, so it
 *   renders even when the corpus failed to load.
 * - The firm's own stage beside it: a mismatch between the two is a signal
 *   worth seeing, never hidden, and DOL's word never overwrites the stage.
 * - The estimated decision date, window and basis: the shared corpus
 *   (useCaseCorpus) plus the case's DOL filing date (decoded from its number)
 *   run through the SAME `buildCaseEstimate` the public case page uses, so the
 *   app and the public site can never name different days.
 *
 * Everything is labelled an estimate and dated; nothing reads as a promise on a
 * case an attorney is managing.
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
import { canonicalStatus, statusMeaning } from "@/lib/caseStatusVocabulary";
import { formatAsOf } from "@/lib/dolFormat";
import { liveStatusTone, LIVE_DOT } from "@/components/cases/LiveStatusChip";

/** The 5 case stages, labelled for the "your stage" line (client-safe, no convex import). */
const STAGE_LABEL: Record<string, string> = {
  pwd: "Prevailing wage",
  recruitment: "Recruitment",
  eta9089: "ETA-9089",
  i140: "I-140",
  closed: "Closed",
};

export interface CaseEstimateSectionCase {
  _id: Id<"cases">;
  caseNumber?: string | null;
  caseStatus?: string | null;
  liveStatus?: string | null;
  liveStatusSeenAt?: number | null;
  liveStatusIsFinal?: boolean | null;
  watchEnabled?: boolean | null;
}

/** The per-case watch switch. Absent `watchEnabled` means on. */
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
  const watchOff = caseData.watchEnabled === false;

  // No DOL number: nothing to watch or estimate. Invite one, quietly.
  if (!parsed) {
    return (
      <section aria-labelledby="dol-live-h" className="border-t-2 border-[var(--object-border)] pt-4">
        <h2 id="dol-live-h" className="font-heading text-lg font-bold">
          DOL&rsquo;s live status
        </h2>{" "}
        <p className="mt-2 text-sm text-muted-foreground">
          Add this case&rsquo;s DOL number to watch its live status and see an estimated decision date.
        </p>
      </section>
    );
  }

  const liveStatus = caseData.liveStatus ?? null;
  const live = liveStatus ? canonicalStatus(liveStatus) : null;
  const tone = live ? liveStatusTone(live) : "neutral";
  const meaning = live ? statusMeaning(live) : null;
  const seen = typeof caseData.liveStatusSeenAt === "number" ? formatAsOf(new Date(caseData.liveStatusSeenAt).toISOString().slice(0, 10)) : null;
  const stageLabel = caseData.caseStatus ? (STAGE_LABEL[caseData.caseStatus] ?? caseData.caseStatus) : null;

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

  return (
    <section aria-labelledby="dol-live-h" className="border-t-2 border-[var(--object-border)] pt-4">
      <h2 id="dol-live-h" className="font-heading text-lg font-bold">
        DOL&rsquo;s live status
      </h2>{" "}

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {/* DOL's live status, from the case's own record. */}
        <div className="border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-muted-foreground">From DOL</p>{" "}
            <WatchToggle caseId={caseData._id} enabled={!watchOff} />
          </div>
          {live ? (
            <>
              <p className="mt-1 flex items-center gap-2 font-heading text-base font-bold">
                <span className={`inline-block h-2.5 w-2.5 shrink-0 ${LIVE_DOT[tone]}`} aria-hidden="true" />
                {live}
              </p>
              {meaning ? <p className="mt-1 text-sm text-muted-foreground">{meaning}</p> : null}
              {seen ? <p className="mt-1 text-xs text-muted-foreground">DOL&rsquo;s record, seen {seen}</p> : null}
            </>
          ) : watchOff ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Watching is off for this case. Turn it on to hear when DOL moves it.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Not seen yet. We check DOL on weekdays and will record its status here.
            </p>
          )}
        </div>

        {/* The firm's own stage, for comparison. DOL never overwrites it. */}
        <div className="border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground">Your stage</p>{" "}
          <p className="mt-1 font-heading text-base font-bold">{stageLabel ?? "Not set"}</p>{" "}
          <p className="mt-1 text-xs text-muted-foreground">You keep this; DOL&rsquo;s word above never changes it.</p>
        </div>
      </div>

      {est?.estimate ? (
        <div className="mt-4">
          <CaseEstimatePanel est={est.estimate} />
        </div>
      ) : null}

      {est?.lineAhead && live === "ANALYST REVIEW" && est.lineAhead.length > 0 ? (
        <div className="mt-4">
          <LineAhead rows={est.lineAhead} perDay={corpus?.decisionPace?.pace ?? null} />
        </div>
      ) : null}
    </section>
  );
}
