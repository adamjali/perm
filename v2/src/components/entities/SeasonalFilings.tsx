import Link from "next/link";

import type { FlagCaseRow } from "@/lib/db/flagCases";
import { seasonalForm } from "@/lib/seasonalForms";
import { FilingRows } from "@/components/entities/FilingRows";

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
      <p className="mt-1 text-sm text-muted-foreground">As DOL&apos;s case-status service shows them.</p>{" "}
      <FilingRows
        className="mt-4"
        rows={rows.map((r) => ({
          caseNumber: r.caseNumber,
          job: [seasonalForm(r.caseNumber)?.label ?? "H-2A, H-2B or CW-1 filing", r.jobTitle].filter(Boolean).join(": "),
          date: r.filingDate,
          status: r.status,
        }))}
      />{" "}
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
