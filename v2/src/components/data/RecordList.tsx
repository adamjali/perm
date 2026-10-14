import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface RecordRow {
  label: string;
  value: ReactNode;
  /** DOL's own words (a name, a title, a number): a translating browser leaves them as printed. */
  raw?: boolean;
  /** A case number or code, set in the mono face. */
  mono?: boolean;
}

/**
 * A record as one list of label and value, the way an agency prints it: the
 * label small on the left (above, on a phone), the value in full.
 */
export function RecordList({ rows, className }: { rows: readonly RecordRow[]; className?: string }) {
  return (
    <dl className={cn("max-w-3xl divide-y divide-border border-y border-border", className)}>
      {rows.map((r) => (
        <Fragment key={r.label}>
          {" "}
          <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <dt className="text-sm text-muted-foreground">{r.label}</dt>{" "}
            <dd
              className={cn("min-w-0 break-words text-base font-semibold text-foreground", r.mono && "font-mono")}
              translate={r.raw ? "no" : undefined}
            >
              {r.value}
            </dd>
          </div>
        </Fragment>
      ))}
    </dl>
  );
}
