import Link from "next/link";

import { breakdownParts, holdSincePhrase, type EmployerStageRow } from "@/lib/employerStages";
import { FinePrint } from "@/components/data/FinePrint";
import { PROGRAM_LABEL, WAGE_FLOOR, wageGap, wageGapSentence, type ProgramLine } from "@/lib/employerPrograms";
import { formatDollars, formatInt, formatShare } from "@/lib/format";

/**
 * One employer across DOL's programs, as a ledger.
 *
 * Three rows in the prose's own measure: what DOL has published, what its
 * live record shows still open, and the median wage on the published rows.
 * Under it, one sentence about the gap between the H-1B wage and the PERM
 * wage when both sides clear the floor, and one about how many of its PERM
 * cases sit outside DOL's normal queue when the employer is in that census,
 * each count named by who acted and the hold dated from this site's record.
 * Plain server markup; every figure carries the count it rests on.
 */

const LINK = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export function EmployerPrograms({
  name: _name,
  perm,
  pwd,
  lca,
  seasonal = null,
  stages,
  logFrom = null,
  searchHref,
  spellings = null,
}: {
  name: string;
  /** Null on a page for an employer with no PERM record: the ledger then shows the programs it does file. */
  perm: ProgramLine | null;
  pwd: ProgramLine | null;
  lca: ProgramLine | null;
  /** H-2A, H-2B and CW-1, only when the employer has filed any. */
  seasonal?: ProgramLine | null;
  /** This employer's row in the outside-the-queue census, when it has five or more pending cases. */
  stages: EmployerStageRow | null;
  /** The first day of the site's status-change record, which dates a hold. */
  logFrom?: string | null;
  /** The unified search prefilled with this employer. */
  searchHref: string;
  /** How many spellings of the employer's name the files were read under, when the nightly map named them. */
  spellings?: number | null;
}) {
  const lines: ProgramLine[] = [...(perm ? [perm] : []), ...(pwd ? [pwd] : []), ...(lca ? [lca] : []), ...(seasonal ? [seasonal] : [])];
  const gap = wageGap(perm, lca);
  return (
    <section className="mt-10">
      <h2 className="font-heading text-xl font-black sm:text-2xl">Across DOL&apos;s programs</h2>{" "}
      <p className="mt-2 max-w-3xl text-base text-foreground/75">
        {perm ? "The wage request, the PERM and the H-1B labor condition application" : "Each program it files"}
        {perm && seasonal ? ", and its seasonal H-2A, H-2B and CW-1 work" : ""}, one line each.
      </p>{" "}
      <dl className="mt-4 max-w-3xl border-t-2 border-border">
        {lines.map((l) => (
          <div
            key={l.program}
            className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_8rem] sm:items-baseline sm:gap-x-4"
          >
            <dt className="text-base font-bold">{PROGRAM_LABEL[l.program]}</dt>{" "}
            <dd className="tabular-nums sm:text-right">
              <span className="font-heading text-lg font-black">{formatInt(l.published)}</span>{" "}
              <span className="text-sm text-muted-foreground">published</span>
            </dd>{" "}
            <dd className="tabular-nums sm:text-right">
              {l.pending === null ? (
                <span className="text-sm text-muted-foreground">no live read</span>
              ) : (
                <>
                  <span className="font-heading text-lg font-black">{formatInt(l.pending)}</span>{" "}
                  <span className="text-sm text-muted-foreground">pending</span>
                </>
              )}
            </dd>{" "}
            <dd className="tabular-nums sm:text-right">
              {l.medianHourlyWage !== undefined ? (
                l.medianHourlyWage !== null && l.wageN >= WAGE_FLOOR ? (
                  <>
                    <span className="font-heading text-lg font-black">
                      ${l.medianHourlyWage.toFixed(2)}
                    </span>{" "}
                    <span className="text-sm text-muted-foreground">an hour, median, n={formatInt(l.wageN)}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {l.wageN > 0 ? `${formatInt(l.wageN)} hourly wage${l.wageN === 1 ? "" : "s"}, under the floor` : "no hourly wage published"}
                  </span>
                )
              ) : l.medianAnnualWage !== null && l.wageN >= WAGE_FLOOR ? (
                <>
                  <span className="font-heading text-lg font-black">{formatDollars(l.medianAnnualWage)}</span>{" "}
                  <span className="text-sm text-muted-foreground">median, n={formatInt(l.wageN)}</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {l.wageN > 0 ? `${formatInt(l.wageN)} wage${l.wageN === 1 ? "" : "s"}, under the floor` : "no wage published"}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>{" "}
      {gap ? <p className="mt-4 max-w-3xl text-base leading-relaxed text-foreground/85">{wageGapSentence(gap)}</p> : null}{" "}
      {stages && stages.review > 0 ? (
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/85">
          {(() => {
            const parts = breakdownParts(stages);
            const since = holdSincePhrase(stages, logFrom);
            return `Of its ${formatInt(stages.pending)} pending PERM cases, ${formatInt(stages.review)} (${formatShare(stages.share)}) sit outside DOL's normal queue${
              parts.length ? `: ${parts.join(", ")}` : ""
            }.${since ? ` The hold, from this site's daily record: ${since}.` : ""}`;
          })()}{" "}
          <Link href="/perm-employers/under-review" className={LINK}>
            Where that sits among every employer
          </Link>
          .
        </p>
      ) : null}{" "}
      <p className="mt-3 max-w-3xl text-sm text-foreground/75">
        <Link href={searchHref} className={LINK}>
          Every case across these programs
        </Link>{" "}
        is in the search.
      </p>{" "}
      <FinePrint summary="How these are counted" className="mt-1">
        <p>
          Medians are of the published rows with a usable wage, annualised from
          whatever unit the filing quoted, and withheld under {WAGE_FLOOR} wages.
          {" "}DOL publishes no employer number, so filings are matched by the employer&apos;s legal name
          {spellings && spellings > 1 ? `, read under the ${formatInt(spellings)} spellings DOL's files use for it` : ""}
          ; another employer with the same legal name would be counted here too.{" "}
          The PERM is the green-card step; the wage request comes months before
          it, and the LCA is the separate form for an H-1B. DOL publishes each
          in its own file, and its live record shows what is still open.
          {seasonal
            ? ` Seasonal wages stay hourly, as DOL's H-2A, H-2B and CW-1 files quote them: a job lasting a season, annualised over a full year, would describe pay nobody earns.${seasonal.workersCertified ? ` DOL certified ${formatInt(seasonal.workersCertified)} workers across these filings.` : ""}`
            : ""}
        </p>
      </FinePrint>
    </section>
  );
}
