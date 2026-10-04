import { LOOKS_YEARLY_NOTE, LOOKS_YEARLY_SHORT, looksYearly } from "@/lib/wageFormat";

/**
 * A wage DOL printed under a unit it can't be pay for ($100,000 "per month")
 * stays on the page exactly as printed; this says so beside it. `short` is the
 * table-cell form, with the full sentence on hover; otherwise the sentence.
 * Renders nothing for an ordinary wage.
 */
export function YearlyPayNote({
  wage,
  unit,
  short = false,
}: {
  wage: number | null | undefined;
  unit: string | null | undefined;
  short?: boolean;
}) {
  if (!looksYearly(wage, unit)) return null;
  return short ? (
    <span className="block whitespace-normal text-sm font-normal text-foreground/70" title={LOOKS_YEARLY_NOTE}>
      {LOOKS_YEARLY_SHORT}
    </span>
  ) : (
    <p className="mt-1 text-sm text-foreground/70">{LOOKS_YEARLY_NOTE}</p>
  );
}
