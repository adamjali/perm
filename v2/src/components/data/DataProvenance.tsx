import Link from "next/link";
import { Fragment } from "react";
import { WarningIcon } from "@phosphor-icons/react/ssr";

import { CiteThis } from "@/components/data/CiteThis";
import { FinePrint } from "@/components/data/FinePrint";
import { getFreshness, type DatasetFreshness } from "@/lib/db/publicData";
import { coverageFor, datasetLabel } from "@/lib/datasetCoverage";
import { cn } from "@/lib/utils";
import { MONTH_ABBR } from "@convex/lib/months";

/**
 * Where a page's figures came from, rendered beside them: one line per
 * dataset with its source, the date the data runs to and how often it
 * refreshes, read from the registry the ingests maintain.
 *
 * What each dataset INCLUDES (decided cases only, pending included, no wage)
 * is a longer sentence per dataset, so it sits in one fold under the lines.
 * It stays in the page either way, for search engines and for anyone who
 * opens it.
 *
 * Every data page also says how its figures are counted and how to report a
 * mistake, the same line an article ends with (Oct 28 2026, E-E-A-T:
 * scripts/audit_trust.py finds this block by `data-provenance`).
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
    // A source can be a bare web address with no spaces; on a phone it must wrap
    // anywhere or it pushes the whole page sideways (a State URL did, Oct 5 2026).
    <div data-provenance className={cn(className ?? "mt-6 border-t-2 border-border pt-3", "[overflow-wrap:anywhere]")}>
      {rows.map((r) => (
        // Keyed Fragment with a leading space: array items render with nothing
        // between them, so two lines would otherwise read as one run of text.
        <Fragment key={r.dataset}>
          {" "}
          {r.stale ? <StaleLine r={r} /> : (
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-soft">{label(r.dataset)}:</span> {r.source}
              {r.asOf ? <> · data through {fmt(r.asOf)}</> : null} · {r.cadence.toLowerCase()}
            </p>
          )}
        </Fragment>
      ))}{" "}
      <p className="text-sm text-muted-foreground">
        <Link href="/methodology" className="link">
          How these figures are counted
        </Link>
        . Spotted an error?{" "}
        <Link href="/contact" className="link">
          Tell us
        </Link>
        ; every fix is dated in the{" "}
        <Link href="/changelog/corrections" className="link">
          corrections log
        </Link>
        .
      </p>{" "}
      {covered.length > 0 ? (
        <FinePrint summary={covered.length === 1 ? "What this data includes" : "What each source includes"} className="mt-1">
          {covered.map((c) => (
            <p key={c.dataset}>
              <span className="font-bold text-soft">{label(c.dataset)}:</span> {c.text}
            </p>
          ))}
        </FinePrint>
      ) : null}{" "}
      <CiteThis dataThrough={latest(rows)} />
    </div>
  );
}

/** The newest date any of the page's datasets runs to, as the lines print it. */
function latest(rows: DatasetFreshness[]): string | null {
  const dates = rows.map((r) => r.asOf).filter((d): d is string => !!d && /^\d{4}-\d{2}/.test(d));
  if (dates.length === 0) return null;
  return fmt(dates.reduce((a, b) => (a > b ? a : b)));
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
    <p className="mt-2 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-3 py-2 text-sm text-soft first:mt-0">
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

const label = datasetLabel;

function fmt(iso: string): string {
  // "2026-06-30" -> "Jun 30, 2026"; "2026-09" -> "Sep 2026"; else verbatim.
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(iso);
  if (!m) return iso;
  const name = MONTH_ABBR[Number(m[2]) - 1];
  return m[3] ? `${name} ${Number(m[3])}, ${m[1]}` : `${name} ${m[1]}`;
}
