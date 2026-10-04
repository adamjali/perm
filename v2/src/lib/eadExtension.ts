/**
 * Whether an EAD (Form I-766) was automatically extended by a renewal, and to
 * when. Pure, so the page, its tests and any later surface read one rule.
 *
 * Read from the primary sources on Oct 4 2026:
 *
 * - 8 CFR 274a.13(d), as in force (eCFR, Sep 30 2026), "Renewal application
 *   filed before October 30, 2025": an automatic extension "not to exceed 540
 *   days" when the renewal was (i) properly filed before the expiration date on
 *   the card, (ii) in the same category as the card, and (iii) in a category
 *   USCIS lists as eligible. "The first day of the automatic extension ... is
 *   the day after the expiration date shown on the face" of the card, and it
 *   ends earlier on a denial ((d)(3)). The card plus the I-797C receipt is the
 *   proof ((d)(4)).
 * - 8 CFR 274a.13(e), added by the interim final rule at 90 FR 48799
 *   (Federal Register document 2025-19702, Oct 30 2025): a renewal filed on or
 *   after October 30, 2025 extends nothing, "except as otherwise provided by
 *   law ... or in an applicable Federal Register notice regarding procedures
 *   for renewing TPS-related employment documentation".
 * - USCIS's category table, now on its archive (last updated Oct 29 2025):
 *   which categories qualified, and that A17, A18 and C26 also end with the
 *   I-94. TPS categories (A12, C19) follow their own Federal Register notices,
 *   so this module doesn't compute them.
 */

export const RULE_CUTOFF = "2025-10-30";
export const EXTENSION_DAYS = 540;

export interface EadCategory {
  code: string;
  label: string;
  /** The extension also ends on the I-94's date (A17, A18, C26). */
  capsAtI94: boolean;
  /** TPS: set by the Federal Register notice for the designation, not by 274a.13(d). */
  tps?: boolean;
}

/** USCIS's table of categories eligible for the automatic extension, in its order. */
export const EAD_CATEGORIES: readonly EadCategory[] = [
  { code: "A03", label: "Refugee", capsAtI94: false },
  { code: "A05", label: "Asylee", capsAtI94: false },
  { code: "A07", label: "N-8 or N-9", capsAtI94: false },
  { code: "A08", label: "Citizen of Micronesia, Marshall Islands, or Palau", capsAtI94: false },
  { code: "A10", label: "Withholding of deportation or removal granted", capsAtI94: false },
  { code: "A12", label: "Temporary Protected Status granted", capsAtI94: false, tps: true },
  { code: "A17", label: "Spouse of an E nonimmigrant (E-1S, E-2S, E-3S)", capsAtI94: true },
  { code: "A18", label: "Spouse of an L-1 nonimmigrant (L-2S)", capsAtI94: true },
  { code: "C08", label: "Asylum application pending", capsAtI94: false },
  { code: "C09", label: "Adjustment of status (I-485) pending", capsAtI94: false },
  { code: "C10", label: "Suspension of deportation or cancellation of removal applicant", capsAtI94: false },
  { code: "C16", label: "Creation of record (registry)", capsAtI94: false },
  { code: "C19", label: "Prima facie eligible for TPS", capsAtI94: false, tps: true },
  { code: "C20", label: "Section 210 legalization (pending I-700)", capsAtI94: false },
  { code: "C22", label: "Section 245A legalization (pending I-687)", capsAtI94: false },
  { code: "C24", label: "LIFE legalization", capsAtI94: false },
  { code: "C26", label: "Spouse of certain H-1B workers (H-4)", capsAtI94: true },
  { code: "C31", label: "VAWA self-petitioner", capsAtI94: false },
];

export type EadVerdict =
  | { kind: "extended"; through: string; byI94: boolean }
  | { kind: "no-renewal" }
  | { kind: "after-cutoff" }
  | { kind: "filed-late" }
  | { kind: "not-eligible" }
  | { kind: "different-category" }
  | { kind: "tps" };

export interface EadInput {
  /** The "Card Expires" date. */
  cardExpires: string;
  /** The I-797C receipt's "Received Date" for the renewal; null when none was filed. */
  renewalReceived: string | null;
  /** The category code on the receipt. */
  category: string;
  /** False when the renewal is in a different category from the card. */
  sameCategory: boolean;
  /** The I-94's end date, for A17, A18 and C26. */
  i94Until?: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `iso` plus `days`, in UTC so a time zone can't move the date. */
export function addDaysIso(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function eadExtension(input: EadInput): EadVerdict {
  if (!DATE_RE.test(input.cardExpires)) throw new Error("cardExpires must be YYYY-MM-DD");
  const cat = EAD_CATEGORIES.find((c) => c.code === input.category.toUpperCase());
  if (!input.renewalReceived) return { kind: "no-renewal" };
  if (!DATE_RE.test(input.renewalReceived)) throw new Error("renewalReceived must be YYYY-MM-DD");
  if (cat?.tps) return { kind: "tps" };
  // 274a.13(e): nothing filed on or after the cutoff is extended, whatever the category.
  if (input.renewalReceived >= RULE_CUTOFF) return { kind: "after-cutoff" };
  // (d)(1)(i): filed before the card's own expiration date.
  if (input.renewalReceived >= input.cardExpires) return { kind: "filed-late" };
  // (d)(1)(iii): a category USCIS lists.
  if (!cat) return { kind: "not-eligible" };
  // (d)(1)(ii): the same category as the card.
  if (!input.sameCategory) return { kind: "different-category" };
  const full = addDaysIso(input.cardExpires, EXTENSION_DAYS);
  if (cat.capsAtI94 && input.i94Until && DATE_RE.test(input.i94Until) && input.i94Until < full) {
    return { kind: "extended", through: input.i94Until, byI94: true };
  }
  return { kind: "extended", through: full, byI94: false };
}
