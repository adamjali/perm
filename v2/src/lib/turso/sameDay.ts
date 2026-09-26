import "server-only";

import { cache } from "react";

import { parseCaseNumber } from "@/lib/permCaseNumber";
import { assembleSameDay, dayKey, type SameDay, type SameDayCase } from "@/lib/sameDay";
import { rows } from "@/lib/turso/client";

/** Every PERM office code DOL issues numbers under. */
const PERM_OFFICES = ["G-100", "G-200", "G-300", "G-400"] as const;

/**
 * The PERM cases filed on the same day as `caseNumber`, from our copy of DOL's
 * status records.
 *
 * Four primary-key range reads (one per office code), each bounded to one
 * day's serials: a few hundred rows in all, never a scan. `~` sorts after
 * every digit, so `<prefix>~` closes the range.
 */
export const getSameDay = cache(async (caseNumber: string): Promise<SameDay | null> => {
  const key = dayKey(caseNumber);
  const parsed = parseCaseNumber(caseNumber);
  if (!key || !parsed) return null;
  const all: SameDayCase[] = [];
  for (const office of PERM_OFFICES) {
    const prefix = `${office}-${key.code}-`;
    const got = await rows<{ case_number: string; current_status: string | null; employer_name: string | null }>(
      `SELECT case_number, current_status, employer_name FROM perm_case_status
        WHERE case_number >= ? AND case_number < ?`,
      [prefix, `${prefix}~`],
    );
    for (const r of got) {
      all.push({ caseNumber: r.case_number, status: r.current_status, employerName: r.employer_name });
    }
  }
  if (all.length === 0) return null;
  return assembleSameDay(caseNumber, parsed.filingDate, all);
});
