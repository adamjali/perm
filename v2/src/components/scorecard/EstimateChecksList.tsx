import type { CheckRow } from "@/lib/scorecard/checks";

/**
 * Every estimate the site gives and how its own check came out, one row each: what's estimated, how it held, and
 * what it was checked on. A list, not a table, so a phone stacks each row whole. Blocks only, never `<p>`: inside an
 * article the prose rules reach into not-prose parts.
 */
export function EstimateChecksList({ rows, className = "" }: { rows: CheckRow[]; className?: string }) {
  if (!rows.length) {
    return (
      <div className={`border-2 border-border bg-card p-5 text-base leading-relaxed ${className}`}>
        The checks haven&apos;t stored a result to show right now.
      </div>
    );
  }
  return (
    <ul role="list" className={`divide-y-2 divide-border border-2 border-border bg-card ${className}`}>
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-1 gap-x-6 gap-y-1 p-4 sm:p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] [&>*]:min-w-0">
          <div className="font-heading text-base font-bold leading-snug">{`${r.estimate} `}</div>{" "}
          <div className="font-heading text-lg font-bold tabular-nums md:text-right">{`${r.result} `}</div>{" "}
          <div className="text-sm leading-relaxed text-soft md:col-span-2">{r.basis}</div>
        </li>
      ))}
    </ul>
  );
}
