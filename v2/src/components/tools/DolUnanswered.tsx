import { DOL_CASE_STATUS_URL } from "@/components/queue/SourceNote";
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
  const panel = (
    <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
      <p className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">{label}</p>{" "}
      <h2 className="mt-2 break-words font-heading text-2xl font-black">
        {unsettledVerdict(miss)}
      </h2>{" "}
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
        {miss === "records" ? "We couldn't check" : "We hold no record for"}{" "}
        <span className="font-mono font-bold" translate="no">{caseNumber}</span>
        {miss === "records" ? " just now: " : " yet, "}
        {unsettledClause(miss)}{" "}
        <a
          href={retry}
          className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
        >
          Try again
        </a>{" "}
        or use{" "}
        <a
          href={DOL_CASE_STATUS_URL}
          className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
          rel="noopener"
        >
          DOL&apos;s own case status page
        </a>
        .
      </p>
    </section>
  );
  if (!watch) return panel;
  return (
    <div className="space-y-6">
      {panel}{" "}
      <WatchThisNumber caseNumber={caseNumber} program={watch} />
    </div>
  );
}
