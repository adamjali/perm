import { Fragment } from "react";
import Link from "next/link";

import type { FlagCaseRow } from "@/lib/db/flagCases";
import { seasonalForm } from "@/lib/seasonalForms";
import { CASE_ROW, CASE_ROW_LINK } from "@/components/entities/caseRows";

/**
 * One employer's H-2A and H-2B filings, newest first, from DOL's live record.
 *
 * Rendered only when the employer has any: most PERM sponsors file none, and
 * an empty band would read as a gap in the record. Each number links to its
 * live status; the form is read off the prefix, because H-300, H-400 and
 * P-400 are three different forms under one table. No wage column: the live
 * endpoint never returns one, and DOL's quarterly H-2A and H-2B files are not
 * loaded.
 */
export function SeasonalFilings({
  name,
  rows,
  className = "mt-10",
}: {
  name: string;
  /** Newest first, already capped by the caller. */
  rows: FlagCaseRow[];
  className?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className={`${className}`}>
      <h2 className="font-heading text-xl font-bold">Seasonal work: H-2A, H-2B and CW-1</h2>{" "}
      <p className="mt-2 text-base leading-relaxed text-muted-foreground">
        Filed by {name}, as DOL&apos;s case-status service shows them.
      </p>{" "}
      <ul className="mt-4 divide-y divide-border/60">
        {rows.map((r) => (
          <Fragment key={r.caseNumber}>
            {" "}
            <li className={CASE_ROW}>
              <Link
                href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                className={CASE_ROW_LINK}
              >
                {r.caseNumber}
              </Link>{" "}
              <span className="text-sm font-bold">{seasonalForm(r.caseNumber)?.label ?? "H-2A, H-2B or CW-1 filing"}</span>{" "}
              {r.jobTitle ? <span className="text-soft">{r.jobTitle}</span> : null}{" "}
              <span className="ml-auto font-mono text-sm font-bold text-muted-foreground">
                {r.filingDate ? `${r.filingDate} · ` : ""}
                {r.status}
              </span>
            </li>
          </Fragment>
        ))}
      </ul>{" "}
      <p className="mt-3 text-sm">
        <Link
          href={`/seasonal-cases?q=${encodeURIComponent(name)}`}
          className="link"
        >
          All H-2A, H-2B and CW-1 filings by this employer
        </Link>
      </p>
    </section>
  );
}
