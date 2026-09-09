import Link from "next/link";

import type { EmployerStageRow } from "@/lib/employerStages";
import { PROGRAM_LABEL, WAGE_FLOOR, wageGap, wageGapSentence, type ProgramLine } from "@/lib/employerPrograms";

/**
 * One employer across DOL's three programs, as a ledger.
 *
 * Three rows in the prose's own measure: what DOL has published, what its
 * live record shows still open, and the median wage on the published rows.
 * Under it, one sentence about the gap between the H-1B wage and the PERM
 * wage when both sides clear the floor, and one about how much of the PERM
 * queue DOL has pulled aside when the employer is in that census. Plain
 * server markup; every figure carries the count it rests on.
 */

const int = (n: number) => n.toLocaleString("en-US");
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (x: number) => `${(x * 100).toFixed(x >= 0.1 ? 0 : 1)}%`;
const LINK = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export function EmployerPrograms({
  name,
  perm,
  pwd,
  lca,
  stages,
  searchHref,
  matchedPrefix = null,
}: {
  name: string;
  perm: ProgramLine;
  pwd: ProgramLine | null;
  lca: ProgramLine | null;
  /** This employer's row in the pulled-aside census, when it has five or more pending cases. */
  stages: EmployerStageRow | null;
  /** The unified search prefilled with this employer. */
  searchHref: string;
  /** The normalised-name prefix the three files were joined on. */
  matchedPrefix?: string | null;
}) {
  const lines: ProgramLine[] = [perm, ...(pwd ? [pwd] : []), ...(lca ? [lca] : [])];
  const gap = wageGap(perm, lca);
  return (
    <section className="mt-10">
      <h2 className="font-heading text-xl font-black sm:text-2xl">Across DOL&apos;s three programs</h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
        The PERM is the green-card step. The prevailing wage request comes
        months before it, and an H-1B labor condition application is the
        separate form the same employer files to sponsor or extend an H-1B.
        DOL publishes each in its own file, and its live record shows what is
        still open. All three for {name}, on one line each.
      </p>{" "}
      <dl className="mt-4 max-w-3xl border-t-2 border-border">
        {lines.map((l) => (
          <div
            key={l.program}
            className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_8rem] sm:items-baseline sm:gap-x-4"
          >
            <dt className="text-base font-bold">{PROGRAM_LABEL[l.program]}</dt>{" "}
            <dd className="tabular-nums sm:text-right">
              <span className="font-heading text-lg font-black">{int(l.published)}</span>{" "}
              <span className="text-xs text-muted-foreground">published</span>
            </dd>{" "}
            <dd className="tabular-nums sm:text-right">
              {l.pending === null ? (
                <span className="text-xs text-muted-foreground">no live read</span>
              ) : (
                <>
                  <span className="font-heading text-lg font-black">{int(l.pending)}</span>{" "}
                  <span className="text-xs text-muted-foreground">pending</span>
                </>
              )}
            </dd>{" "}
            <dd className="tabular-nums sm:text-right">
              {l.medianAnnualWage !== null && l.wageN >= WAGE_FLOOR ? (
                <>
                  <span className="font-heading text-lg font-black">{usd(l.medianAnnualWage)}</span>{" "}
                  <span className="text-xs text-muted-foreground">median, n={int(l.wageN)}</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {l.wageN > 0 ? `${int(l.wageN)} wage${l.wageN === 1 ? "" : "s"}, under the floor` : "no wage published"}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>{" "}
      {gap ? <p className="mt-4 max-w-3xl text-base leading-relaxed text-foreground/85">{wageGapSentence(gap)}</p> : null}{" "}
      {stages && stages.review > 0 ? (
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/85">
          Of its {int(stages.pending)} pending PERM cases, DOL has pulled {int(stages.review)} aside ({pct(stages.share)}):
          {(stages.byStatus["APPLICATION ON HOLD"] ?? 0) > 0 ? ` ${int(stages.byStatus["APPLICATION ON HOLD"] ?? 0)} on hold,` : ""}
          {(stages.byStatus["RFI ISSUED"] ?? 0) > 0 ? ` ${int(stages.byStatus["RFI ISSUED"] ?? 0)} at RFI,` : ""}{" "}
          the rest in review or on appeal.{" "}
          <Link href="/perm-employers/under-review" className={LINK}>
            Where that sits among every employer
          </Link>
          .
        </p>
      ) : null}{" "}
      <p className="mt-3 max-w-3xl text-sm text-foreground/70">
        Medians are of the published rows with a usable wage, annualised from whatever unit the filing quoted, and withheld under {WAGE_FLOOR} wages.
        {matchedPrefix ? ` The three files spell an employer differently, so they are joined on the name prefix "${matchedPrefix}".` : ""}{" "}
        <Link href={searchHref} className={LINK}>
          Every case across the three programs
        </Link>{" "}
        is in the search.
      </p>
    </section>
  );
}
