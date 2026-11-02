import Link from "next/link";

import { PageSection } from "@/components/data/PageSection";
import { prettyStatus } from "@/components/queue/stages";
import { formatDay } from "@/lib/dolFormat";
import {
  PERM_AFTER_WAGE_MONTHS,
  WAGE_REQUEST_LOOKBACK_MONTHS,
  type EmployerPermCases as FoundPerm,
  type EmployerWageRequests as Found,
} from "@/lib/employerWageRequests";
import { formatWage } from "@/lib/wageFormat";

/**
 * A pending PERM case's likely wage request: the employer's PERM wage requests for the same job title with a
 * wage issued by the day the case was filed. DOL's live record doesn't say which one the case used (its published file does, once the
 * case is decided), so the heading says "very likely one of these" and each links its own page.
 */
export function EmployerWageRequests({
  found,
  employerName,
  jobTitle,
}: {
  found: Found | null;
  employerName: string | null;
  jobTitle: string | null;
}) {
  if (!found || found.rows.length === 0) return null;
  const { rows, more } = found;
  const who = employerName?.trim() || "The employer";
  const job = jobTitle?.trim() ? `"${jobTitle.trim()}"` : "this job";
  return (
    <PageSection
      title="The wage request behind it"
      id="wage-request"
      lede={
        more
          ? `DOL's record of a pending case doesn't name its wage request. Its published file does, once the case is decided. ${who} had more PERM wage requests for ${job} with a wage issued by the day this case was filed than fit here. These are the newest, from the ${WAGE_REQUEST_LOOKBACK_MONTHS} months before it. This case's may be one of them, or an older one.`
          : `DOL's record of a pending case doesn't name its wage request. Its published file does, once the case is decided. These are ${who}'s PERM wage requests for ${job} that DOL had issued a wage on by the day this case was filed, from the ${WAGE_REQUEST_LOOKBACK_MONTHS} months before it. This case's is very likely one of them.`
      }
    >
      <ul className="max-w-3xl divide-y-2 divide-border border-y-2 border-border">
        {rows.map((r) => {
          const wage = formatWage(r.wage, r.wageUnit);
          return (
            <li key={r.caseNumber} className="grid grid-cols-1 gap-x-4 gap-y-1 py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center [&>*]:min-w-0">
              <Link href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`} className="link inline-flex min-h-11 items-center font-mono">
                {r.caseNumber}
              </Link>{" "}
              <span className="text-soft">
                {prettyStatus(r.status.toUpperCase())}
                {r.filed ? `, filed ${formatDay(r.filed)}` : ""}
                {r.decided ? `, decided ${formatDay(r.decided)}` : ""}
                {wage ? `, ${wage}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </PageSection>
  );
}

/**
 * The reverse, on a wage request's page: the employer's PERM cases for the same job title filed after DOL issued its wage,
 * shown when no decided PERM case names it yet (DOL's file names it only once the PERM is decided).
 */
export function EmployerPermCasesForWage({
  found,
  employerName,
  jobTitle,
}: {
  found: FoundPerm | null;
  employerName: string | null;
  jobTitle: string | null;
}) {
  if (!found || found.rows.length === 0) return null;
  const { rows, more } = found;
  const who = employerName?.trim() || "The employer";
  const job = jobTitle?.trim() ? `"${jobTitle.trim()}"` : "this job";
  return (
    <PageSection
      title="The PERM case it may support"
      id="perm-cases"
      lede={
        more
          ? `No decided PERM case names this wage request yet. DOL's file names it once the PERM is decided. ${who} filed more PERM cases for ${job} in the ${PERM_AFTER_WAGE_MONTHS} months after DOL issued this wage than fit here. These are the newest.`
          : `No decided PERM case names this wage request yet. DOL's file names it once the PERM is decided. These are ${who}'s PERM cases for ${job} filed in the ${PERM_AFTER_WAGE_MONTHS} months after DOL issued this wage. The one it supports is very likely among them.`
      }
    >
      <ul className="max-w-3xl divide-y-2 divide-border border-y-2 border-border">
        {rows.map((r) => (
          <li key={r.caseNumber} className="grid grid-cols-1 gap-x-4 gap-y-1 py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center [&>*]:min-w-0">
            <Link href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`} className="link inline-flex min-h-11 items-center font-mono">
              {r.caseNumber}
            </Link>{" "}
            <span className="text-soft">
              {prettyStatus(r.status.toUpperCase())}
              {r.filed ? `, filed ${formatDay(r.filed)}` : ""}
              {r.decided ? `, decided ${formatDay(r.decided)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </PageSection>
  );
}
