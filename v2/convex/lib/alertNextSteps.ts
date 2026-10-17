/**
 * What comes next, after a case alert: the step that follows the one DOL just
 * recorded, and the alert or page that helps with it.
 *
 * A green card is a chain of filings (the wage request, the PERM, the I-140,
 * the visa bulletin), and a subscriber hears from us about one link of it.
 * The email that says that link is done is the one place the next link is
 * worth naming, so the final alerts carry it and the confirmation pages offer
 * the next alert in the chain.
 *
 * ## Rules every line here follows
 *
 * - **Links go only to pages and alerts that exist.** Each path below is held
 *   to a page under src/app by `alertNextSteps.test.ts`.
 * - **No date is typed.** The I-140's last day comes from the central
 *   calculator (`calculateETA9089Expiration`, certification + 179, the date
 *   DOL prints), and the day it counts from is the day DOL's record changed,
 *   so the copy says "about" and points at the date on the certification.
 * - **A prevailing wage request is not always a PERM step.** `P-100` is a
 *   PERM job's wage; `P-200` to `P-203` are H-1B, H-1B1 and E-3 jobs', whose
 *   next filing is the LCA. Only `P-100` is told about the PERM.
 * - **Nothing here says a case will be approved or when.**
 *
 * @module convex/lib/alertNextSteps
 */

import { SITE_URL } from "./links";
import { longDate } from "./months";
import { EASTERN_TIMEZONE, easternDay, MS_PER_DAY } from "./time";
import { calculateETA9089Expiration } from "./perm/calculators/eta9089";
import type { FlagProgram } from "../../src/lib/flagCaseNumber";

export interface NextLink {
  /** Absolute https://permtracker.app URL. */
  href: string;
  /** Self-describing link text. */
  text: string;
}

export interface NextStep {
  /** A short label, sentence case: "The I-140". */
  title: string;
  /** One or two sentences. */
  body: string;
}

export interface NextSteps {
  steps: NextStep[];
  /** One onward alert worth a button, when there is one. */
  button: NextLink | null;
  links: NextLink[];
}

export interface NextStepInput {
  program: FlagProgram;
  caseNumber: string;
  /** Canonical status (`canonicalStatus`). */
  status: string;
  isFinal: boolean;
  /** `isProgramApproval(program, status)`. */
  approved: boolean;
  /** This case's PERM filing day on DOL's record, "YYYY-MM-DD". PERM only. */
  priorityDate?: string | null;
  /** The day DOL's record showed the certification, "YYYY-MM-DD". PERM only. */
  certifiedOn?: string | null;
  employerName?: string | null;
  jobTitle?: string | null;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The paths these emails link to, in one place so the route test can read
 * them. Anchors are part of the contract: `#bulletin-alert` and
 * `#queue-alert` are ids on the forms, `#step-by-step` the RFI page's
 * section.
 */
export const NEXT_PATHS = {
  bulletinAlert: "/visa-bulletin#bulletin-alert",
  queueAlert: "/tools/perm-timeline-calculator#queue-alert",
  greenCardLine: "/tools/green-card-line",
  uscisTimes: "/uscis-processing-times",
  denialGuide: "/guides/perm-denied-what-happens-next",
  appealGuide: "/guides/perm-appeal-reconsideration-balca",
  rfiSteps: "/perm-rfi-audit#step-by-step",
  deadlineTool: "/tools/perm-deadline-calculator",
  pwdValidity: "/tools/pwd-validity",
  lcaGuide: "/guides/what-an-lca-is",
  uscisLookup: "/uscis-case-status",
  pwdGuide: "/guides/track-a-prevailing-wage-request",
  caseLookup: "/perm-case-status",
  processingTimes: "/perm-processing-times",
  methodology: "/methodology",
} as const;

const at = (path: string) => `${SITE_URL}${path}`;

/** The visa bulletin's alert form, with the priority date shown beside it when we know it. */
export function bulletinAlertUrl(priorityDate?: string | null): string {
  const [path, hash] = NEXT_PATHS.bulletinAlert.split("#");
  const q = priorityDate && ISO_DAY.test(priorityDate) ? `?pd=${priorityDate}` : "";
  return `${SITE_URL}${path}${q}#${hash}`;
}

/**
 * A status first seen before this hour, Eastern, was decided the day before:
 * FLAG shows a new status the day DOL decides it and the morning sweep reads
 * it the next morning. Held equal to `SEEN_NEXT_MORNING_BEFORE_HOUR` in
 * src/lib/scorecard/score.ts by alertNextSteps.test.ts.
 */
export const SEEN_NEXT_MORNING_BEFORE_HOUR = 12;

const EASTERN_HOUR = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TIMEZONE, hour: "numeric", hourCycle: "h23" });

/**
 * The day DOL acted on a status we first saw at `seenMs`, "YYYY-MM-DD". In
 * the morning that's the day before, so a deadline counted from it can only
 * come out early, never late.
 */
export function dayDolActed(seenMs: number): string {
  const day = easternDay(seenMs);
  if (Number(EASTERN_HOUR.format(seenMs)) >= SEEN_NEXT_MORNING_BEFORE_HOUR) return day;
  return new Date(Date.parse(`${day}T12:00:00Z`) - MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * The PERM filing day on DOL's record, "YYYY-MM-DD": DOL's own submitted
 * time (UTC) as an Eastern day, else the day the case number encodes.
 */
export function filingDayOnRecord(submitted: string | null | undefined, filingDate: string | null | undefined): string | null {
  const t = submitted ? Date.parse(submitted) : Number.NaN;
  if (Number.isFinite(t)) return easternDay(t);
  return filingDate && ISO_DAY.test(filingDate.slice(0, 10)) ? filingDate.slice(0, 10) : null;
}

/** The I-140's last day for a certification on `certifiedOn`, or null. */
export function i140DueBy(certifiedOn: string | null | undefined): string | null {
  if (!certifiedOn || !ISO_DAY.test(certifiedOn)) return null;
  const due = calculateETA9089Expiration(new Date(`${certifiedOn}T00:00:00Z`));
  return Number.isNaN(due.getTime()) ? null : due.toISOString().slice(0, 10);
}

/** A PERM job's prevailing wage request (ETA-9141 for a green card), not an H-1B or E-3 one. */
export function isPermWageRequest(caseNumber: string): boolean {
  return /^P-100-/i.test(caseNumber.trim());
}

const LCA_VISA: Record<string, string> = {
  "I-200": "H-1B",
  "I-201": "H-1B1",
  "I-202": "H-1B1",
  "I-203": "E-3",
};

function permCertified(input: NextStepInput): NextSteps {
  const due = i140DueBy(input.certifiedOn);
  const pd = input.priorityDate && ISO_DAY.test(input.priorityDate) ? input.priorityDate : null;
  return {
    steps: [
      {
        title: "The I-140",
        body: due
          ? `The employer files it with USCIS. Going by the day DOL's record changed, the 180 days run to about ${longDate(due)}; the exact last day is the expiration DOL printed on the certification.`
          : "The employer files it with USCIS. The exact last day is the expiration DOL printed on the certification.",
      },
      {
        title: "Your priority date",
        body: pd
          ? `It's this case's PERM filing date, ${longDate(pd)}, on DOL's record, and the I-140 carries it. The visa bulletin decides when it can be used.`
          : "It's this case's PERM filing date, and the I-140 carries it. The visa bulletin decides when it can be used.",
      },
    ],
    button: { href: bulletinAlertUrl(pd), text: "Email me when the bulletin moves" },
    links: [
      { href: at(NEXT_PATHS.greenCardLine), text: "How many people stand ahead of your date" },
      { href: at(NEXT_PATHS.uscisTimes), text: "How long USCIS is taking with the I-140, from its own figures" },
    ],
  };
}

function permDenied(status: string): NextSteps {
  if (status === "DENIED") {
    return {
      steps: [
        {
          title: "The employer's options",
          body: "It has 30 days from the denial to ask the officer to reconsider it, or to ask for review by DOL's appeals board. The guides below cover both.",
        },
        {
          title: "We're still watching",
          body: "If the employer asks, DOL's record moves to RECONSIDERATION APPEALS or BALCA APPEALS. We watch this case for a year after the decision and will email you when it moves.",
        },
      ],
      button: null,
      links: [
        { href: at(NEXT_PATHS.denialGuide), text: "What a denial means, and the options after one" },
        { href: at(NEXT_PATHS.appealGuide), text: "How reconsideration and the appeals board work" },
      ],
    };
  }
  // The Board's decision (DENIED - BALCA AFFIRMED, DENIED - BALCA DISMISSED).
  return {
    steps: [
      {
        title: "The end of DOL's review",
        body: "The appeals board's decision is the last step at DOL. The guide below covers what an employer can do after it, filing again included.",
      },
    ],
    button: null,
    links: [{ href: at(NEXT_PATHS.denialGuide), text: "What a denial means, and the options after one" }],
  };
}

function pwdIssued(input: NextStepInput): NextSteps {
  if (!isPermWageRequest(input.caseNumber)) {
    return {
      steps: [
        {
          title: "The LCA",
          body: "This wage is for an H-1B, H-1B1 or E-3 job, so the next filing is usually the LCA, where the employer can use it as the prevailing wage.",
        },
      ],
      button: null,
      links: [{ href: at(NEXT_PATHS.lcaGuide), text: "What an LCA is, and how to look one up" }],
    };
  }
  const who =
    input.employerName && input.jobTitle
      ? `If DOL's record shows a PERM application from ${input.employerName} for ${input.jobTitle}, we'll email you its case number.`
      : "If DOL's record shows a PERM application from the same employer for the same job, we'll email you its case number.";
  return {
    steps: [
      {
        title: "Recruitment, then the PERM application",
        body: "The employer has to start recruitment, or file the PERM application (the ETA-9089), while this wage is still valid. The PERM's filing date becomes your priority date.",
      },
      {
        title: "We'll watch for the PERM",
        body: `${who} DOL's record doesn't name the worker, so we'll say it may be yours.`,
      },
    ],
    button: null,
    links: [
      { href: at(NEXT_PATHS.deadlineTool), text: "Work out the recruitment and filing dates from this wage" },
      { href: at(NEXT_PATHS.pwdValidity), text: "When this wage expires" },
      { href: at(NEXT_PATHS.queueAlert), text: "Once the PERM is filed, an email when DOL's queue reaches its month" },
    ],
  };
}

function lcaCertified(caseNumber: string): NextSteps {
  const visa = LCA_VISA[caseNumber.trim().toUpperCase().slice(0, 5)] ?? "H-1B";
  const first: NextStep =
    visa === "H-1B"
      ? {
          title: "The H-1B petition",
          body: "The employer files it with USCIS on Form I-129, with this certified LCA. USCIS then sends a receipt number; our USCIS page reads what that number encodes and links to USCIS's own status page, but it can't show the status itself yet.",
        }
      : {
          title: `The ${visa} visa`,
          body: "The certified LCA goes with the visa request: a petition to USCIS on Form I-129, or an application at a U.S. consulate abroad.",
        };
  return {
    steps: [
      first,
      {
        title: "If a green card comes later",
        body: "Its first DOL step is a prevailing wage request, and you can watch that one here too, by its P- number.",
      },
    ],
    button: null,
    links: [
      { href: at(NEXT_PATHS.uscisLookup), text: "Look up a USCIS receipt number" },
      { href: at(NEXT_PATHS.pwdGuide), text: "How to watch a prevailing wage request by its number" },
    ],
  };
}

/**
 * The next step after a final status, or null when there is nothing honest to
 * add (a withdrawal, an expiry, a seasonal filing, any status still pending).
 */
export function nextStepsFor(input: NextStepInput): NextSteps | null {
  if (!input.isFinal) return null;
  const status = input.status.trim().toUpperCase();
  if (input.program === "perm") {
    if (status === "CERTIFIED") return permCertified(input);
    if (status.startsWith("DENIED")) return permDenied(status);
    return null;
  }
  if (input.program === "pwd" && input.approved) return pwdIssued(input);
  if (input.program === "lca" && status === "CERTIFIED") return lcaCertified(input.caseNumber);
  return null;
}

/**
 * The "Also on PERM Tracker" links, after the employer's own page (which the
 * template adds when it shows the employer's record). DOL's PERM queue is
 * named only to someone still waiting in it: a decided case, an LCA or a
 * seasonal filing has nothing to read there.
 */
export function alsoLinksFor(input: Pick<NextStepInput, "program" | "status" | "isFinal">): NextLink[] {
  const status = input.status.trim().toUpperCase();
  const out: NextLink[] = [];
  if (input.program === "perm" && status === "RFI ISSUED") {
    out.push({ href: at(NEXT_PATHS.rfiSteps), text: "What happens after an RFI, step by step, from the ones we've followed" });
  }
  if (!input.isFinal && input.program === "perm") {
    out.push({ href: at(NEXT_PATHS.processingTimes), text: "The filing month DOL's queue has reached" });
  }
  if (!input.isFinal && input.program === "pwd") {
    out.push({ href: at(NEXT_PATHS.processingTimes), text: "The month DOL's wage-request queue has reached" });
  }
  out.push({ href: at(NEXT_PATHS.methodology), text: "Where every figure in this email comes from" });
  return out;
}

/** The plain-text part's lines for a next-steps block. */
export function nextStepsText(next: NextSteps | null): string[] {
  if (!next) return [];
  return [
    "What comes next:",
    ...next.steps.map((s) => `  ${s.title}. ${s.body}`),
    ...(next.button ? [`  ${next.button.text}: ${next.button.href}`] : []),
    ...next.links.map((l) => `  ${l.text}: ${l.href}`),
    "",
  ];
}

// ============================================================================
// The confirmation pages: the next alert in the chain
// ============================================================================

export interface ConfirmOffer {
  href: string;
  /** The link text. */
  label: string;
  /** One sentence under it. */
  detail: string;
}

const QUEUE_OFFER: ConfirmOffer = {
  href: at(NEXT_PATHS.queueAlert),
  label: "An email when DOL's queue reaches a filing month",
  detail: "One email, the day DOL's analyst-review queue gets to the month a PERM was filed.",
};

const CASE_OFFER: ConfirmOffer = {
  href: at(NEXT_PATHS.caseLookup),
  label: "Alerts on the case itself, by its case number",
  detail: "Look the case up, then choose Email me changes. Every move DOL records, as it happens.",
};

const BULLETIN_OFFER: ConfirmOffer = {
  href: `${SITE_URL}${NEXT_PATHS.bulletinAlert}`,
  label: "After the PERM is certified, an email when the visa bulletin moves",
  detail: "When a new bulletin changes the cutoff for your category and country, and not otherwise.",
};

/**
 * What a confirmation page offers next. Links only: turning anything on still
 * goes through its own form and its own confirmation email.
 */
export function confirmOffers(
  kind: "case" | "queue" | "bulletin" | "employer",
  caseNumbers: readonly string[] = [],
  programOf?: (caseNumber: string) => FlagProgram,
): ConfirmOffer[] {
  if (kind === "queue") return [CASE_OFFER, BULLETIN_OFFER];
  if (kind === "employer") return [CASE_OFFER];
  if (kind === "bulletin") return [];
  const programs = new Set(caseNumbers.map((n) => (programOf ? programOf(n) : "perm")));
  const offers: ConfirmOffer[] = [];
  if (programs.has("perm")) offers.push(QUEUE_OFFER);
  if (caseNumbers.some(isPermWageRequest)) {
    offers.push({
      ...QUEUE_OFFER,
      label: "Once the PERM is filed, an email when DOL's queue reaches its month",
    });
  }
  // One link per destination, whichever program asked for it first.
  return offers.filter((o, i) => offers.findIndex((p) => p.href === o.href) === i);
}

/** The sentence a wage-request confirmation adds about the PERM it watches for. */
export const PWD_MATCH_SENTENCE =
  "When DOL issues the wage for a PERM job, we'll also look for the PERM application that follows it, and email you if one from the same employer for the same job shows up.";
