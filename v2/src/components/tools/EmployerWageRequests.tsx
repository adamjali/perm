import { YearlyPayNote } from "@/components/data/YearlyPayNote";
import { FinePrint } from "@/components/data/FinePrint";
import { PageSection } from "@/components/data/PageSection";
import { FilingRows } from "@/components/entities/FilingRows";
import {
  PERM_AFTER_WAGE_MONTHS,
  WAGE_REQUEST_LOOKBACK_MONTHS,
  WAGE_REQUESTS_SHOWN,
  type EmployerPermCases as FoundPerm,
  type EmployerWageRequests as Found,
} from "@/lib/employerWageRequests";
import { formatWage } from "@/lib/wageFormat";

/**
 * A pending PERM case's likely wage request: the employer's PERM wage requests for the same job title with a
 * wage issued by the day the case was filed. DOL's live record doesn't say which one the case used (its
 * published file does, once the case is decided), so the lede says "very likely one of these", each row links
 * its own page, and the rule behind the list folds under "Why these". The rows are the site's filings table
 * (FilingRows), dated by the day DOL issued the wage, which is what decides whether a request could be it.
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
  const who = employerName?.trim() || "the employer";
  const job = jobTitle?.trim() ? `“${jobTitle.trim()}”` : "this job";
  return (
    <PageSection
      title="The wage request behind it"
      id="wage-request"
      lede={
        more
          ? "This case’s wage request is very likely one of these, or an older one. DOL names it only once the case is decided."
          : "This case’s wage request is very likely one of these. DOL names it only once the case is decided."
      }
    >
      <FilingRows
        withWage
        dateLabel="Wage issued"
        rows={rows.map((r) => {
          const wage = formatWage(r.wage, r.wageUnit);
          return {
            caseNumber: r.caseNumber,
            job: r.jobTitle,
            // The day the wage was issued, or blank: a filing day under this heading would be a wrong date.
            date: r.decided,
            status: r.status,
            wage: wage ? (
              <>
                {wage}
                <YearlyPayNote wage={r.wage} unit={r.wageUnit} short />
              </>
            ) : null,
          };
        })}
      />{" "}
      <FinePrint summary="Why these" className="mt-3">
        <p>
          These are {who}’s PERM wage requests for {job} on which DOL issued a wage by the day this case was filed,
          from the {WAGE_REQUEST_LOOKBACK_MONTHS} months before it.
          {more ? ` There were more than ${WAGE_REQUESTS_SHOWN}, so these are the newest.` : ""}
        </p>{" "}
        <p>
          A request still waiting, withdrawn, or decided after the filing is left out. A PERM case is filed on a wage
          DOL has already issued. DOL’s published file names the case’s own request once the case is decided.
        </p>
      </FinePrint>
    </PageSection>
  );
}

/**
 * The reverse, on a wage request's page: the employer's PERM cases for the same job title filed after DOL issued
 * its wage, shown when no decided PERM case names it yet (DOL's file names it only once the PERM is decided).
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
  const who = employerName?.trim() || "the employer";
  const job = jobTitle?.trim() ? `“${jobTitle.trim()}”` : "this job";
  return (
    <PageSection
      title="The PERM case it may support"
      id="perm-cases"
      lede="The PERM case this wage supports is very likely one of these. DOL names it only once that case is decided."
    >
      <FilingRows rows={rows.map((r) => ({ caseNumber: r.caseNumber, job: jobTitle, date: r.filed, status: r.status }))} />{" "}
      <FinePrint summary="Why these" className="mt-3">
        <p>
          These are {who}’s PERM cases for {job} filed in the {PERM_AFTER_WAGE_MONTHS} months after DOL issued this
          wage.
          {more ? ` There were more than ${WAGE_REQUESTS_SHOWN}, so these are the newest.` : ""}
        </p>{" "}
        <p>A PERM case is filed on a wage DOL has already issued, so nothing filed before that day is listed.</p>
      </FinePrint>
    </PageSection>
  );
}
