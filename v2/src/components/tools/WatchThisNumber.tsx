import { CaseAlertForm } from "@/components/tools/CaseAlertForm";
import { CasePushAlert } from "@/components/tools/CasePushAlert";
import type { FlagProgram } from "@/lib/flagCaseNumber";

/**
 * The two ways to hear when a case number moves, an email and a browser
 * notification, for every program the alert sweeps watch (convex/caseAlerts.ts
 * reads all four tables). Offered on a pending case, and on a number we hold
 * no record for yet: a recent filing DOL hasn't indexed is the case most worth
 * watching. Both forms work out the program from the number; `program` only
 * changes the wording.
 */
export function WatchThisNumber({
  caseNumber,
  program,
  className,
}: {
  caseNumber: string;
  program: FlagProgram;
  className?: string;
}) {
  return (
    <div className={className}>
      <CaseAlertForm caseNumber={caseNumber} program={program} />{" "}
      <CasePushAlert caseNumber={caseNumber} className="mt-4" />
    </div>
  );
}
