import { Warning } from "@phosphor-icons/react/ssr";

import { getFreshness, type DatasetFreshness } from "@/lib/turso/publicData";

/**
 * One line of provenance, rendered where the data is.
 *
 * Adam's requirement, verbatim intent: source, recency and cadence "right
 * there - they don't have to search hunt find it". So this is a server
 * component any data page mounts with its dataset ids; it reads the
 * registry the ingest scripts maintain and renders a plain sentence per
 * dataset. No tooltip, no icon to hover, no link-out required to learn
 * where a number came from.
 */
export async function DataProvenance({ datasets, className }: { datasets: string[]; className?: string }) {
  const all: Record<string, DatasetFreshness> = await getFreshness().catch(() => ({}));
  // A type-guard filter, because .filter(Boolean) does not narrow away the
  // `| undefined` that noUncheckedIndexedAccess puts on all[d].
  const rows = datasets
    .map((d) => all[d])
    .filter((r): r is DatasetFreshness => r !== undefined);
  if (rows.length === 0) return null;
  return (
    <div className={className ?? "mt-6 border-t-2 border-border pt-3"}>
      {rows.map((r) =>
        r.stale ? (
          /*
           * An ingest that has silently stopped is worse than an outage,
           * because an outage is visible and this is not: the page keeps
           * serving the last true measurement under an as-of date nobody has
           * a reason to scrutinise.
           *
           * The figures are NOT hidden or softened. They remain the last real
           * measurement and they stay exactly as they read when fresh. What
           * changes is that the page stops implying they are current.
           *
           * Rendered only when `stale` is true, which requires BOTH the age
           * and the budget to be known - an unparseable date is not evidence
           * of staleness, and a warning that fires on every page teaches
           * people to ignore the one that matters.
           */
          <p
            key={r.dataset}
            className="mt-2 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-3 py-2 text-sm text-foreground/80 first:mt-0"
          >
            <Warning
              className="mt-0.5 h-4 w-4 shrink-0 text-data-warn-ink"
              weight="fill"
              aria-hidden="true"
            />{" "}
            <span>
              <b className="font-bold text-data-warn-ink">
                {label(r.dataset)} has not refreshed{agePhrase(r)}.
              </b>{" "}
              It should update {r.cadence.toLowerCase()}, so the figures below
              are the last ones that arrived rather than the current ones.
              Source: {r.source}
              {r.asOf ? <> · data through {fmt(r.asOf)}</> : null}.
            </span>
          </p>
        ) : (
          <p key={r.dataset} className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground/80">{label(r.dataset)}:</span>{" "}
            {r.source}
            {r.asOf ? <> · data through {fmt(r.asOf)}</> : null} · {r.cadence.toLowerCase()}
          </p>
        ),
      )}
    </div>
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
    entities: "Employers and firms",
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
