import Link from "next/link";

import type { WarnNotice as Notice } from "@/lib/db/warn";
import { warnDate, warnStateName } from "@/lib/warnStates";

/**
 * A sponsor's WARN notices, on its own page. One line per filing as the
 * state printed it, with the state named, because a notice is a public
 * filing and not a finding of anything. The layoff rule the reader may be
 * wondering about is linked rather than restated.
 *
 * The site sits on a second line where the state gives one. Without it, two
 * notices a company filed the same day for different sites print identically
 * and read as a duplicate.
 */

// New Jersey and Pennsylvania print a notice's month, not its day: "October 2026".
const long = (iso: string) => warnDate(iso, "long");

export function WarnNoticeBand({ rows, pageName }: { rows: Notice[]; pageName: string }) {
  if (rows.length === 0) return null;
  return (
    <section id="layoffs" className="mt-8 border-2 shadow-hard p-5 sm:p-6 bg-card border-border" aria-labelledby="warn-heading">
      <h2 id="warn-heading" className="font-heading text-xl font-bold">
        Layoff notices filed by {pageName}
      </h2>{" "}
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Notices of a mass layoff or closing filed with the state under the WARN Act, as the state printed them,
        matched to this sponsor by name.{" "}
        <Link href="/guides/employer-layoffs-and-your-perm" className="link">
          What a layoff means for a PERM
        </Link>
        .
      </p>{" "}
      <ul className="mt-4 divide-y divide-border/40 border-t border-border/40">
        {rows.map((r) => (
          <li key={r.id} className="py-3 text-sm leading-relaxed">
            <span className="font-bold">{long(r.noticeDate)}</span>
            {r.kind ? `, ${r.kind.toLowerCase()}` : ""}
            {r.employees !== null ? `, ${r.employees.toLocaleString("en-US")} ${r.employees === 1 ? "employee" : "employees"}` : ""}
            {r.county ? `, ${r.county}` : ""}
            {r.effectiveDate ? `, effective ${long(r.effectiveDate)}` : ""}.{" "}
            <a href={r.sourceUrl} rel="noopener noreferrer" className="link">
              {warnStateName(r.state)} WARN report
            </a>{" "}
            {r.site ? <span className="block text-muted-foreground">{r.site}</span> : null}
          {" "}</li>
        ))}
      </ul>
    </section>
  );
}
