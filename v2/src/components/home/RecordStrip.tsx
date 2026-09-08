import Link from "next/link";

import type { RecordFigure } from "@/lib/recordCounts";

/**
 * The record behind the site, as a row of dated counts.
 *
 * Each figure is a fact from a document an ingest reconciled before writing,
 * and each carries the date it is true for: "through" for a published file's
 * last decision, "checked" for the day the sweep last asked DOL, "newest" for
 * the bulletin archive. A number with no date is not shown at all. Plain
 * server markup, no Motion wrapper, so it reads before hydration.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function dateLabel(iso: string): string {
  const y = iso.slice(0, 4);
  const m = MONTHS[Number(iso.slice(5, 7)) - 1] ?? "";
  const d = iso.length >= 10 ? ` ${Number(iso.slice(8, 10))}` : "";
  return `${m}${d}, ${y}`;
}

function asOfLine(f: RecordFigure): string {
  if (f.asOfKind === "checked") return `checked ${dateLabel(f.asOf)}`;
  if (f.asOfKind === "newest") return `newest ${dateLabel(f.asOf)}`;
  return `through ${dateLabel(f.asOf)}`;
}

export function RecordStrip({ record }: { record: RecordFigure[] }) {
  if (record.length === 0) return null;
  return (
    <div className="mx-auto mt-10 max-w-[1100px] px-4 sm:px-8">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">
        The record it runs on
      </p>{" "}
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0 lg:border-2 lg:border-border lg:bg-card lg:shadow-hard-sm">
        {record.map((f, i) => (
          <li
            key={f.href}
            className={`border-2 border-border bg-card p-4 shadow-hard-sm lg:border-0 lg:shadow-none ${i > 0 ? "lg:border-l-2" : ""}`}
          >
            <Link href={f.href} className="group block">
              <span className="block font-heading text-2xl font-black tracking-tight tabular-nums text-foreground sm:text-3xl">
                {f.value.toLocaleString("en-US")}
              </span>{" "}
              <span className="mt-1 block text-sm font-medium leading-snug text-foreground/90 group-hover:underline group-hover:decoration-primary group-hover:decoration-2 group-hover:underline-offset-2">
                {f.label}
              </span>{" "}
              <span className="mt-2 block font-mono text-xs font-semibold text-muted-foreground">
                {asOfLine(f)}
              </span>
            </Link>
          </li>
        ))}
      </ul>{" "}
      <p className="mt-3 text-sm text-foreground/70">
        All of it from DOL, USCIS and the State Department, held and dated as they published it.{" "}
        <Link href="/about" className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
          Where each number comes from
        </Link>
      </p>
    </div>
  );
}
