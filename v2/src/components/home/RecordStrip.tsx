import Link from "next/link";

import type { RecordFigure } from "@/lib/recordCounts";

/**
 * The record behind the site, set as a ledger inside the About column.
 *
 * One rule per row: the count, what it is, and the date it is true for
 * ("through" a published file's last decision, "checked" on the day the
 * sweep last asked DOL, "newest" for the bulletin archive). It is a table
 * because the content is tabular, and it sits in the same measure as the
 * prose above it rather than in a wider band of cards. A figure with no date
 * is not rendered at all. Plain server markup, so it reads before hydration.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function dateLabel(iso: string): string {
  const y = iso.slice(0, 4);
  const m = MONTHS[Number(iso.slice(5, 7)) - 1] ?? "";
  const d = iso.length >= 10 ? ` ${Number(iso.slice(8, 10))}` : "";
  return `${m}${d} ${y}`;
}

function asOfLine(f: RecordFigure): string {
  if (f.asOfKind === "checked") return `checked ${dateLabel(f.asOf)}`;
  if (f.asOfKind === "newest") return `newest ${dateLabel(f.asOf)}`;
  return `through ${dateLabel(f.asOf)}`;
}

export function RecordStrip({ record }: { record: RecordFigure[] }) {
  if (record.length === 0) return null;
  return (
    <div className="mt-10">
      <p className="text-base leading-relaxed text-foreground/90 sm:text-lg">
        What it holds, and the date each figure is true for:
      </p>{" "}
      <dl className="mt-4 border-t-2 border-border">
        {record.map((f) => (
          <div
            key={f.href}
            className="grid grid-cols-1 gap-y-1 border-b-2 border-border py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4"
          >
            <dt className="font-heading text-xl font-black tabular-nums tracking-tight sm:text-2xl">
              {f.value.toLocaleString("en-US")}
            </dt>{" "}
            <dd className="text-base leading-snug text-foreground/90">
              <Link
                href={f.href}
                className="underline decoration-primary/30 decoration-2 underline-offset-[3px] transition-colors hover:decoration-primary"
              >
                {f.label}
              </Link>
            </dd>{" "}
            <dd className="font-mono text-xs text-muted-foreground sm:whitespace-nowrap sm:text-right">
              {asOfLine(f)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
