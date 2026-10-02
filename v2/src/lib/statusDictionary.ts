/**
 * Every status word DOL's FLAG system can put on a case, in one place.
 *
 * PERM statuses come from `permStatus.ts`, whose entries are the ones the
 * case page itself renders, so the dictionary and the lookup cannot say two
 * things about one word. The prevailing wage and LCA vocabularies live here
 * because nothing else on the site had written them down: the wage-request
 * page bucketed them into "issued" and "pending" without saying what each
 * word is.
 *
 * THE SOURCING RULE IS THE SHAPE. A FLAG entry carries either a `cite` (a
 * section of 20 CFR with a link) or an `unsourced` sentence admitting that DOL
 * publishes no definition and the meaning is read off the workflow. Never
 * both, never neither, and `statusDictionary.test.ts` refuses either.
 */

import { allStatusMeanings, type StatusKind, type StatusMeaning } from "./permStatus";

export interface FlagStatusEntry {
  /** DOL's own string, exactly as FLAG shows it. */
  status: string;
  label: string;
  /** Whether a case in this status is still waiting on DOL, or is done. */
  pending: boolean;
  summary: string;
  cite?: { label: string; href: string };
  unsourced?: string;
}

const CFR = (part: string, section: string) =>
  `https://www.ecfr.gov/current/title-20/chapter-V/part-${part}/section-${section}`;

/** A URL fragment for a status word. `stageSlug`'s transliteration, so the two agree. */
export function statusAnchor(status: string): string {
  return status
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const KIND_ORDER: readonly StatusKind[] = ["queue", "action", "appeal", "decided"];

export const KIND_HEADING: Record<StatusKind, { title: string; lede: string }> = {
  queue: {
    title: "Waiting in line",
    lede: "Nothing has been asked of anyone. The case is in DOL's ordinary queue, worked in filing order.",
  },
  action: {
    title: "Something is due",
    lede: "DOL has asked the employer for something and a clock is running. These are the statuses with a deadline in the regulation.",
  },
  appeal: {
    title: "Under appeal",
    lede: "A denial is being contested. Each step has its own window and its own decision-maker.",
  },
  decided: {
    title: "Decided",
    lede: "DOL is finished with the application. What happens next, if anything, happens at USCIS.",
  },
};

/** The PERM vocabulary, grouped for a page, in the order the process runs. */
export function permStatusGroups(): { kind: StatusKind; entries: StatusMeaning[] }[] {
  const all = allStatusMeanings();
  return KIND_ORDER.map((kind) => ({ kind, entries: all.filter((m) => m.kind === kind) }));
}

/**
 * Prevailing wage request (ETA-9141) statuses, as `pwd_case_status` holds them.
 *
 * The review chain is 20 CFR 656.41: an employer who disputes a determination
 * asks the National Prevailing Wage Center for a redetermination within 30
 * days of the determination date, can take the redetermination to the Center
 * Director, and can take that to BALCA. Each stop is a status word.
 */
export const PWD_STATUSES: FlagStatusEntry[] = [
  {
    status: "IN PROCESS",
    label: "In process",
    pending: true,
    summary: "The request has been received and no determination has been issued. This is the ordinary wage queue, worked in filing order.",
    unsourced: "A workflow word with no regulatory definition. DOL publishes which filing month the center is working, and that is the only official measure of the wait.",
  },
  {
    status: "RFI ISSUED",
    label: "RFI issued",
    pending: true,
    summary: "The center has asked the employer for information before it will issue a determination, usually about the job's duties, requirements or worksite.",
    unsourced: "DOL publishes no definition and no response period for a wage-request RFI; the letter states its own. A request the employer never answers is returned unprocessed.",
  },
  {
    status: "DETERMINATION ISSUED",
    label: "Determination issued",
    pending: false,
    summary: "The center issued the prevailing wage. It is valid for 90 days or until the next June 30, whichever the rule gives, and recruitment or the ETA-9089 has to start inside that window.",
    cite: { label: "20 CFR 656.40(c)", href: CFR("656", "656.40") },
  },
  {
    status: "PENDING REDETERMINATION",
    label: "Pending redetermination",
    pending: true,
    summary: "The employer asked the center to look at its own determination again. The request has to be made within 30 days of the determination date.",
    cite: { label: "20 CFR 656.41", href: CFR("656", "656.41") },
  },
  {
    status: "REDETERMINATION AFFIRMED",
    label: "Redetermination affirmed",
    pending: false,
    summary: "The center looked again and kept its wage. The employer's next step, if any, is a request for Center Director review.",
    cite: { label: "20 CFR 656.41", href: CFR("656", "656.41") },
  },
  {
    status: "REDETERMINATION MODIFIED",
    label: "Redetermination modified",
    pending: false,
    summary: "The center looked again and changed the wage. The modified determination is the one that now governs the case.",
    cite: { label: "20 CFR 656.41", href: CFR("656", "656.41") },
  },
  {
    status: "PENDING CENTER DIRECTOR REVIEW",
    label: "Pending Center Director review",
    pending: true,
    summary: "The employer took a redetermination it still disputes up to the Center Director, the step above the analyst and below BALCA.",
    cite: { label: "20 CFR 656.41", href: CFR("656", "656.41") },
  },
  {
    status: "CENTER DIRECTOR REVIEW AFFIRMED DETERMINATION",
    label: "Center Director review affirmed",
    pending: false,
    summary: "The Center Director upheld the wage. The remaining route is review by BALCA.",
    cite: { label: "20 CFR 656.41", href: CFR("656", "656.41") },
  },
  {
    status: "CENTER DIRECTOR REVIEW MODIFIED DETERMINATION",
    label: "Center Director review modified",
    pending: false,
    summary: "The Center Director changed the wage. The modified determination governs.",
    cite: { label: "20 CFR 656.41", href: CFR("656", "656.41") },
  },
  {
    status: "RETURNED UNPROCESSED",
    label: "Returned unprocessed",
    pending: false,
    summary: "The center sent the request back without deciding it. DOL neither granted nor denied a wage and the employer did not withdraw, so this is none of those three.",
    unsourced: "DOL publishes no definition. The commonest reading is an unanswered RFI or a request that could not be processed as filed; the record does not say which.",
  },
  {
    status: "WITHDRAWN",
    label: "Withdrawn",
    pending: false,
    summary: "The employer withdrew the request before a determination. DOL records no reason.",
    unsourced: "A workflow word; the regulation describes withdrawal of a PERM application, not of a wage request.",
  },
];

/**
 * H-1B labor condition application (ETA-9035) statuses. An LCA is certified
 * or returned within seven working days, so almost nothing pends.
 */
export const LCA_STATUSES: FlagStatusEntry[] = [
  {
    status: "IN PROCESS",
    label: "In process",
    pending: true,
    summary: "Filed and not yet certified. The regulation gives DOL seven working days to certify or return an LCA, so this status rarely lasts a week.",
    cite: { label: "20 CFR 655.740(a)", href: CFR("655", "655.740") },
  },
  {
    status: "CERTIFIED",
    label: "Certified",
    pending: false,
    summary: "DOL certified the application. Certification is a review of completeness and obvious inaccuracy, not of the wage or the job; the employer's attestations are what the certification rests on.",
    cite: { label: "20 CFR 655.740", href: CFR("655", "655.740") },
  },
  {
    status: "CERTIFIED - WITHDRAWN",
    label: "Certified, then withdrawn",
    pending: false,
    summary: "The employer withdrew an LCA after DOL certified it. Obligations that attached while it was in force, including the wage, survive for the period it was used.",
    cite: { label: "20 CFR 655.750(b)", href: CFR("655", "655.750") },
  },
  {
    status: "WITHDRAWN",
    label: "Withdrawn",
    pending: false,
    summary: "The employer withdrew the application before certification.",
    cite: { label: "20 CFR 655.750(b)", href: CFR("655", "655.750") },
  },
  {
    status: "DENIED",
    label: "Denied",
    pending: false,
    summary: "DOL did not certify the application. On an LCA that almost always means an incomplete or obviously inaccurate form, which the employer can correct and refile.",
    cite: { label: "20 CFR 655.740(a)", href: CFR("655", "655.740") },
  },
];

/**
 * H-2A applications (`H-300-`, ETA-9142A), H-2B applications (`H-400-`,
 * ETA-9142B) and H-2B prevailing wage requests (`P-400-`): every status DOL's
 * live index returned for them in the backfill, pending first.
 * Cites are 20 CFR part 655, subpart A (H-2B) and subpart B (H-2A), read on
 * eCFR as of Sep 29 2026. `forms` names which of the three the word appears on.
 */
export const SEASONAL_STATUSES: (FlagStatusEntry & { forms: string })[] = [
  {
    status: "IN PROCESS",
    label: "In process",
    pending: true,
    forms: "All three",
    summary: "Filed and not yet acted on. On an application DOL accepts it or sends a notice of deficiency within 7 days of receipt: calendar days for H-2A, business days for H-2B.",
    cite: { label: "20 CFR 655.33, 655.143", href: CFR("655", "655.143") },
  },
  {
    status: "NOD ISSUED",
    label: "Notice of deficiency issued",
    pending: true,
    forms: "H-2A and H-2B applications",
    summary: "DOL found the application or job order incomplete or wrong and said what to fix. The employer has 5 business days (H-2A) or 10 (H-2B) to send a modified application or ask a judge to review the notice; otherwise it is denied.",
    cite: { label: "20 CFR 655.31, 655.141", href: CFR("655", "655.141") },
  },
  {
    status: "ACCEPTED - PENDING RECRUITMENT",
    label: "Accepted, pending recruitment",
    pending: true,
    forms: "H-2A and H-2B applications",
    summary: "DOL issued a notice of acceptance. The job order goes out to state workforce agencies and the employer recruits U.S. workers before DOL decides; an H-2A decision is due no later than 30 days before the first date of need.",
    cite: { label: "20 CFR 655.33, 655.143", href: CFR("655", "655.33") },
  },
  {
    status: "NOR ISSUED",
    label: "NOR issued",
    pending: true,
    forms: "H-2B applications",
    summary: "A notice DOL sent on an H-2B application that is still open.",
    unsourced: "DOL publishes no definition of NOR and the H-2B rules don't use the abbreviation. The letter itself says what it asks for and by when.",
  },
  {
    status: "NRM ISSUED",
    label: "NRM issued",
    pending: true,
    forms: "H-2A applications",
    summary: "A notice DOL sent on an H-2A application that is still open.",
    unsourced: "DOL publishes no definition of NRM and the H-2A rules don't use the abbreviation. The letter itself says what it asks for and by when.",
  },
  {
    status: "RFI ISSUED",
    label: "RFI issued",
    pending: true,
    forms: "H-2B wage requests",
    summary: "The wage center asked the employer for information before it will set the wage.",
    unsourced: "DOL publishes no definition and no response period for a wage-request RFI; the letter states its own.",
  },
  {
    status: "PENDING APPEAL",
    label: "Pending appeal",
    pending: true,
    forms: "H-2A and H-2B applications",
    summary: "The employer asked an administrative law judge to review a notice of deficiency or a denial. On H-2A the employer can ask for an expedited review or a new hearing.",
    cite: { label: "20 CFR 655.61, 655.171", href: CFR("655", "655.171") },
  },
  {
    status: "PENDING CENTER DIRECTOR REVIEW",
    label: "Pending Center Director review",
    pending: true,
    forms: "H-2B wage requests",
    summary: "The employer disputes the wage and asked the National Prevailing Wage Center's director to review it. The request has to be made within 7 business days of the determination.",
    cite: { label: "20 CFR 655.13(a)", href: CFR("655", "655.13") },
  },
  {
    status: "Post-Cert Request Pending",
    label: "Post-certification request pending",
    pending: true,
    forms: "H-2B applications",
    summary: "DOL already certified the application and the employer has asked for something after it. DOL writes this one in mixed case.",
    unsourced: "DOL publishes no definition; the record doesn't say what was asked for.",
  },
  {
    status: "FULL CERTIFICATION",
    label: "Full certification",
    pending: false,
    forms: "H-2A and H-2B applications",
    summary: "DOL certified the application for every worker and the whole period requested. The employer files the certified application with its petition to USCIS; for H-2A, DOL sends it to USCIS directly.",
    cite: { label: "20 CFR 655.52, 655.162", href: CFR("655", "655.162") },
  },
  {
    status: "PARTIAL CERTIFICATION",
    label: "Partial certification",
    pending: false,
    forms: "H-2A and H-2B applications",
    summary: "DOL certified fewer workers, a shorter period, or both. For H-2B the number drops by one for each qualified U.S. worker who is available and wasn't rejected for a lawful reason.",
    cite: { label: "20 CFR 655.54", href: CFR("655", "655.54") },
  },
  {
    status: "FULL CERTIFICATION - EXPIRED",
    label: "Full certification, expired",
    pending: false,
    forms: "H-2A applications",
    summary: "A certification DOL now shows as expired.",
    unsourced: "DOL publishes no definition of the expired label on a temporary certification.",
  },
  {
    status: "PARTIAL CERTIFICATION - EXPIRED",
    label: "Partial certification, expired",
    pending: false,
    forms: "H-2A applications",
    summary: "A partial certification DOL now shows as expired.",
    unsourced: "DOL publishes no definition of the expired label on a temporary certification.",
  },
  {
    status: "FULL CERTIFICATION - WITHDRAWN",
    label: "Full certification, withdrawn",
    pending: false,
    forms: "H-2A applications",
    summary: "The employer withdrew the application after DOL certified it. It stays bound by the job order's terms for every worker it recruited under it.",
    cite: { label: "20 CFR 655.172", href: CFR("655", "655.172") },
  },
  {
    status: "DETERMINATION ISSUED",
    label: "Determination issued",
    pending: false,
    forms: "H-2B wage requests",
    summary: "The wage center set the prevailing wage. The H-2B job has to be advertised and paid at least that, or any higher minimum wage that applies.",
    cite: { label: "20 CFR 655.10", href: CFR("655", "655.10") },
  },
  {
    status: "CENTER DIRECTOR REVIEW AFFIRMED DETERMINATION",
    label: "Center Director review affirmed",
    pending: false,
    forms: "H-2B wage requests",
    summary: "The center's director kept the wage. The employer can ask BALCA to review it within 10 business days.",
    cite: { label: "20 CFR 655.13", href: CFR("655", "655.13") },
  },
  {
    status: "CENTER DIRECTOR REVIEW MODIFIED DETERMINATION",
    label: "Center Director review modified",
    pending: false,
    forms: "H-2B wage requests",
    summary: "The center's director changed the wage. The modified determination is the one that governs.",
    cite: { label: "20 CFR 655.13", href: CFR("655", "655.13") },
  },
  {
    status: "BALCA OVERTURNED",
    label: "BALCA overturned",
    pending: false,
    forms: "H-2B wage requests",
    summary: "The employer took the director's decision to the Board of Alien Labor Certification Appeals, and the board reversed it.",
    cite: { label: "20 CFR 655.13(c)", href: CFR("655", "655.13") },
  },
  {
    status: "DENIED",
    label: "Denied",
    pending: false,
    forms: "H-2A and H-2B applications",
    summary: "DOL refused the certification, giving its reasons. The employer can ask a judge to review the denial; without that request the denial is final.",
    cite: { label: "20 CFR 655.53, 655.164", href: CFR("655", "655.164") },
  },
  {
    status: "RETURNED UNPROCESSED",
    label: "Returned unprocessed",
    pending: false,
    forms: "H-2B wage requests",
    summary: "The request went back to the employer without a decision.",
    unsourced: "DOL publishes no definition for a wage request; the record doesn't say why it was returned.",
  },
  {
    status: "WITHDRAWN",
    label: "Withdrawn",
    pending: false,
    forms: "All three",
    summary: "The employer withdrew the filing before DOL decided it. DOL records no reason.",
    unsourced: "A workflow word; the H-2A and H-2B rules describe withdrawal only after certification.",
  },
];

/** Every anchor on the dictionary page, for the jump list and the JSON-LD. */
export function dictionaryAnchors(): { program: "perm" | "pwd" | "lca" | "seasonal"; status: string; label: string; anchor: string }[] {
  return [
    ...allStatusMeanings().map((m) => ({ program: "perm" as const, status: m.status, label: m.label, anchor: statusAnchor(m.status) })),
    ...PWD_STATUSES.map((e) => ({ program: "pwd" as const, status: e.status, label: e.label, anchor: `pwd-${statusAnchor(e.status)}` })),
    ...LCA_STATUSES.map((e) => ({ program: "lca" as const, status: e.status, label: e.label, anchor: `lca-${statusAnchor(e.status)}` })),
    ...SEASONAL_STATUSES.map((e) => ({ program: "seasonal" as const, status: e.status, label: e.label, anchor: `h2-${statusAnchor(e.status)}` })),
  ];
}
