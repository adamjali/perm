/**
 * USCIS government fees for the employment-based green card, from Form G-1055.
 *
 * Every figure below is copied from one edition of USCIS's fee schedule and
 * carries that edition's date, so the page can print "as of" honestly and a
 * later edition is a one-file change. Nothing here is estimated: attorney
 * fees, DOL costs (PERM and the prevailing wage request carry no filing fee)
 * and medical exams vary by case and are named on the page as not included.
 *
 * Source: USCIS Form G-1055, Fee Schedule, edition 05/29/26, read from the
 * PDF at https://www.uscis.gov/g-1055 on Sep 8 2026. Relevant rows:
 *   I-140 paper $715 (online $665); Asylum Program Fee with the I-140:
 *   regular petitioner $600, small employer (25 or fewer full-time
 *   employees) or self-petitioner $300, nonprofit $0.
 *   I-907 premium processing for an I-140: $2,965.
 *   I-485 paper $1,440; under 14 filing with a parent $950.
 *   I-765 with a pending I-485 filed on or after Apr 1 2024: $260.
 *   I-131 with a pending I-485 filed on or after Apr 1 2024: $630.
 *   I-693 (medical exam) has no USCIS fee; the civil surgeon charges.
 */

export const FEE_SCHEDULE = {
  edition: "05/29/26",
  editionIso: "2026-05-29",
  source: "https://www.uscis.gov/g-1055",
  i140Paper: 715,
  i140Online: 665,
  asylumProgramFee: { regular: 600, small: 300, nonprofit: 0 } as const,
  i907I140: 2965,
  i485Adult: 1440,
  i485ChildWithParent: 950,
  i765WithPendingI485: 260,
  i131WithPendingI485: 630,
} as const;

export type PetitionerKind = keyof typeof FEE_SCHEDULE.asylumProgramFee;

export interface FeeInput {
  /** Regular petitioner, small employer / self-petitioner, or nonprofit. */
  petitioner: PetitionerKind;
  /** Whether the I-140 goes in online ($665) or on paper ($715). */
  onlineI140?: boolean;
  /** Premium processing on the I-140. */
  premium?: boolean;
  /** Adults (14 and over) filing an I-485, the principal included. */
  adults: number;
  /** Children under 14 filing with a parent. */
  children?: number;
  /** Adults who also file for a work permit (I-765). */
  workPermits?: number;
  /** Adults who also file for advance parole (I-131). */
  travelDocuments?: number;
}

export interface FeeLine {
  form: string;
  label: string;
  /** Number of copies of this fee; a per-person line prints its count. */
  count: number;
  /** The single fee, in dollars. */
  each: number;
  total: number;
}

export interface FeeResult {
  lines: FeeLine[];
  /** The petition stage (I-140 with its asylum program fee and any premium). */
  petitionTotal: number;
  /** The adjustment stage (I-485 and the optional I-765 and I-131 per person). */
  adjustmentTotal: number;
  total: number;
  edition: string;
  source: string;
}

const count = (n: number | undefined, name: string): number => {
  const v = n ?? 0;
  if (!Number.isInteger(v) || v < 0 || v > 20) throw new Error(`${name} must be a whole number from 0 to 20`);
  return v;
};

/**
 * Sum the USCIS fees for one employment-based case. Per-person lines are
 * capped at the number of adults for the work permit and travel document,
 * because those forms ride a pending I-485 and each adult files their own.
 */
export function calculateGreenCardFees(input: FeeInput): FeeResult {
  const adults = count(input.adults, "adults");
  const children = count(input.children, "children");
  const permits = Math.min(count(input.workPermits, "workPermits"), adults);
  const travel = Math.min(count(input.travelDocuments, "travelDocuments"), adults);
  const S = FEE_SCHEDULE;

  const line = (form: string, label: string, c: number, each: number): FeeLine => ({ form, label, count: c, each, total: c * each });
  const petition: FeeLine[] = [
    line("I-140", input.onlineI140 ? "Immigrant petition, filed online" : "Immigrant petition, filed on paper", 1, input.onlineI140 ? S.i140Online : S.i140Paper),
    line(
      "Asylum Program Fee",
      input.petitioner === "nonprofit" ? "Nonprofit petitioner" : input.petitioner === "small" ? "Small employer or self-petitioner" : "Regular petitioner",
      1,
      S.asylumProgramFee[input.petitioner],
    ),
  ];
  if (input.premium) petition.push(line("I-907", "Premium processing for the I-140", 1, S.i907I140));

  const adjustment: FeeLine[] = [];
  if (adults > 0) adjustment.push(line("I-485", "Adjustment of status, age 14 and over", adults, S.i485Adult));
  if (children > 0) adjustment.push(line("I-485", "Adjustment of status, under 14 filing with a parent", children, S.i485ChildWithParent));
  if (permits > 0) adjustment.push(line("I-765", "Work permit with a pending I-485", permits, S.i765WithPendingI485));
  if (travel > 0) adjustment.push(line("I-131", "Advance parole with a pending I-485", travel, S.i131WithPendingI485));

  const sum = (ls: FeeLine[]) => ls.reduce((a, l) => a + l.total, 0);
  const petitionTotal = sum(petition);
  const adjustmentTotal = sum(adjustment);
  return {
    lines: [...petition, ...adjustment],
    petitionTotal,
    adjustmentTotal,
    total: petitionTotal + adjustmentTotal,
    edition: S.edition,
    source: S.source,
  };
}
