import { Fragment } from "react";
import Link from "next/link";

import { YearlyPayNote } from "@/components/data/YearlyPayNote";
import { FromDolLive } from "@/components/entities/FromDolLive";
import type { UnifiedFlagRow } from "@/lib/flagMerge";
import { formatWage } from "@/lib/wageFormat";

/**
 * One employer's newest wage requests and H-1B LCAs, two columns of five.
 *
 * Every row comes from DOL's case-status service; decided ones also carry the
 * wage from its quarterly file. Shared by the PERM employer page (where these are the
 * steps before the PERM) and the page for an employer with no PERM record
 * (where they are the record). Absent when the employer has neither.
 */

const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export function WageAndLcaFilings({
  name,
  wageReqs,
  lcas,
  heading,
  className = "mt-10",
}: {
  name: string;
  wageReqs: UnifiedFlagRow[];
  lcas: UnifiedFlagRow[];
  heading: string;
  className?: string;
}) {
  if (wageReqs.length === 0 && lcas.length === 0) return null;
  return (
    <section className={`${className} border border-border bg-card p-6 sm:p-8`}>
      <h2 className="font-heading text-xl font-bold sm:text-2xl">{heading}</h2>{" "}
      <p className="mt-2 text-base leading-relaxed text-muted-foreground">
        Filed by {name}, newest first. Decided ones carry the wage from DOL&apos;s quarterly files.
      </p>{" "}
      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 [&>*]:min-w-0">
        {[
          { label: "Wage requests", all: "All wage requests", rows: wageReqs, href: `/pwd-cases?q=${encodeURIComponent(name)}` },
          { label: "H-1B LCAs", all: "All H-1B LCAs", rows: lcas, href: `/lca-cases?q=${encodeURIComponent(name)}` },
        ].map((col) => (
          <Fragment key={col.label}>
            {" "}
            <div>
              <h3 className="text-sm font-bold text-muted-foreground">{col.label}</h3>{" "}
              {col.rows.length > 0 ? (
                <ul className="mt-2 divide-y divide-border/60">
                  {col.rows.map((r) => (
                    <Fragment key={r.caseNumber}>
                      {" "}
                      <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-base">
                        <Link
                          href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                          className="font-mono text-sm font-bold underline decoration-primary decoration-2 underline-offset-2"
                        >
                          {r.caseNumber}
                        </Link>{" "}
                        {r.jobTitle ? <span className="text-soft">{r.jobTitle}</span> : null}{" "}
                        {formatWage(r.wage, r.wageUnit) ? (
                          <span className="font-mono text-sm font-bold">
                            {formatWage(r.wage, r.wageUnit)}
                            <YearlyPayNote wage={r.wage} unit={r.wageUnit} short />
                          </span>
                        ) : null}{" "}
                        <span className="ml-auto font-mono text-sm font-bold text-muted-foreground">
                          {r.date ? `${r.date} · ` : ""}
                          {r.status}
                        </span>
                      </li>
                    </Fragment>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">None confirmed yet.</p>
              )}{" "}
              <p className="mt-2 text-sm">
                <Link href={col.href} className={LINK}>
                  {col.all} by this employer
                </Link>
              </p>
            </div>
          </Fragment>
        ))}
      </div>{" "}
      <FromDolLive />
    </section>
  );
}
