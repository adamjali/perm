import { CaretDownIcon } from "@phosphor-icons/react/ssr";

import type { PolicyNotice } from "@/lib/db/policyNotices";

import { ArchiveLines } from "./ArchiveLines";
import { DocRow, typeLabel } from "./DocRow";
import { dayLabel } from "./format";

/**
 * A long list (the agencies' own announcements, or the courts' and BALCA's
 * decisions): the newest as full rows, the rest folded by year as one line
 * each, each naming whose it is. Every title stays in the DOM for search; a reader meets
 * eight rows and a list of years.
 */
export function OflcArchive({ items, today, lead = 8 }: { items: readonly PolicyNotice[]; today: string; lead?: number }) {
  const recent = items.slice(0, lead);
  const rest = items.slice(lead);
  const years = new Map<string, PolicyNotice[]>();
  for (const n of rest) {
    const y = n.publicationDate.slice(0, 4);
    const list = years.get(y);
    if (list) list.push(n);
    else years.set(y, [n]);
  }
  const grouped = [...years.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <div className="mt-6 border-border bg-card border">
        {recent.map((n) => (
          <DocRow key={n.documentNumber} doc={n} today={today} />
        ))}
      </div>{" "}
      {grouped.length > 0 ? (
        <div className="mt-6 border-border bg-card border">
          {grouped.map(([year, list]) => (
            <details key={year} className="group border-b-2 border-border last:border-b-0">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-heading text-base font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span>{year}</span>{" "}
                  <span className="font-mono text-sm font-bold text-muted-foreground">
                    {list.length} {list.length === 1 ? "announcement" : "announcements"}
                  </span>
                </span>{" "}
                <CaretDownIcon className="doc-caret" aria-hidden="true" />
              </summary>{" "}
              <ArchiveLines
                lines={list.map((n) => [n.documentNumber, `${dayLabel(n.publicationDate)}, ${typeLabel(n.type)}`, n.url, n.title] as const)}
              />
            </details>
          ))}
        </div>
      ) : null}
    </>
  );
}
