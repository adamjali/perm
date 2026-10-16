import Link from "next/link";
import { DatabaseIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

import type { RecordFigure } from "@/lib/recordCounts";
import { MONTH_ABBR } from "@convex/lib/months";

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

function dateLabel(iso: string): string {
  const y = iso.slice(0, 4);
  const m = MONTH_ABBR[Number(iso.slice(5, 7)) - 1] ?? "";
  const d = iso.length >= 10 ? ` ${Number(iso.slice(8, 10))}` : "";
  return `${m}${d} ${y}`;
}

function asOfLine(f: RecordFigure): string {
  if (f.asOfKind === "checked") return `checked ${dateLabel(f.asOf)}`;
  if (f.asOfKind === "newest") return `newest ${dateLabel(f.asOf)}`;
  return `through ${dateLabel(f.asOf)}`;
}

export function RecordStrip({ record, className = "mt-10" }: { record: RecordFigure[]; className?: string }) {
  if (record.length === 0) return null;
  return (
    // An object with its own ink band (round 3, Oct 15 2026: the sentence that
    // introduced it read as a stray line, so the ledger names itself).
    <section aria-labelledby="record-ledger" className={cn("object", className)}>
      {/* A label, not a heading: the ledger sits under an h1 on some pages and
          an h2 on others, and a fixed level would skip one. */}
      <p
        id="record-ledger"
        className="flex items-center gap-2 border-b-2 border-black bg-[#141414] px-5 py-3 font-heading text-base font-bold text-white"
      >
        <DatabaseIcon aria-hidden="true" weight="bold" className="size-5 text-[#2ECC40]" />
        Data stored on PERM Tracker
      </p>{" "}
      <dl className="px-5">
        {record.map((f) => (
          <div
            // Several figures may point at one section (the policy page sends
            // three at #register), so the key is the pair, not the route alone.
            key={`${f.href} ${f.label}`}
            className="grid grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-0.5 border-b-2 border-border py-3 last:border-b-0 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
          >
            <dt className="font-heading text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
              {f.value.toLocaleString("en-US")}
            </dt>{" "}
            <dd className="text-base leading-snug">
              <Link href={f.href} className="link">
                {f.label}
              </Link>
            </dd>{" "}
            <dd className="col-start-2 font-mono text-sm text-muted-foreground sm:col-start-auto sm:whitespace-nowrap sm:text-right">
              {asOfLine(f)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
