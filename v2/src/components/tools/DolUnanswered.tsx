import { DOL_CASE_STATUS_URL } from "@/components/queue/SourceNote";
import { AnswerPanel } from "@/components/tools/Insight";
import { WatchThisNumber } from "@/components/tools/WatchThisNumber";
import { unsettledClause, unsettledVerdict, type LookupGap } from "@/lib/dolMiss";
import type { FlagProgram } from "@/lib/flagCaseNumber";

/**
 * A lookup DOL could not settle: it did not answer in time, or it was not
 * asked because the site's daily limit for live checks was used up.
 *
 * Neither may read as "no record", which would tell the reader DOL had no
 * such case when it had only been slow. This says what happened, that it is
 * usually brief, and gives a retry and DOL's own search.
 */
export function DolUnanswered({
  caseNumber,
  label,
  miss,
  watch,
}: {
  caseNumber: string;
  /** What the number is, e.g. "Prevailing wage request". */
  label: string;
  miss: LookupGap;
  /** Offer the email and push alerts for this number, as the program's own result does. */
  watch?: FlagProgram;
}) {
  const retry = `/perm-case-status?case=${encodeURIComponent(caseNumber)}`;
  return (
    <AnswerPanel
      verdict={unsettledVerdict(miss)}
      direction="flat"
      label={
        <>
          {label} <span translate="no">{caseNumber}</span>
        </>
      }
      actions={
        watch ? (
          <div className="mt-6 border-t border-foreground/10 pt-6">
            <WatchThisNumber caseNumber={caseNumber} program={watch} variant="inline" />
          </div>
        ) : undefined
      }
    >
      {miss === "records" ? "We couldn't check this number just now: " : "We hold no record for this number yet, "}
      {unsettledClause(miss)}{" "}
      <a href={retry} className="link">
        Try again
      </a>{" "}
      or use{" "}
      <a href={DOL_CASE_STATUS_URL} className="link" rel="noopener">
        DOL&apos;s own case status page
      </a>
      .
    </AnswerPanel>
  );
}
