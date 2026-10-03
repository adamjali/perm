/**
 * The three forms on DOL's H-2A and H-2B prefixes, named the way DOL names
 * them. A plain module (no `server-only`), because the case browser and the
 * search results need the label in the browser too.
 *
 * - `H-300-`: an H-2A application for temporary labor certification, ETA-9142A.
 * - `H-400-`: an H-2B application for temporary labor certification, ETA-9142B.
 * - `P-400-`: a prevailing wage request filed for an H-2B job, on the same
 *   ETA-9141 form PERM and H-1B employers use, worked in its own queue.
 * - `P-500-`: a prevailing wage request for a CW-1 job (the Northern Mariana
 *   Islands' temporary-worker program), on the same form.
 * - `JO-A-300-`: an H-2A job order (Form ETA-790/790A), filed before the H-2A
 *   application and approved on its own.
 * - `C-500-`: a CW-1 application for temporary labor certification, ETA-9142C.
 */
export type SeasonalVisa = "H-2A" | "H-2B" | "CW-1";

export const SEASONAL_FORMS: Readonly<Record<string, { form: string; label: string; visa: SeasonalVisa }>> = {
  "H-300": { form: "ETA-9142A", label: "H-2A application", visa: "H-2A" },
  "H-400": { form: "ETA-9142B", label: "H-2B application", visa: "H-2B" },
  "P-400": { form: "ETA-9141", label: "H-2B wage request", visa: "H-2B" },
  "P-500": { form: "ETA-9141", label: "CW-1 wage request", visa: "CW-1" },
  "JO-A-300": { form: "ETA-790A", label: "H-2A job order", visa: "H-2A" },
  "C-500": { form: "ETA-9142C", label: "CW-1 application", visa: "CW-1" },
};

/** The form a seasonal case number names, or null for any other number. */
export function seasonalForm(caseNumber: string): { form: string; label: string; visa: SeasonalVisa } | null {
  // The form code is everything before the day code: five characters for
  // most, eight for the job order's `JO-A-300`.
  const m = /^((?:JO-A|[A-Z])-\d{3})-\d{5}-/.exec(caseNumber.trim().toUpperCase());
  return (m ? SEASONAL_FORMS[m[1]!] : undefined) ?? null;
}
