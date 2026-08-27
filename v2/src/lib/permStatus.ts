/**
 * What DOL's case-status words actually mean.
 *
 * FLAG shows a case one screaming-caps string and explains none of them.
 * "ANALYST REVIEW" and "NORD ISSUED" are the difference between waiting and
 * having thirty days to do something, and somebody reading their own case has
 * no way to tell which they are looking at. Decoding them costs nothing and
 * it is the most useful thing this page does that no data can do.
 *
 * SOURCING. Every deadline and every consequence below is quoted from 20 CFR
 * part 656 and carries its section. Where DOL publishes no definition, and
 * it publishes none for several of these because they are internal workflow
 * states rather than regulatory ones, the entry says so and stops. An
 * invented definition on a page that reads as authoritative is worse than a
 * gap, and it would be undetectable to the person it misled.
 *
 * WHO ACTS. In PERM the party is the EMPLOYER, not the worker. Most consumer
 * pages write "you must respond within 30 days" at an audience that legally
 * cannot respond at all. Every action below names the employer, because
 * someone reading their own case number needs to know the clock is running
 * on somebody else's desk.
 *
 * NOTHING HERE IS A PROBABILITY. No entry says what a status is likely to
 * become. The mirror holds one observation per case and cannot see
 * transitions, so it could not support such a claim, and next to a real case
 * number it would be read as a forecast for that case.
 */

// stages.ts is pure logic despite sitting beside the components that use it,
// and it already owns the acronym rules that turn RFI into Rfi if you get
// them wrong. A second copy here is exactly the drift this repo gates for.
import { prettyStatus } from "@/components/queue/stages";

export type StatusKind = "queue" | "action" | "appeal" | "decided";

export interface StatusMeaning {
  /** DOL's own string, upper case, exactly as FLAG shows it. */
  status: string;
  /** The same thing in title case, for a heading. */
  label: string;
  kind: StatusKind;
  /** What the status means, in the plainest words that stay true. */
  summary: string;
  /** What has to happen next and who has to do it, or null when nobody acts. */
  action: string | null;
  /** The clock, when a rule sets one. */
  deadline: string | null;
  /** The rule the summary is drawn from. Null when DOL publishes none. */
  cite: { label: string; href: string } | null;
}

const CFR = (section: string) =>
  `https://www.ecfr.gov/current/title-20/chapter-V/part-656/section-${section}`;

const MEANINGS: Record<string, Omit<StatusMeaning, "status" | "label">> = {
  "ANALYST REVIEW": {
    kind: "queue",
    summary:
      "The ordinary queue. An analyst will work through it in filing order, and until they reach it nothing about the case changes. This is where the overwhelming majority of pending cases sit, and waiting is the whole of it.",
    action: null,
    deadline: null,
    // FLAG's own queue name rather than a regulatory term: 20 CFR 656.24
    // describes the determination, not the workflow state before it, so
    // pointing at a section for a definition it does not contain would be
    // the wrong kind of citation.
    cite: null,
  },
  "IN PROCESS": {
    kind: "queue",
    summary:
      "A pending state that sits alongside analyst review. DOL publishes no definition separating the two, and there are few enough cases in it that no pattern can be read off the data either.",
    action: null,
    deadline: null,
    cite: null,
  },
  "APPLICATION ON HOLD": {
    kind: "queue",
    summary:
      "The case is pending and has been set aside from the ordinary queue. DOL publishes no definition for this state, so what put a particular case into it is not something this page can tell you.",
    action:
      "The employer's attorney can ask DOL directly. Nothing on a public page will answer it.",
    deadline: null,
    cite: null,
  },
  "RFI ISSUED": {
    kind: "action",
    summary:
      "DOL has asked the employer for more information before it decides. The regulation lets the Certifying Officer request supplemental information or documentation at any point before a final determination.",
    action:
      "The employer has to answer. The letter itself sets the deadline, and missing it is how a case that was going to be certified gets denied instead.",
    deadline:
      "Whatever the letter says. The regulation sets no fixed window for this one, unlike an audit.",
    cite: { label: "20 CFR 656.20(d)(1)", href: CFR("656.20") },
  },
  "PENDING AUDIT RESPONSE": {
    kind: "action",
    summary:
      "The case was selected for audit, either because the review raised something or at random for quality control, and DOL is waiting on the documents.",
    action:
      "The employer has to send the documentation the audit letter lists. Missing the date does not just risk a denial, it counts as a refusal to exhaust administrative remedies, and that closes the door on a BALCA appeal.",
    deadline:
      "30 days from the date of the audit letter. The Certifying Officer may grant one extension of up to 30 more days, at their discretion.",
    cite: { label: "20 CFR 656.20(a)(2)", href: CFR("656.20") },
  },
  "SUPERVISED RECRUITMENT": {
    kind: "action",
    summary:
      "DOL has taken over the recruitment. The employer has to advertise again, where DOL tells it to, with wording DOL approves first, and applications go to the Certifying Officer rather than to the employer.",
    action:
      "The employer has to supply a draft advertisement to the Certifying Officer for approval.",
    deadline:
      "30 days from being notified that supervised recruitment is required.",
    cite: { label: "20 CFR 656.21(b)(1)", href: CFR("656.21") },
  },
  "NORD ISSUED": {
    kind: "action",
    summary:
      "DOL does not publish an expansion of this acronym or a definition of the state, so this page will not put one on it. What is measurable is that it is a pending state, and that it holds very few cases.",
    action:
      "The notice itself says what DOL wants and by when. The employer's attorney has it.",
    deadline: null,
    cite: null,
  },
  "DETERMINATION ISSUED": {
    kind: "queue",
    summary:
      "A decision has been issued on the case, and the live status has not yet settled to the outcome. DOL publishes no definition for this intermediate state.",
    action: null,
    deadline: null,
    cite: null,
  },
  "RECONSIDERATION APPEALS": {
    kind: "appeal",
    summary:
      "The case was denied and the employer asked the Certifying Officer to look again. Reconsideration is narrow on purpose: it can only rely on documents DOL already received, or documents that existed when the application was filed and were kept to support it.",
    action:
      "The Certifying Officer decides whether to reconsider, and may instead treat the request as an appeal to BALCA.",
    deadline:
      "The request had to be sent within 30 days of the denial being issued.",
    cite: { label: "20 CFR 656.24(g)", href: CFR("656.24") },
  },
  "REQUEST FOR REVIEW": {
    kind: "appeal",
    summary:
      "The employer has asked the Board of Alien Labor Certification Appeals to review a denial. BALCA reviews on the record: the evidence is what was already in front of the Certifying Officer, and the submissions are legal argument.",
    action: "BALCA decides. Nothing further is required from the employer.",
    deadline:
      "The request had to be sent within 30 days of the determination.",
    cite: { label: "20 CFR 656.26(a)", href: CFR("656.26") },
  },
  "BALCA APPEALS": {
    kind: "appeal",
    summary:
      "The case is with the Board of Alien Labor Certification Appeals. BALCA can affirm the denial, direct the Certifying Officer to grant the certification, or order a hearing.",
    action: "BALCA decides. All parties get 30 days to file a brief or decline to.",
    deadline: null,
    cite: { label: "20 CFR 656.27", href: CFR("656.27") },
  },
  "DENIED - BALCA DISMISSED": {
    kind: "appeal",
    summary:
      "A denied case whose appeal to BALCA was dismissed. One case in the whole mirror carries this status, so it is close to unique.",
    action: null,
    deadline: null,
    cite: { label: "20 CFR 656.27", href: CFR("656.27") },
  },
  CERTIFIED: {
    kind: "decided",
    summary:
      "DOL granted the labor certification. That is the end of the PERM stage. It is not a green card and it is not a petition: it is the document an employer files an I-140 with.",
    action:
      "The employer has to file the I-140 while the certification is still valid. A certification that is not filed in time expires and the whole PERM stage has to be done again.",
    deadline:
      "180 calendar days from the date DOL granted it, to file in support of a Form I-140.",
    cite: { label: "20 CFR 656.30(b)(1)", href: CFR("656.30") },
  },
  "CERTIFIED - EXPIRED": {
    kind: "decided",
    summary:
      "DOL granted the certification and the 180-day window to file an I-140 with it has passed. The regulation is explicit: a certification expires if it is not filed in support of an I-140 petition within 180 calendar days of the date DOL granted it.",
    action:
      "An expired certification usually means the I-140 was filed in time and DOL's status page simply moved on past the deadline, because DOL is not told when a petition is filed. If no I-140 was filed, the PERM stage has to start again. The employer's attorney knows which of the two happened; this page cannot.",
    deadline: null,
    cite: { label: "20 CFR 656.30(b)(1)", href: CFR("656.30") },
  },
  DENIED: {
    kind: "decided",
    summary:
      "The Certifying Officer refused the application. The denial letter states the grounds, and there are two routes on from it: reconsideration by the same officer, or review by BALCA.",
    action:
      "The employer can request reconsideration or ask BALCA to review. A fresh application is also an option and is often the faster one.",
    deadline:
      "30 days from the date the denial was issued, for either route.",
    cite: { label: "20 CFR 656.24(g), 656.26(a)", href: CFR("656.24") },
  },
  WITHDRAWN: {
    kind: "decided",
    summary:
      "The employer withdrew the application. DOL records no reason, so nothing here can say why. A withdrawal is not a denial and it does not count against anybody.",
    action: null,
    deadline: null,
    cite: null,
  },
};

/**
 * The decoded status, or null for one nothing has been written for.
 *
 * Null is a real answer and the caller renders it as one. The mirror's
 * distinct-status count went from 15 to 16 while the queue pages were being
 * built, so a table like this WILL be incomplete again, and a lookup that
 * quietly returned a wrong neighbour would be far worse than a page saying
 * plainly that it does not know this one.
 */
export function getStatusMeaning(status: string): StatusMeaning | null {
  const key = status.trim().toUpperCase();
  const m = MEANINGS[key];
  if (!m) return null;
  return { status: key, label: prettyStatus(key), ...m };
}

/** Every status this page can decode, for the glossary section. */
export function allStatusMeanings(): StatusMeaning[] {
  return Object.keys(MEANINGS).map((k) => getStatusMeaning(k)!);
}

/** How to word the fact that a status carries a clock. */
export const KIND_LABEL: Record<StatusKind, string> = {
  queue: "Waiting",
  action: "Something is due",
  appeal: "Under appeal",
  decided: "Decided",
};
