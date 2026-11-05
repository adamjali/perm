import { Fragment } from "react";
import Link from "next/link";

import type { ApprovalParts } from "@/lib/approvalRate";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { monthYear } from "@convex/lib/months";

/** The site's status colours: certified green, denied red, withdrawn purple. */
const FILL = { certified: "bg-data-good-ink", denied: "bg-data-bad-ink", withdrawn: "bg-data-purple-ink" } as const;

/**
 * How often DOL approves PERM, drawn: one bar split by outcome, the three shares under it, and one dated line an
 * answer engine can quote (owner, Nov 5 2026: the two sentences under the hero read as a wall of text). The full
 * sentences stay on the FAQ (lib/approvalRate.ts).
 */
export function ApprovalBar({ parts }: { parts: ApprovalParts }) {
  const from = monthYear(parts.from.slice(0, 7));
  const to = monthYear(parts.to.slice(0, 7));
  return (
    <figure className="mt-6 max-w-3xl">
      <div aria-hidden="true" className="flex h-5 w-full overflow-hidden border-2 border-foreground">
        {parts.outcomes.map((o) =>
          o.n ? (
            <div key={o.key} className={cn("h-full", FILL[o.key])} style={{ width: `${(o.n / parts.total) * 100}%`, minWidth: "4px" }} />
          ) : null,
        )}
      </div>{" "}
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-base">
        {parts.outcomes.map((o) => (
          <Fragment key={o.key}>
            {" "}
            <li className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={cn("size-3.5", FILL[o.key])} />{" "}
              <span className="font-heading font-bold tabular-nums">{o.share}</span> {o.key}
            </li>
          </Fragment>
        ))}
      </ul>{" "}
      <figcaption className="mt-2 text-sm text-soft">
        Of the {formatInt(parts.total)} PERM cases DOL decided from {from} to {to}, by its own files.
        {parts.recent ? (
          <>
            {" "}
            Last 30 days: {parts.recent.share} of {formatInt(parts.recent.n)} certified, by our daily check.
          </>
        ) : null}{" "}
        <Link href="/perm-denial-risk" className="link">
          By job, state and wage
        </Link>
      </figcaption>
    </figure>
  );
}
