/**
 * USCIS receipt numbers: the shape, the prefixes, and what the digits are
 * commonly read as.
 *
 * This module is CLIENT-SAFE and pure, the same way `caseNumberShape.ts` is
 * for DOL numbers: the lookup form uses it to say "that is a USCIS number,
 * not a DOL one" before a round trip, and the server uses the same rule to
 * route. It is deliberately separate from `permCaseNumber.ts`: a DOL case
 * number (`G-100-26125-868956`) and a USCIS receipt (`EAC2190123456`) are
 * different agencies, different records and different lookups, and one
 * parser that accepts both is how a P-100 row once leaked into the PERM
 * table.
 *
 * ## What is primary-sourced and what is convention
 *
 * USCIS's own glossary (uscis.gov/tools/glossary, entry "Receipt Number",
 * read 2026-09-22) says, verbatim: "The receipt number consists of 3 letters,
 * such as EAC, WAC, LIN, SRC, NBC, MSC or IOE, with 10 numbers." The Case
 * Status API's OpenAPI spec (developer.uscis.gov, captured 2026-09-21) gives
 * the validation regex as `[a-zA-Z]{3}[0-9]{10}` and, for masked numbers,
 * `[a-zA-Z]{3}\*[0-9]{9}`, and answers 422 to anything else.
 *
 * What USCIS does NOT document anywhere we could find is the reading of the
 * ten digits as `YY` fiscal year + `DDD` computer workday + `NNNNN` sequence.
 * That reading is universal in practitioner guides and matches every notice
 * we have seen, but it is a convention, so `decodeReceipt` labels it as one
 * and the page says so in words. A wrong "filed in FY2021" is worse than no
 * year, which is the same rule the DOL parser applies to legacy numbers.
 */

/** The canonical 13-character shape, upper-cased, no separators. */
const FULL = /^[A-Z]{3}\d{10}$/;

/** USCIS's masked form: three letters, an asterisk, nine digits. */
const MASKED = /^[A-Z]{3}\*\d{9}$/;

export interface ReceiptPrefix {
  /** The office the prefix names. */
  name: string;
  /** Where the attribution comes from. "glossary" is USCIS's own list. */
  source: "glossary" | "notices";
  /** Anything a reader should know about this prefix. */
  note?: string;
}

/**
 * The prefixes. The seven marked "glossary" are the ones USCIS lists by
 * name; YSC appears on real notices from the Potomac Service Center but is
 * absent from the glossary's list, so it is attributed to notices rather
 * than to USCIS's definition. Any three letters are still ACCEPTED as a
 * shape, because USCIS's own regex accepts them and a new center would
 * otherwise be unenterable here.
 */
export const RECEIPT_PREFIXES: Readonly<Record<string, ReceiptPrefix>> = {
  EAC: { name: "Vermont Service Center", source: "glossary", note: "The letters stand for Eastern Adjudication Center, the center's old name." },
  WAC: { name: "California Service Center", source: "glossary", note: "Western Adjudication Center, the old name." },
  LIN: { name: "Nebraska Service Center", source: "glossary", note: "Lincoln, where the center sits." },
  SRC: { name: "Texas Service Center", source: "glossary", note: "Southern Regional Center, the old name." },
  NBC: { name: "National Benefits Center", source: "glossary", note: "Cases that end at a field office, including most I-485 adjustment filings." },
  MSC: { name: "National Benefits Center", source: "glossary", note: "Missouri Service Center, the center's earlier name; still issued." },
  IOE: {
    name: "USCIS online filing (ELIS)",
    source: "glossary",
    note: "Filed through a USCIS online account. The Case Status API returns no filing or modified date for IOE receipts.",
  },
  YSC: { name: "Potomac Service Center", source: "notices" },
};

/** Whether this text is a USCIS receipt by shape, ignoring case, spaces and dashes. */
export function normaliseReceipt(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/[\s-]+/g, "");
  return FULL.test(raw) || MASKED.test(raw) ? raw : null;
}

export interface DecodedReceipt {
  /** The normalised 13-character number. */
  receipt: string;
  /** The three-letter prefix. */
  prefix: string;
  /** USCIS's attribution for the prefix, or null for one we do not know. */
  office: ReceiptPrefix | null;
  /** True for the masked `ABC*123456789` form, which carries no readable digits. */
  masked: boolean;
  /**
   * The conventional reading of the digits. Null when masked. `fiscalYear` is
   * the four-digit federal fiscal year the two-digit field implies; `workday`
   * is the 1-based computer workday within that year; `sequence` the last
   * five digits. Labelled a convention everywhere it is shown.
   */
  convention: { fiscalYear: number; workday: number; sequence: string } | null;
}

/**
 * Decode a receipt into its parts. Shape only; nothing here asks USCIS.
 */
export function decodeReceipt(input: string): DecodedReceipt | null {
  const receipt = normaliseReceipt(input);
  if (!receipt) return null;
  const prefix = receipt.slice(0, 3);
  const office = RECEIPT_PREFIXES[prefix] ?? null;
  const masked = receipt.includes("*");
  let convention: DecodedReceipt["convention"] = null;
  if (!masked) {
    const yy = Number(receipt.slice(3, 5));
    const ddd = Number(receipt.slice(5, 8));
    // Two-digit fiscal years: USCIS issued receipts under this scheme well
    // before 2000, so 90-99 are read as the 1990s and everything else as
    // 2000s. A receipt from 1989 or earlier is not something anyone looks up.
    const fiscalYear = yy >= 90 ? 1900 + yy : 2000 + yy;
    convention = { fiscalYear, workday: ddd, sequence: receipt.slice(8) };
  }
  return { receipt, prefix, office, masked, convention };
}

/**
 * Is this plausibly a USCIS receipt someone half-typed, as opposed to a DOL
 * number or an employer name? Three letters then digits, no dashes in the
 * DOL positions. Used by the DOL lookup form to point at the right page
 * BEFORE refusing, since a reader with an I-140 receipt is on the wrong page
 * rather than holding a malformed number.
 */
export function looksLikeReceipt(input: string): boolean {
  const raw = input.trim().toUpperCase().replace(/[\s-]+/g, "");
  return /^[A-Z]{3}\*?\d{4,}$/.test(raw) && !/^[A-Z]-/.test(input.trim().toUpperCase());
}

/**
 * The sentence shown when the shape is wrong. Written once so the client
 * hint and the server notice cannot say different things.
 */
export const RECEIPT_SHAPE_MESSAGE =
  "A USCIS receipt number is three letters and ten digits, like EAC2190123456, with no spaces or dashes. It is on the top of every I-797 notice.";
