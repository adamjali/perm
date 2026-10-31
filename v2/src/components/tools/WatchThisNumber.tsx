import { CaseAlertForm } from "@/components/tools/CaseAlertForm";
import { CasePushAlert } from "@/components/tools/CasePushAlert";
import type { FlagProgram } from "@/lib/flagCaseNumber";
import { cn } from "@/lib/utils";

/**
 * The two ways to hear when a case number moves: an email, and folded under
 * it a browser notification. Offered for every program the alert sweeps watch
 * (convex/caseAlerts.ts reads all four tables), on a pending case and on a
 * number we hold no record for yet: a recent filing DOL hasn't indexed is the
 * case most worth watching. Both forms work out the program from the number;
 * `program` only changes the wording.
 *
 * `inline` sits inside a result's answer panel; `card` stands on its own.
 */
export function WatchThisNumber({
  caseNumber,
  program,
  variant = "card",
  className,
}: {
  caseNumber: string;
  program: FlagProgram;
  variant?: "inline" | "card";
  className?: string;
}) {
  return (
    <div className={cn(variant === "card" && "object p-5 sm:p-6", className)}>
      <CaseAlertForm caseNumber={caseNumber} program={program} />{" "}
      <CasePushAlert caseNumber={caseNumber} />
    </div>
  );
}
