import Link from "next/link";

import type { WarnNotice as Notice } from "@/lib/turso/warn";

/**
 * A sponsor's WARN notices, on its own page. One line per filing as the
 * state printed it, with the state named, because a notice is a public
 * filing and not a finding of anything. The layoff rule the reader may be
 * wondering about is linked rather than restated.
 */

const long = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const STATE_NAME: Record<string, string> = { CA: "California" };

export function WarnNoticeBand({ rows, pageName }: { rows: Notice[]; pageName: string }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-8 border-2 border-border bg-card p-5 shadow-hard sm:p-6" aria-labelledby="warn-heading">
      <h2 id="warn-heading" className="font-heading text-xl font-black">
        Layoff notices filed by {pageName}
      </h2>{" "}
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/70">
        Filed with the state under the WARN Act, which requires 60 days&apos; notice of a mass layoff or closing. As
        printed by the state; matched to this sponsor by the same name rule that groups DOL&apos;s spellings.{" "}
        <Link href="/guides/employer-layoffs-and-your-perm" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
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
            <a href={r.sourceUrl} rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary">
              {STATE_NAME[r.state] ?? r.state} WARN report
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
