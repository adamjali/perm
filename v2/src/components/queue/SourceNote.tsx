/**
 * Where the pending counts come from, and how fresh they are.
 *
 * THIS COMPONENT USED TO SAY THE OPPOSITE, AND IT WAS TRUE WHEN WRITTEN.
 * Until 2026-08-27 the per-case statuses were mirrored from a third-party
 * tracker, because DOL was believed to gate its own case-status lookup. It
 * does not: the FLAG search posts a JSON array of case numbers to an
 * unauthenticated endpoint and answers with the statuses, fifty at a time.
 * The earlier conclusion came from the endpoint's PATH being named
 * `recaptcha`, which is not evidence of anything.
 *
 * So the counts are FIRST-PARTY now. `scripts/ingest_case_status_direct.py`
 * sweeps every undecided case every 12 hours and all of them weekly, and the
 * mirror is kept only as a dispatchable fallback.
 *
 * The file was renamed from `MirrorNote` deliberately. A component called
 * "Mirror" that describes a direct read is the same class of mistake as
 * trusting a path called "recaptcha": a name is not a fact, and the next
 * person to read it should not have to check.
 *
 * WHAT IS STILL TRUE AND STILL WORTH SAYING: this is a snapshot, not a live
 * reading. Between sweeps a case can be decided and still read as pending
 * here, so the backlog figure errs slightly HIGH. That direction is stated
 * rather than left for a reader to infer. It is the safe direction for a
 * wait figure, which is not a reason to leave it unsaid.
 *
 * The decided history is a different dataset with a different cadence:
 * `perm_cases` is DOL's quarterly disclosure release. A reader who assumes
 * one as-of date covers both will be wrong about which, so both dataset keys
 * go to `DataProvenance` on any page carrying both.
 */

import { FinePrint } from "@/components/data/FinePrint";

/** DOL's own case-status search: the source, and the authority for one case. */
export const DOL_CASE_STATUS_URL = "https://flag.dol.gov/case-status-search";

export function SourceNote({ className }: { className?: string }) {
  return (
    // The direction of the error stays visible, because it changes how every
    // figure below should be read. Where the counts come from and how often
    // they are read is provenance, so it collapses; `<details>` keeps it in
    // the DOM for anything that reads the page.
    <div className={className ?? "text-base leading-relaxed text-foreground/80"}>
      <p>
        This is a sweep, not a live reading, so a case decided between sweeps
        still counts as waiting here: the backlog figures run a little high
        rather than a little low.
      </p>{" "}
      <FinePrint summary="Where these come from" className="mt-2">
        <p>
          Anything undecided here is read from{" "}
          <a href={DOL_CASE_STATUS_URL} rel="noopener">
            DOL&rsquo;s own case-status search
          </a>
          , in batches, every 12 hours. That page is also the authority for any
          single case.
        </p>
      </FinePrint>
    </div>
  );
}
