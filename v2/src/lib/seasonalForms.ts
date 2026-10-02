/**
 * The three forms on DOL's H-2A and H-2B prefixes, named the way DOL names
 * them. A plain module (no `server-only`), because the case browser and the
 * search results need the label in the browser too.
 *
 * - `H-300-`: an H-2A application for temporary labor certification, ETA-9142A.
 * - `H-400-`: an H-2B application for temporary labor certification, ETA-9142B.
 * - `P-400-`: a prevailing wage request filed for an H-2B job, on the same
 *   ETA-9141 form PERM and H-1B employers use, worked in its own queue.
 */
export const SEASONAL_FORMS: Readonly<Record<string, { form: string; label: string; visa: "H-2A" | "H-2B" }>> = {
  "H-300": { form: "ETA-9142A", label: "H-2A application", visa: "H-2A" },
  "H-400": { form: "ETA-9142B", label: "H-2B application", visa: "H-2B" },
  "P-400": { form: "ETA-9141", label: "H-2B wage request", visa: "H-2B" },
};

/** The form a seasonal case number names, or null for any other number. */
export function seasonalForm(caseNumber: string): { form: string; label: string; visa: "H-2A" | "H-2B" } | null {
  return SEASONAL_FORMS[caseNumber.trim().toUpperCase().slice(0, 5)] ?? null;
}
