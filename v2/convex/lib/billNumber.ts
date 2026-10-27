/**
 * A bill's number as Congress prints it, from the policy feed's document
 * number (`scripts/ingest_congress_bills.py`: `bill-<congress>-<type>-<number>`).
 * congress.gov's titles leave the number out, and the number is what people
 * search for ("H.R. 2315").
 */

const PRINTED: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
};

/** "H.R. 2315", or null for a document number that isn't a bill's. */
export function billNumber(documentNumber: string): string | null {
  const m = /^bill-\d+-([a-z]+)-(\d+)$/.exec(documentNumber);
  if (!m) return null;
  const printed = PRINTED[m[1]!];
  return printed ? `${printed} ${m[2]}` : null;
}
