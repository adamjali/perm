/**
 * What DOL's per-case status words mean, in plain English.
 *
 * ## The rule this file exists to enforce
 *
 * A gloss is written ONLY where the meaning is sourceable. DOL does not publish
 * a definition list for the status strings that appear in its case-status
 * search, so several of them cannot be explained without guessing, and a
 * plausible wrong explanation of a government status is worse than no
 * explanation: the reader cannot tell the two apart, and they will act on it.
 *
 * Glossed statuses are backed by the process this site already documents
 * (`content/guides/complete-perm-filing-guide.mdx`,
 * `content/guides/getting-started.mdx`) or by DOL's own published queue names
 * on flag.dol.gov/processingtimes. The rest return `null` and every caller must
 * handle that by saying nothing rather than filling the space.
 *
 * Measured against the live mirror on 2026-08-27: the glossed statuses cover
 * 410,884 of 412,865 cases (99.5%). The 0.5% that stay unglossed are
 * `IN PROCESS` (71), `APPLICATION ON HOLD` (1,789), `NORD ISSUED` (110),
 * `DETERMINATION ISSUED` (6), `REQUEST FOR REVIEW` (4) and
 * `DENIED - BALCA DISMISSED` (1). If a primary source turns up for any of them,
 * add it here rather than in a template.
 *
 * ## Statuses are canonical UPPERCASE
 *
 * `scripts/mirror_case_status.py:norm_status` upper-cases and collapses
 * whitespace at ingest, because the source emits the same status in two casings
 * and `WHERE current_status = 'Certified'` silently returned a quarter of the
 * certified cases. Lookups here normalise the same way so a caller that gets
 * its hands on an un-normalised string still resolves.
 *
 * @module
 */

/** Canonicalise a status the same way the ingest does. */
export function canonicalStatus(status: string): string {
  return status.trim().toUpperCase().split(/\s+/).join(" ");
}

/**
 * A DOL case number, normalised for a primary-key lookup, or null.
 *
 * `A-000-00000-000000`: one letter, then three, five and six-or-more digits.
 * Every case number in the 412,865-row mirror matches it.
 *
 * THIS LIVES HERE SO THERE IS ONE COPY. `src/lib/turso/caseLookup.ts` has its
 * own `normaliseCaseNumber` written to the same rule, and a key normalised
 * differently by the subscriber than by the reader is a subscription that can
 * never match its own case. `caseNumber.test.ts` asserts the two agree on the
 * same fixtures; if that file's copy is ever deleted in favour of this one, the
 * assertion is what makes that safe.
 *
 * This module is import-safe from Convex, the browser and Node alike. The Turso
 * one is not: it carries `server-only`, which is why it cannot simply be
 * imported here.
 */
export function normaliseCaseNumber(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z]-\d{3}-\d{5}-\d+$/.test(raw) ? raw : null;
}

/**
 * Statuses DOL uses that mean the application was approved.
 *
 * Exactly one entry, and the narrowness is the point. `CERTIFIED - EXPIRED`
 * carries DOL's own suffix saying the certification lapsed, so treating
 * anything merely CONTAINING "CERTIFIED" as an approval would render a lapsed
 * certification as a win.
 */
const APPROVED = new Set(["CERTIFIED"]);

/**
 * Does this status mean the case ended well?
 *
 * Used for the one visual decision in the alert email that is not purely
 * factual, so it is kept here next to the vocabulary rather than in a template,
 * and it is deliberately a lookup rather than a substring test.
 */
export function isApproval(status: string): boolean {
  return APPROVED.has(canonicalStatus(status));
}

/**
 * One sentence per status, or nothing.
 *
 * Written in the second person and in the present tense, because the reader is
 * looking at their own case and it is in this state now. No sentence here
 * predicts what happens next, and none of them carries a number: numbers belong
 * next to their population and their as-of date, which is the template's job.
 */
const MEANING: Record<string, string> = {
  "ANALYST REVIEW":
    "A Department of Labor analyst has the application. This is the main " +
    "queue, and it is where most pending PERM cases sit.",
  // NO DEADLINE IS PUBLISHED FOR AN RFI, and the 30 days that circulates
  // online is the AUDIT rule wearing the wrong label. "Request for
  // Information" and "RFI" appear nowhere in 20 CFR 656; the hook is
  // 656.20(d), which lets the CO "request supplemental information and/or
  // documentation" and sets no timeframe at all. An earlier draft of this
  // sentence said "30 days from receipt", which was wrong twice over: wrong
  // instrument, and the audit clock runs from the LETTER DATE, not receipt.
  // In an email that reaches someone the day they are told to respond, a
  // borrowed deadline could cost them the case.
  "RFI ISSUED":
    "DOL has asked the employer for more documentation. The deadline is the " +
    "one printed on the RFI letter, because DOL doesn't publish a standard " +
    "response window for these.",
  // 656.20(a)(2): the letter must "Specify a date, 30 days from the date of
  // the audit letter". From the LETTER, not receipt. 656.20(c) allows the CO
  // one discretionary extension of up to 30 days. The second sentence is the
  // part almost nobody knows, and it is why this entry earns two: a late
  // response "constitutes a refusal to exhaust available administrative
  // remedies", so review is forfeited along with the case.
  "PENDING AUDIT RESPONSE":
    "DOL has audited the application and is waiting on the employer's " +
    "recruitment file. The deadline is 30 days from the date on the audit " +
    "letter, and answering late can cost the right to appeal as well as " +
    "the case.",
  "SUPERVISED RECRUITMENT":
    "DOL is running the recruitment itself rather than reviewing the " +
    "employer's. This adds months to a case.",
  CERTIFIED:
    "DOL approved the application. The employer has 180 calendar days from " +
    "the certification date to file the I-140, with no extensions.",
  // EXPIRY IS A CALENDAR EVENT, NOT A FINDING THAT NOBODY FILED. DOL grants
  // the certification and USCIS receives the I-140; nothing suggests DOL
  // learns whether one was filed. So a case where the employer filed on day
  // 30 and one where nobody ever filed BOTH read CERTIFIED - EXPIRED. 57,038
  // cases carry this status, and telling all of them they lost something
  // would be wrong for a large share. The second sentence is our explanation
  // of DOL's mechanics, not DOL's words.
  "CERTIFIED - EXPIRED":
    "The application was approved and its 180-day window to be filed with " +
    "USCIS has since passed. If the I-140 went in inside that window it " +
    "isn't affected, because DOL's status doesn't track USCIS filings.",
  DENIED: "DOL refused the application. A denial carries appeal rights.",
  WITHDRAWN: "The application was withdrawn. DOL will not decide it.",
  "RECONSIDERATION APPEALS":
    "The employer has asked DOL to reconsider a decision on the application.",
  "BALCA APPEALS":
    "The case is with the Board of Alien Labor Certification Appeals, the " +
    "body that hears appeals of PERM decisions.",
};

/** The plain-English meaning, or null when we cannot source one. */
export function statusMeaning(status: string): string | null {
  return MEANING[canonicalStatus(status)] ?? null;
}

/**
 * The one status where the funnel is worth showing, and the only one.
 *
 * An RFI reads as bad news to almost everyone who gets one. `rfi_funnel` says
 * that of the RFIs that have since resolved, most ended certified. That is a
 * measured rate over a named population and it belongs in exactly this email
 * and nowhere else, because pasting a reassuring statistic into a denial or a
 * withdrawal would be grotesque.
 */
export function showsRfiFunnel(status: string): boolean {
  return canonicalStatus(status) === "RFI ISSUED";
}
