import { Fragment } from "react";
import Link from "next/link";

import type { FlagCaseRow } from "@/lib/turso/flagCases";
import { seasonalForm } from "@/lib/seasonalForms";

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
    <section className={`${className} border-2 border-border bg-card p-6 shadow-hard sm:p-8`}>
      <h2 className="font-heading text-xl font-black sm:text-2xl">Seasonal work: H-2A and H-2B</h2>{" "}
      <p className="mt-2 text-base leading-relaxed text-foreground/70">
        Filed by {name}, as DOL&apos;s daily check shows them.
      </p>{" "}
      <ul className="mt-4 divide-y divide-border/60">
        {rows.map((r) => (
          <Fragment key={r.caseNumber}>
            {" "}
            <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-base">
              <Link
                href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                className="font-mono text-sm font-bold underline decoration-primary decoration-2 underline-offset-2"
              >
                {r.caseNumber}
              </Link>{" "}
              <span className="text-sm font-bold">{seasonalForm(r.caseNumber)?.label ?? "H-2A or H-2B filing"}</span>{" "}
              {r.jobTitle ? <span className="text-foreground/80">{r.jobTitle}</span> : null}{" "}
              <span className="ml-auto font-mono text-sm font-bold uppercase text-foreground/70">
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
          className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
        >
          All H-2A and H-2B filings by this employer
        </Link>
      </p>
    </section>
  );
}
