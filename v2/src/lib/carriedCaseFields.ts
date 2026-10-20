/**
 * The case fields a carried set of calculator dates fills (src/lib/carriedCase.ts).
 * Its own module so the sign-in pages, which only pass the dates along, don't
 * load the PERM date rules.
 */

import { calculatePWDExpiration } from "@/lib/perm";
import { formatAsOf } from "@/lib/dolFormat";
import type { CarriedDates } from "@/lib/carriedCase";

/**
 * The case fields the dates fill. The wage expiration comes from the same
 * central rule the calculator printed. The recruitment steps go in the
 * recruitment notes, because the calculator never says which step came first
 * (a job order, an advertisement, the notice), and putting a date on the wrong
 * step would move the case's filing window.
 */
export function carriedCaseFields(d: CarriedDates): {
  pwdDeterminationDate: string;
  pwdExpirationDate: string;
  recruitmentNotes?: string;
} {
  return {
    pwdDeterminationDate: d.pwd,
    pwdExpirationDate: calculatePWDExpiration(d.pwd),
    ...(d.first ? { recruitmentNotes: carriedRecruitmentNote(d) } : {}),
  };
}

export function carriedRecruitmentNote(d: CarriedDates): string {
  if (!d.first) return "";
  const span = d.last
    ? `first recruitment step ${formatAsOf(d.first)}, last ${formatAsOf(d.last)}`
    : `first recruitment step ${formatAsOf(d.first)}`;
  return `From the deadline calculator: ${span}. Enter each step's own dates under Recruitment and the filing window is worked out from them.`;
}
