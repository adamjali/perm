import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

/**
 * Priority date retention and I-485 portability, from the dates on the record.
 *
 * Three rules, each a primary source:
 *
 *  - 8 CFR 204.5(e)(1): the priority date of an approved I-140 is retained
 *    for any later EB-1, EB-2 or EB-3 petition, UNLESS the approval was
 *    revoked for fraud, willful misrepresentation, material error, or the
 *    labor certification was invalidated or revoked. Since the Jan 17 2017
 *    rule an employer's withdrawal, or the employer's business ending, no
 *    longer costs the beneficiary the date.
 *  - 8 CFR 205.1(a)(3)(iii)(C) and (D): an employer's withdrawal, or the
 *    termination of its business, 180 days or more after the I-140 was
 *    approved (or after an associated I-485 was filed) does not automatically
 *    revoke the approval. Inside 180 days it does.
 *  - INA 204(j); 8 CFR 245.25: an I-485 that has been pending 180 days or
 *    more may be adjudicated on a new job offer in the same or a similar
 *    occupation (Supplement J), so the beneficiary can change employers.
 *
 * The calculator prints the dates each rule turns on; it does not decide
 * whether an occupation is "similar" or whether a revocation was for cause,
 * because those are findings, not arithmetic.
 */

export const RETENTION_DAYS = 180;

export interface RetentionInput {
  /** The I-140 approval date, YYYY-MM-DD. */
  i140Approved: string;
  /** The I-485 receipt date, YYYY-MM-DD, if one was filed. */
  i485Filed?: string;
  /** The date the employer withdrew the I-140 or closed, YYYY-MM-DD, if it happened. */
  employerWithdrew?: string;
}

export interface RetentionResult {
  /** I-140 approval plus 180 days: from this day an employer withdrawal no longer revokes it. */
  withdrawalSafeFrom: string;
  /** I-485 filing plus 180 days: from this day the job can change under 204(j). */
  portableFrom: string | null;
  /** When a withdrawal date was given: whether it fell inside the 180 days. */
  withdrawal: { on: string; daysAfterApproval: number; autoRevokes: boolean } | null;
  /** Whether the priority date is retained for a future petition under 204.5(e), absent a for-cause revocation. */
  priorityDateRetained: boolean;
  citations: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function calculatePriorityDateRetention(input: RetentionInput): RetentionResult {
  if (!DATE_RE.test(input.i140Approved)) throw new Error("i140Approved must be YYYY-MM-DD");
  const approved = parseISO(input.i140Approved);
  const safe = addDays(approved, RETENTION_DAYS);
  let portableFrom: string | null = null;
  if (input.i485Filed) {
    if (!DATE_RE.test(input.i485Filed)) throw new Error("i485Filed must be YYYY-MM-DD");
    portableFrom = iso(addDays(parseISO(input.i485Filed), RETENTION_DAYS));
  }
  let withdrawal: RetentionResult["withdrawal"] = null;
  if (input.employerWithdrew) {
    if (!DATE_RE.test(input.employerWithdrew)) throw new Error("employerWithdrew must be YYYY-MM-DD");
    const on = parseISO(input.employerWithdrew);
    const days = differenceInCalendarDays(on, approved);
    // 205.1(a)(3)(iii)(C): a withdrawal 180 days or more after approval (or
    // after the I-485 was filed) does not revoke. Either clock suffices.
    const afterI485 = input.i485Filed ? differenceInCalendarDays(on, parseISO(input.i485Filed)) : -1;
    withdrawal = { on: input.employerWithdrew, daysAfterApproval: days, autoRevokes: days < RETENTION_DAYS && afterI485 < RETENTION_DAYS };
  }
  // 204.5(e): retained unless revoked for cause. An automatic revocation
  // inside 180 days is not a for-cause revocation, so the date survives it
  // too under the 2017 rule; what it costs is the I-140's own validity.
  return {
    withdrawalSafeFrom: iso(safe),
    portableFrom,
    withdrawal,
    priorityDateRetained: true,
    citations: [
      "8 CFR 204.5(e)(1): priority date retained from an approved I-140 unless revoked for fraud, willful misrepresentation, material error, or an invalidated labor certification",
      "8 CFR 205.1(a)(3)(iii)(C) and (D): an employer's withdrawal, or its closure, 180 days or more after approval does not revoke the I-140",
      "INA 204(j); 8 CFR 245.25: an I-485 pending 180 days or more may move to a same-or-similar job",
    ],
  };
}
