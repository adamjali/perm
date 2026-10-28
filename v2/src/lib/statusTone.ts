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

/**
 * The soft fill a status chip carries in the data section's case tables
 * (round 3, Oct 15 2026). It answers one question, where the case stands with
 * DOL, so it reads differently from `statusTone`: a certification that later
 * lapsed was still certified (the chip's words say it expired), and a
 * withdrawal gets its own colour because it's the employer's step, not DOL's.
 *
 * - wait: in DOL's line (analyst review, in process, accepted, received)
 * - good: certified, determination issued, approved
 * - withdrawn: the employer took it back
 * - bad: denied, rejected, revoked
 * - aside: out of filing order (on hold, RFI, NOD, audit, appeal, review)
 * - flat: decided some other way (archived, a Board ruling) or no status
 *
 * Anything unrecognised reads as waiting, the same safe default the sweep
 * uses for a status it doesn't know.
 */
export type CaseStatusTint = "wait" | "good" | "withdrawn" | "bad" | "aside" | "flat";

const DECIDED_OTHER = /^(ARCHIVED|CLOSED|RETURNED)\b|\b(AFFIRMED|DISMISSED|OVERTURNED)$/;
const DETERMINATION_STANDS = /(AFFIRMED|MODIFIED) DETERMINATION$/;
const OUT_OF_ORDER = /RECONSIDERATION|BALCA|CENTER DIRECTOR REVIEW|\bNRM\b/;

export function caseStatusTint(status: string | null | undefined): CaseStatusTint {
  const u = (status ?? "").trim().toUpperCase();
  if (!u) return "flat";
  if (BAD.test(u)) return "bad";
  if (u.includes("WITHDRAWN")) return "withdrawn";
  if (GOOD.test(u) || DETERMINATION_STANDS.test(u)) return "good";
  // A Board ruling ("BALCA AFFIRMED") is decided; "PENDING BALCA" is not.
  if (DECIDED_OTHER.test(u)) return "flat";
  if (WARN.test(u) || OUT_OF_ORDER.test(u)) return "aside";
  return "wait";
}

/** Each tint's fill: a pastel wash under ink words, in both themes. */
export const CASE_STATUS_FILL: Record<CaseStatusTint, string> = {
  wait: "bg-soft-wait",
  good: "bg-soft-good",
  withdrawn: "bg-soft-purple",
  bad: "bg-soft-bad",
  aside: "bg-soft-info",
  flat: "bg-muted",
};

/** DOL's acronyms, which stay in capitals whatever the casing around them. */
const STATUS_ACRONYMS = /\b(rfi|nord|nod|nor|nrm|balca|co)\b/gi;

/** A DOL status as a name ("Analyst Review", "RFI Issued"): each word capitalised, DOL's acronyms kept. */
export function prettyStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(STATUS_ACRONYMS, (m) => m.toUpperCase());
}
