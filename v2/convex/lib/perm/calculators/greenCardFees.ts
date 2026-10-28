/**
 * USCIS government fees for the employment-based green card, from Form G-1055.
 *
 * Every figure below is copied from one edition of USCIS's fee schedule and
 * carries that edition's date, so the page can print "as of" honestly and a
 * later edition is a one-file change. Nothing here is estimated: attorney
 * fees, DOL costs (PERM and the prevailing wage request carry no filing fee)
 * and medical exams vary by case and are named on the page as not included.
 *
 * Source: USCIS Form G-1055, Fee Schedule, edition 10/26/26, read from the
 * PDF at https://www.uscis.gov/g-1055 on Oct 28 2026. Relevant rows:
 *   I-140 paper $715 (online $665); Asylum Program Fee with the I-140:
 *   regular petitioner $600, small employer (25 or fewer full-time
 *   employees) or self-petitioner $300, nonprofit $0.
 *   I-907 premium processing for an I-140: $2,965.
 *   I-485 paper $1,440 (online $1,390); under 14 filing with a parent $950
 *   (online $900). Online filing for the I-485 is new in this edition.
 *   I-765 with a pending I-485 filed on or after Apr 1 2024: $260, paper or online.
 *   I-131 advance parole with a pending I-485: $630 (online $580).
 *   USCIS Immigrant Fee, each person immigrating through a consulate: $235.
 *   I-693 (medical exam) has no USCIS fee; the civil surgeon charges.
 *
 * Through a consulate, State charges its own fee, in its own schedule: 22 CFR 22.1,
 * item 32(b), $345 an employment-based immigrant visa application, read on the eCFR
 * on Oct 28 2026.
 */

export const FEE_SCHEDULE = {
  edition: "10/26/26",
  editionIso: "2026-10-26",
  source: "https://www.uscis.gov/g-1055",
  i140Paper: 715,
  i140Online: 665,
  asylumProgramFee: { regular: 600, small: 300, nonprofit: 0 } as const,
  i907I140: 2965,
  i485Adult: 1440,
  i485AdultOnline: 1390,
  i485ChildWithParent: 950,
  i485ChildWithParentOnline: 900,
  i765WithPendingI485: 260,
  i131WithPendingI485: 630,
  i131WithPendingI485Online: 580,
  immigrantFee: 235,
} as const;

/** The State Department's fee for a green card through a consulate, from its own schedule. */
export const STATE_FEES = {
  citation: "22 CFR 22.1, item 32(b)",
  source: "https://www.ecfr.gov/current/title-22/chapter-I/subchapter-C/part-22/section-22.1",
  readIso: "2026-10-28",
  ivEmployment: 345,
} as const;

export type PetitionerKind = keyof typeof FEE_SCHEDULE.asylumProgramFee;

/**
 * How the green card is got: adjusting status inside the US (Form I-485), or an immigrant visa
 * from a US consulate abroad (consular processing, through the National Visa Center).
 */
export type GreenCardRoute = "aos" | "cp";
export const GREEN_CARD_ROUTES: readonly GreenCardRoute[] = ["aos", "cp"];

export interface FeeInput {
  /** Regular petitioner, small employer / self-petitioner, or nonprofit. */
  petitioner: PetitionerKind;
  /** Whether the forms that can be filed online are (the I-140, I-485 and I-131); paper otherwise. */
  online?: boolean;
  /** Adjustment of status (the default) or consular processing. */
  route?: GreenCardRoute;
  /** Premium processing on the I-140. */
  premium?: boolean;
  /** Adults (14 and over) filing an I-485, the principal included. */
  adults: number;
  /** Children under 14 filing with a parent. */
  children?: number;
  /** Adults who also file for a work permit (I-765). Adjustment of status only. */
  workPermits?: number;
  /** Adults who also file for advance parole (I-131). Adjustment of status only. */
  travelDocuments?: number;
}

export interface FeeLine {
  form: string;
  /** Whose fee it is: USCIS's schedule (G-1055) or State's (22 CFR 22.1). */
  agency: "USCIS" | "State";
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
  /** The green card itself: the I-485 and its optional I-765 and I-131, or the consular fees. */
  applicationTotal: number;
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

  const online = input.online ?? false;
  const line = (form: string, label: string, c: number, each: number, agency: FeeLine["agency"] = "USCIS"): FeeLine => ({
    form, agency, label, count: c, each, total: c * each,
  });
  const how = online ? "filed online" : "filed on paper";
  const petition: FeeLine[] = [
    line("I-140", `Immigrant petition, ${how}`, 1, online ? S.i140Online : S.i140Paper),
    line(
      "Asylum Program Fee",
      input.petitioner === "nonprofit" ? "Nonprofit petitioner" : input.petitioner === "small" ? "Small employer or self-petitioner" : "Regular petitioner",
      1,
      S.asylumProgramFee[input.petitioner],
    ),
  ];
  if (input.premium) petition.push(line("I-907", "Premium processing for the I-140", 1, S.i907I140));

  const application: FeeLine[] = [];
  if (input.route === "cp") {
    // Through a consulate: no I-485, work permit or travel document. Everyone immigrating pays
    // State's visa fee at the National Visa Center and USCIS's immigrant fee before travelling.
    const people = adults + children;
    if (people > 0) {
      application.push(line("DS-260", "Immigrant visa application, employment-based", people, STATE_FEES.ivEmployment, "State"));
      application.push(line("USCIS Immigrant Fee", "USCIS immigrant fee, before travelling", people, S.immigrantFee));
    }
  } else {
    if (adults > 0) application.push(line("I-485", `Adjustment of status, age 14 and over, ${how}`, adults, online ? S.i485AdultOnline : S.i485Adult));
    if (children > 0) {
      application.push(
        line("I-485", `Adjustment of status, under 14 filing with a parent, ${how}`, children, online ? S.i485ChildWithParentOnline : S.i485ChildWithParent),
      );
    }
    if (permits > 0) application.push(line("I-765", "Work permit with a pending I-485", permits, S.i765WithPendingI485));
    if (travel > 0) application.push(line("I-131", `Advance parole with a pending I-485, ${how}`, travel, online ? S.i131WithPendingI485Online : S.i131WithPendingI485));
  }

  const sum = (ls: FeeLine[]) => ls.reduce((a, l) => a + l.total, 0);
  const petitionTotal = sum(petition);
  const applicationTotal = sum(application);
  return {
    lines: [...petition, ...application],
    petitionTotal,
    applicationTotal,
    total: petitionTotal + applicationTotal,
    edition: S.edition,
    source: S.source,
  };
}
