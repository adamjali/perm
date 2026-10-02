import { Fragment } from "react";
import { WarningIcon } from "@phosphor-icons/react/ssr";

import { FinePrint } from "@/components/data/FinePrint";
import { getFreshness, type DatasetFreshness } from "@/lib/turso/publicData";
import { coverageFor } from "@/lib/datasetCoverage";

/**
 * Where a page's figures came from, rendered beside them: one line per
 * dataset with its source, the date the data runs to and how often it
 * refreshes, read from the registry the ingests maintain.
 *
 * What each dataset INCLUDES (decided cases only, pending included, no wage)
 * is a longer sentence per dataset, so it sits in one fold under the lines.
 * It stays in the page either way, for search engines and for anyone who
 * opens it.
 */
export async function DataProvenance({ datasets, className }: { datasets: string[]; className?: string }) {
  const all: Record<string, DatasetFreshness> = await getFreshness().catch(() => ({}));
  // A type-guard filter: .filter(Boolean) doesn't narrow away the
  // `| undefined` that noUncheckedIndexedAccess puts on all[d].
  const rows = datasets
    .map((d) => all[d])
    .filter((r): r is DatasetFreshness => r !== undefined);
  if (rows.length === 0) return null;
  const covered = rows.flatMap((r) => {
    const text = coverageFor(r.dataset);
    return text ? [{ dataset: r.dataset, text }] : [];
  });
  return (
    <div className={className ?? "mt-6 border-t-2 border-border pt-3"}>
      {rows.map((r) => (
        // Keyed Fragment with a leading space: array items render with nothing
        // between them, so two lines would otherwise read as one run of text.
        <Fragment key={r.dataset}>
          {" "}
          {r.stale ? <StaleLine r={r} /> : (
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground/80">{label(r.dataset)}:</span> {r.source}
              {r.asOf ? <> · data through {fmt(r.asOf)}</> : null} · {r.cadence.toLowerCase()}
            </p>
          )}
        </Fragment>
      ))}{" "}
      {covered.length > 0 ? (
        <FinePrint summary={covered.length === 1 ? "What this data includes" : "What each source includes"} className="mt-1">
          {covered.map((c) => (
            <p key={c.dataset}>
              <span className="font-bold text-foreground/80">{label(c.dataset)}:</span> {c.text}
            </p>
          ))}
        </FinePrint>
      ) : null}
    </div>
  );
}

/**
 * A dataset whose ingest has stopped. The figures stay as they are (they are
 * the last real measurement); what changes is that the page stops implying
 * they're current. Shown only when `stale` is set, which needs both the age
 * and the budget to be known: an unreadable date isn't evidence of staleness,
 * and a warning on every page teaches people to ignore the one that matters.
 */
function StaleLine({ r }: { r: DatasetFreshness }) {
  return (
    <p className="mt-2 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-3 py-2 text-sm text-foreground/80 first:mt-0">
      <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
      <span>
        <b className="font-bold text-data-warn-ink">
          {label(r.dataset)} has not refreshed{agePhrase(r)}.
        </b>{" "}
        It should update {r.cadence.toLowerCase()}, so the figures below are the last ones that arrived rather than
        the current ones. Source: {r.source}
        {r.asOf ? <> · data through {fmt(r.asOf)}</> : null}.
      </span>
    </p>
  );
}

/**
 * How overdue, in the plainest words that stay true.
 *
 * Returns an empty string when the age is unknown, so the sentence degrades
 * to "X has not refreshed." rather than "has not refreshed in null days".
 */
function agePhrase(r: DatasetFreshness): string {
  if (r.ageDays === null) return "";
  if (r.ageDays === 1) return " in a day";
  return ` in ${r.ageDays} days`;
}

function label(d: string): string {
  const names: Record<string, string> = {
    "perm-cases": "Case data",
    "processing-times": "Processing times",
    "visa-bulletin": "Visa bulletin",
    "daily-decisions": "Daily decisions",
    "uscis-i140-times": "I-140 times",
    "i485-inventory": "I-485 pending inventory",
    "perm-month-stats": "Pending case counts",
    "perm-case-status": "Per-case statuses",
    "pwd-status": "Wage request statuses",
    "lca-status": "LCA statuses",
    "seasonal-status": "H-2A and H-2B statuses",
    "pw-disclosure": "Wage determinations",
    "lca-disclosure": "LCA disclosures",
    "policy-notices": "Federal Register notices",
    debarments: "DOL debarment lists",
    "i140-trends": "I-140 filings by category",
    "rfi-funnel": "RFI and audit outcomes",
    entities: "Employers and firms",
    "uscis-form-quarters": "USCIS quarterly form data",
    "uscis-h1b-hub": "USCIS H-1B Employer Data Hub",
    "sevp-top-employers": "ICE top OPT and CPT employers",
    "uscis-i485-offices": "I-485 by field office",
    "uscis-eb-awaiting-visa": "Petitions awaiting a visa",
    "uscis-i140-class-country": "I-140 by class and country",
  };
  return names[d] ?? d;
}

function fmt(iso: string): string {
  // "2026-06-30" -> "Jun 30, 2026"; "2026-09" -> "Sep 2026"; else verbatim.
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(iso);
  if (!m) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const name = months[Number(m[2]) - 1];
  return m[3] ? `${name} ${Number(m[3])}, ${m[1]}` : `${name} ${m[1]}`;
}
