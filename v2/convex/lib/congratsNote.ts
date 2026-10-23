/**
 * The congratulations note: a personal email from the founder, two business days after DOL decides a watched
 * case well, asking three questions (owner's call, Oct 22 2026; the three texts are the ones he approved).
 *
 * Only the record and the words live here. The note is sent by hand from the press mailbox (Zoho) after a
 * person reads it: Zoho's usage policy (Oct 13 2026) bars "Automated Emails" from Zoho Mail, so nothing here
 * sends anything (convex/congratsNotes.ts keeps the list, a script on the owner's Mac sends).
 *
 * Who gets one: someone who was watching the case before DOL decided it, and whom our alert told. A row first
 * seen already decided gets `decidedAt` without an email (`markDecided`), so `lastAlertSentAt === decidedAt`
 * is exactly "the alert we sent was the decision": `recordAlert` writes both in one patch.
 */

import { addBusinessDays } from "./perm/dates/businessDays";
import { easternDay } from "./time";
import { isApproval } from "../../src/lib/caseStatusVocabulary";
import { isProgramApproval, programOf } from "../../src/lib/flagCaseNumber";
import { isPermWageRequest } from "./alertNextSteps";

/** The three notes, one per program that ends in something to congratulate. */
export type NoteProgram = "perm" | "lca" | "pwd";

/**
 * Decisions from this moment on get a note: midnight Eastern, Saturday Oct 17 2026. Everyone our alerts told
 * before then had a note by hand (the rounds of Oct 6 and Oct 21 to 22, alerts through Oct 16).
 */
export const NOTES_FROM_MS = Date.parse("2026-10-17T04:00:00Z");
/** Business days after the decision alert that the note is due. */
export const DUE_AFTER_BUSINESS_DAYS = 2;
/** A note more than this many business days past its day isn't sent: by then it reads stale. */
export const LATE_AFTER_BUSINESS_DAYS = 5;
/** Decisions this far back are looked at; anything older is past its day anyway. */
export const LOOK_BACK_MS = 21 * 24 * 60 * 60 * 1000;

export const NOTE_SUBJECT = "Congrats, and a quick question";

/** The approved wording for each program (Oct 22 2026); `things` and `verb` serve a note about several cases. */
const WORDS: Record<
  NoteProgram,
  { thing: string; things: string; done: string; verb: string; next: string; help: string }
> = {
  perm: {
    thing: "your PERM case",
    things: "your PERM cases",
    done: "DOL has certified it",
    verb: "certified",
    next:
      "Next comes the I-140. If you want a heads-up on the green card line, you can get an email whenever your " +
      "visa bulletin cutoff moves: pick your category and country at permtracker.app/visa-bulletin.",
    help: "the I-140, the I-485, priority date alerts, or something else?",
  },
  lca: {
    thing: "your H-1B LCA",
    things: "your H-1B LCAs",
    done: "DOL has certified it",
    verb: "certified",
    next:
      "Next comes the H-1B petition. Checking a petition's status by its receipt number is built and waiting on " +
      "USCIS to approve our access, and I'll let you know when it's live.",
    help: "the H-1B petition, a green card case later on, or something else?",
  },
  pwd: {
    thing: "your prevailing wage request",
    things: "your prevailing wage requests",
    done: "DOL has issued the determination",
    verb: "issued determinations on",
    next:
      "Next comes the PERM filing. Once it's filed, look up the case number on permtracker.app and turn on " +
      "alerts. If your lawyer doesn't share the number, permtracker.app/case-search finds it by employer, job " +
      "title and the month it was filed.",
    help: "the PERM filing, recruitment deadlines, or something else?",
  },
};

/**
 * Which note a decided case earns, or null when it earns none.
 *
 * PERM: CERTIFIED only (never "CERTIFIED - EXPIRED", a clock running out). An LCA: certified, and an H-1B one
 * (`I-200`), because the note's next step is the H-1B petition; H-1B1 and E-3 LCAs lead elsewhere. A wage
 * request: a PERM job's (`P-100`), issued or upheld, because its next step is the PERM filing. Nothing else:
 * no denial, withdrawal or seasonal case.
 */
export function noteProgram(caseNumber: string, status: string | undefined): NoteProgram | null {
  if (!status) return null;
  const program = programOf(caseNumber);
  if (program === "perm") return isApproval(status) ? "perm" : null;
  if (program === "lca") return /^I-200-/i.test(caseNumber.trim()) && isProgramApproval("lca", status) ? "lca" : null;
  if (program === "pwd") return isPermWageRequest(caseNumber) && isProgramApproval("pwd", status) ? "pwd" : null;
  return null;
}

/** The fields of a case alert this needs. */
export interface WatchedCase {
  caseNumber: string;
  lastSeenStatus?: string;
  confirmedAt?: number;
  decidedAt?: number;
  lastAlertSentAt?: number;
  unsubscribedAt?: number;
}

/** Was this person watching before DOL decided, and did our alert tell them, inside the window? */
export function earnsNote(row: WatchedCase, now: number): NoteProgram | null {
  const { decidedAt, confirmedAt } = row;
  if (decidedAt === undefined || confirmedAt === undefined) return null;
  if (row.unsubscribedAt !== undefined) return null;
  if (decidedAt < NOTES_FROM_MS || decidedAt < now - LOOK_BACK_MS) return null;
  if (confirmedAt >= decidedAt) return null;
  if (row.lastAlertSentAt !== decidedAt) return null;
  return noteProgram(row.caseNumber, row.lastSeenStatus);
}

/** The Eastern day the note is due: two business days after the day our alert went. */
export function dueOn(decidedAt: number): string {
  return addBusinessDays(easternDay(decidedAt), DUE_AFTER_BUSINESS_DAYS);
}

/** Past this Eastern day the note is too late to send. */
export function lateAfter(due: string): string {
  return addBusinessDays(due, LATE_AFTER_BUSINESS_DAYS);
}

/** The note, plain text, the case named by its number. */
export function composeNote(program: NoteProgram, caseNumber: string): { subject: string; body: string } {
  return composeNotes([{ program, caseNumber }]);
}

/** One case of a note. */
export interface NoteCase {
  program: NoteProgram;
  caseNumber: string;
}

const PROGRAM_ORDER: NoteProgram[] = ["perm", "lca", "pwd"];

/** "A", "A and B", "A, B and C". */
function listed(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * One note for every case a person is owed one for (owner's call, Oct 23 2026: "if theres multiple they should be
 * in same email"). One case reads exactly as approved; several are named in one sentence, grouped by program, with
 * each program's next step once and the first program's question.
 */
export function composeNotes(cases: NoteCase[]): { subject: string; body: string } {
  const programs = PROGRAM_ORDER.filter((p) => cases.some((c) => c.program === p));
  const first = WORDS[programs[0] ?? "perm"];
  let line: string;
  if (cases.length === 1) {
    const c = cases[0]!;
    const w = WORDS[c.program];
    line = `You signed up for alerts on ${w.thing}, ${c.caseNumber}, and ${w.done}, so congratulations!`;
  } else {
    const groups = programs.map((p) => {
      const numbers = cases.filter((c) => c.program === p).map((c) => c.caseNumber);
      return `${numbers.length === 1 ? WORDS[p].thing : WORDS[p].things}, ${listed(numbers)},`;
    });
    const verbs = [...new Set(programs.map((p) => WORDS[p].verb))];
    const count = cases.length === 2 ? "both" : "all of them";
    const done = verbs.length === 1 ? `DOL has ${verbs[0]} ${count}` : `DOL has decided ${count} in your favor`;
    // Each group ends in a comma, so a case number stands apart from the "and" that follows it.
    line = `You signed up for alerts on ${groups.join(" and ").replace(/,$/, "")}, and ${done}, so congratulations!`;
  }
  const body =
    `Hi,\n\n` +
    `I'm Adam, and I build PERM Tracker. ${line}\n\n` +
    `${programs.map((p) => WORDS[p].next).join("\n\n")}\n\n` +
    `Three quick questions, if you have a minute:\n` +
    `1. How did you find PERM Tracker?\n` +
    `2. Did our email reach you before you heard from your lawyer or employer?\n` +
    `3. What would help you next: ${first.help}\n\n` +
    `Anything else you'd change, tell me. One line is plenty. And if you'd rather I didn't write again, just say so.\n\n` +
    `Adam Ali\nPERM Tracker\n`;
  return { subject: NOTE_SUBJECT, body };
}
