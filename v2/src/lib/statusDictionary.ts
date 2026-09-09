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

/** Every anchor on the dictionary page, for the jump list and the JSON-LD. */
export function dictionaryAnchors(): { program: "perm" | "pwd" | "lca"; status: string; label: string; anchor: string }[] {
  return [
    ...allStatusMeanings().map((m) => ({ program: "perm" as const, status: m.status, label: m.label, anchor: statusAnchor(m.status) })),
    ...PWD_STATUSES.map((e) => ({ program: "pwd" as const, status: e.status, label: e.label, anchor: `pwd-${statusAnchor(e.status)}` })),
    ...LCA_STATUSES.map((e) => ({ program: "lca" as const, status: e.status, label: e.label, anchor: `lca-${statusAnchor(e.status)}` })),
  ];
}
