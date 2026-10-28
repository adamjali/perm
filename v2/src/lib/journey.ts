import { PLAN_STAGES, type FeeResult, type PlanStage, type StageOwner } from "@/lib/perm";

import { aboutMonths } from "@/lib/board";
import { formatInt } from "@/lib/format";

/**
 * The whole road to a green card on one line, for the guide that walks it: each step with how
 * long it takes now (the planner's own figures, `getPlanReading`), its government fee (USCIS's
 * fee schedule, through `calculateGreenCardFees`) and whose step it is. The bulletin wait has no
 * length: it depends on the reader's line, and the line says so.
 */

/** The steps the guide walks, inside the US: the planner's, without the I-140's preparation (an assumption, not a measurement). */
export const JOURNEY_STEPS = ["pwd", "recruitment", "perm", "i140", "visa", "i485"] as const satisfies readonly PlanStage[];
export type JourneyKey = (typeof JOURNEY_STEPS)[number];

const OWNER: Record<StageOwner, string> = {
  dol: "DOL",
  employer: "The employer",
  uscis: "USCIS",
  state: "State Department",
};

export interface JourneyStep {
  key: JourneyKey;
  name: string;
  who: string;
  /** The typical length in days, or null where none is measured (the bulletin wait, a source that failed). */
  days: number | null;
  /** The length in words: "about 3 months", or why there's none. */
  length: string;
  /** The government's fee, in dollars, and what it's made of ("" where there's nothing to add). */
  fee: number;
  feeNote: string;
}

const money = (n: number) => `$${formatInt(n)}`;

/**
 * Each step's length and fee. `lengths` are the typical days from the planner's reading (null
 * where a source failed); `fees` is one adult's case, filed on paper by a regular employer, with
 * a work permit and a travel document: the planner's default.
 */
export function journeySteps(lengths: Partial<Record<JourneyKey, number | null>>, fees: FeeResult): JourneyStep[] {
  const fee = (form: string) => fees.lines.find((l) => l.form === form)?.each ?? 0;
  const feeOf: Record<JourneyKey, [number, string]> = {
    pwd: [0, ""],
    recruitment: [0, "The ads are the employer's cost"],
    perm: [0, ""],
    i140: [
      fee("I-140") + fee("Asylum Program Fee"),
      `The I-140 ${money(fee("I-140"))} and the asylum program fee ${money(fee("Asylum Program Fee"))}`,
    ],
    visa: [0, ""],
    i485: [
      fee("I-485") + fee("I-765") + fee("I-131"),
      `The I-485 ${money(fee("I-485"))}, a work permit ${money(fee("I-765"))} and a travel document ${money(fee("I-131"))}`,
    ],
  };
  return JOURNEY_STEPS.map((key) => {
    const stage = PLAN_STAGES.find((s) => s.key === key);
    const days = key === "visa" ? null : (lengths[key] ?? null);
    const [amount, note] = feeOf[key];
    return {
      key,
      name: stage?.name ?? key,
      who: stage ? OWNER[stage.owner] : "",
      days,
      length: key === "visa" ? "Depends on your line" : days === null ? "Not read today" : aboutMonths(days),
      fee: amount,
      feeNote: note,
    };
  });
}
