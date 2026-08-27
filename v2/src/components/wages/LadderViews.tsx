import { DataView } from "@/components/tools/DataView";
import type { Ladder } from "@/lib/wageLadder";

import { LadderComb, type LadderCombProps } from "./LadderComb";
import { LadderByYear } from "./LadderByYear";
import { LadderTable } from "./LadderTable";

/**
 * A ladder figure and its numbers, behind one toggle.
 *
 * Every other chart on this site already offers both readings through
 * `DataView`, and a percentile ladder is the one that needs it most: the
 * drawing answers "is this offer normal", and only the table answers "is
 * $118,000 above or below the 25th". Both are in the served HTML from the
 * first byte, so the toggle chooses what is displayed rather than what exists.
 */

export function LadderCombViews({
  label,
  subjectLabel,
  ladders,
  href,
  unit,
}: {
  label: string;
  /** Heading for the table's first column. */
  subjectLabel: string;
  ladders: Ladder[];
  href?: LadderCombProps["href"];
  unit?: string;
}) {
  if (ladders.length === 0) return null;
  return (
    <DataView
      label={label}
      chart={<LadderComb ladders={ladders} href={href} unit={unit} />}
      table={<LadderTable ladders={ladders} subjectLabel={subjectLabel} unit={unit} />}
    />
  );
}

export function LadderYearViews({
  label,
  years,
  unit,
}: {
  label: string;
  years: Ladder[];
  unit?: string;
}) {
  if (years.length < 2) return null;
  return (
    <DataView
      label={label}
      chart={<LadderByYear years={years} unit={unit} />}
      table={<LadderTable ladders={years} subjectLabel="Fiscal year" unit={unit} />}
    />
  );
}
