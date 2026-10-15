/**
 * What a DOL status means for the reader, as one of four tones, across every
 * program (PERM, wage requests, LCAs, H-2A, H-2B and CW-1). The tone only
 * colours a dot beside the status's own words; the words carry the meaning.
 *
 * "CERTIFIED - EXPIRED" is not good news (the certification lapsed), and a
 * withdrawal is the employer's choice, not DOL's verdict: both are flat.
 */
export type StatusTone = "good" | "bad" | "warn" | "flat";

const GOOD = /^(CERTIFIED|DETERMINATION ISSUED|REDETERMINATION|FULL CERTIFICATION|PARTIAL CERTIFICATION|APPROVED)\b/;
const BAD = /^(DENIED|NOR ISSUED)\b|REJECTED|REVOKED/;
const WARN = /RFI|ON HOLD|\bNOD\b|\bNORD\b|AUDIT|APPEAL|REVIEW REQUESTED|REQUEST FOR REVIEW/;

export function statusTone(status: string | null | undefined): StatusTone {
  const u = (status ?? "").trim().toUpperCase();
  if (!u) return "flat";
  if (u.includes("EXPIRED")) return "flat";
  // DOL taking a certification back is its verdict against the employer;
  // the employer withdrawing one it was granted is the employer's choice.
  if (BAD.test(u)) return "bad";
  if (u.includes("WITHDRAWN")) return "flat";
  if (GOOD.test(u)) return "good";
  if (WARN.test(u)) return "warn";
  return "flat";
}

/** DOL's acronyms, which stay in capitals whatever the casing around them. */
const STATUS_ACRONYMS = /\b(rfi|nord|nod|nor|nrm|balca|co)\b/gi;

/** A DOL status as a name ("Analyst Review", "RFI Issued"): each word capitalised, DOL's acronyms kept. */
export function prettyStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(STATUS_ACRONYMS, (m) => m.toUpperCase());
}
