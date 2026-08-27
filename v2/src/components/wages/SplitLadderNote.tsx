import { isComplete, money, widestStep, RUNG_LABEL, type Ladder } from "@/lib/wageLadder";
import { cn } from "@/lib/utils";

/**
 * Names the ladders with the widest jump between two neighbouring rungs.
 *
 * A ladder whose rungs climb evenly describes one population. A ladder with a
 * jump in the middle describes two, and its median lands inside the jump where
 * hardly anybody is. Georgia is the clearest: the 25th sits at $24,360, the
 * median at $30,202 and the 75th at $100,000, so the median describes neither
 * the poultry plants nor the Atlanta software offices.
 *
 * WHERE THE THRESHOLD COMES FROM, BECAUSE IT IS A JUDGEMENT AND NOT A LAW.
 * Measured over the 49 states carrying a full ladder, the widest adjacent-rung
 * ratio runs from 1.44 to 3.31. It is a continuum with no natural break, so
 * any cut is a choice. 2.0 admits 26 of 49, which is more than half and
 * therefore says nothing. 2.5 admits five (GA 3.31, NC 3.24, AR 2.81, MO 2.72,
 * PA 2.71) and sits in the largest gap in that part of the range, between
 * PA at 2.71 and Montana at 2.43. California, a wide but single distribution,
 * measures 2.00 and is correctly excluded.
 *
 * The states are found by measurement rather than kept in a list, so the
 * sentence stays true after the next quarterly ingest instead of quietly
 * naming whichever states happened to qualify when it was written.
 */

/** Below this the rungs climb evenly enough that a median describes the set. */
export const SPLIT_RATIO = 2.5;

export function SplitLadderNote({
  ladders,
  className,
  limit = 3,
}: {
  ladders: Ladder[];
  className?: string;
  limit?: number;
}) {
  const split = ladders
    .filter(isComplete)
    .map((l) => ({ ladder: l, step: widestStep(l) }))
    .filter(
      (x): x is { ladder: Ladder; step: NonNullable<ReturnType<typeof widestStep>> } =>
        x.step !== null && x.step.ratio >= SPLIT_RATIO,
    )
    .sort((a, b) => b.step.ratio - a.step.ratio)
    .slice(0, limit);

  if (split.length === 0) return null;
  const first = split[0]!;

  return (
    <p className={cn("text-sm leading-relaxed text-foreground/70", className)}>
      A few ladders jump rather than climb, and a jump is the signature of two
      populations sharing one row. {first.ladder.label} rises{" "}
      {first.step.ratio.toFixed(1)} times between the{" "}
      {RUNG_LABEL[first.step.from].toLowerCase()} and the{" "}
      {RUNG_LABEL[first.step.to].toLowerCase()}, from{" "}
      {money(first.ladder[first.step.from] as number)} to{" "}
      {money(first.ladder[first.step.to] as number)}
      {split.length > 1 ? (
        <>
          , and{" "}
          {split
            .slice(1)
            .map((s) => s.ladder.label)
            .join(" and ")}{" "}
          jump too
        </>
      ) : null}
      . A median taken across a jump falls inside it, describing a wage few of
      the filings behind it actually offer.
    </p>
  );
}
