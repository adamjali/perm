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
      {rows.map((r) => (
        <p key={r.dataset} className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground/80">{label(r.dataset)}:</span>{" "}
          {r.source}
          {r.asOf ? <> · data through {fmt(r.asOf)}</> : null} · {r.cadence.toLowerCase()}
        </p>
      ))}
    </div>
  );
}

function label(d: string): string {
  const names: Record<string, string> = {
    "perm-cases": "Case data",
    "processing-times": "Processing times",
    "visa-bulletin": "Visa bulletin",
    "daily-decisions": "Daily decisions",
    "uscis-i140-times": "I-140 times",
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
