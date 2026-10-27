/**
 * A rule's way through review and the Federal Register, in words and steps.
 *
 * The facts are `scripts/ingest_rule_pipeline.py`'s: the Unified Agenda's
 * listing with the agency's own timetable, OIRA's review dates and decision
 * as OIRA prints them, the public inspection filing, and the Register's own
 * record of the proposal and the final rule. Nothing here is an estimate: a
 * step either has a date from one of those records or it hasn't happened yet
 * (or happened before the record began, which is said). The agenda's
 * timetable is the agency's, quoted as the agency's: "lists ... for", never a
 * date this site expects.
 *
 * Pure and shared: the policy page draws the track from `buildTrack`, and the
 * weekly digest and the page both word a step with `stepSentence`.
 */
import { monthYear, shortDate } from "./months";
import { daysBetween } from "./time";

export type RuleStepKind =
  | "agenda"
  | "oira-received"
  | "oira-completed"
  | "public-inspection"
  | "proposed-published"
  | "final-published";

/**
 * The steps the weekly digest and the page's step list read. The agenda's
 * listing is a step of its own (`AGENDA_KIND`) and is left out here on
 * purpose: a new edition relists dozens of rules on one day, and one line per
 * rule would bury the week's real moves. A reader of agenda steps asks for
 * AGENDA_KIND by name.
 */
export const RULE_STEP_KINDS: readonly RuleStepKind[] = [
  "oira-received",
  "oira-completed",
  "public-inspection",
  "proposed-published",
  "final-published",
];

export const AGENDA_KIND = "agenda" satisfies RuleStepKind;

/** One rule as `rule_pipeline` holds it. Every fact may be missing. */
export interface RuleRecord {
  rin: string;
  agency: string | null;
  title: string | null;
  /** OIRA's review of the proposal (or of a notice or prerule). */
  pStage: string | null;
  pReceived: string | null;
  pCompleted: string | null;
  pDecision: string | null;
  /** OIRA's review of the final rule, kept apart from the proposal's. */
  fStage: string | null;
  fReceived: string | null;
  fCompleted: string | null;
  fDecision: string | null;
  /** "Yes" when OIRA marks the rule major. */
  major: string | null;
  piDocument: string | null;
  piType: string | null;
  piFiled: string | null;
  piScheduled: string | null;
  piUrl: string | null;
  proposedDocument: string | null;
  proposedPublished: string | null;
  proposedUrl: string | null;
  proposedCitation: string | null;
  commentsClose: string | null;
  finalDocument: string | null;
  finalPublished: string | null;
  finalUrl: string | null;
  finalCitation: string | null;
  effectiveOn: string | null;
  /**
   * The Unified Agenda's listing, as the newest edition that lists the rule
   * printed it. Optional: a record read before the agenda was has none.
   */
  /** reginfo's id for the edition, "202510". */
  aPubId?: string | null;
  /** The edition as reginfo names it: "2026", "Spring 2025". */
  aEdition?: string | null;
  /** The edition's date. */
  aPublished?: string | null;
  /** As printed: "DOL/ETA". */
  aAgency?: string | null;
  /** As printed: "Proposed Rule Stage". */
  aStage?: string | null;
  aPriority?: string | null;
  /** The timetable's next action and its date, as printed: "NPRM", "07/00/2026", "To Be Determined". */
  aNextAction?: string | null;
  aNextDate?: string | null;
  aAbstract?: string | null;
  /** The rule's entry in that edition. */
  aUrl?: string | null;
  /** The edition date of the newest listing that changed: the first, or a new next action or date. */
  aListed?: string | null;
  /** False when a newer edition the record holds doesn't list the rule. */
  aOnCurrent?: boolean;
}

export interface RuleStepEvent {
  rin: string;
  kind: RuleStepKind;
  onDate: string;
  /** The OIRA stage, OIRA's decision, the inspection filing's type, or a document number. */
  detail: string | null;
}

/**
 * - done: dated, on or before today
 * - upcoming: dated, after today (a comment deadline, an effective date)
 * - unrecorded: no date, though a later step has one (it happened before this record began, or wasn't public)
 * - next: the first step still ahead
 * - ahead: a later step still ahead
 */
export type TrackState = "done" | "upcoming" | "unrecorded" | "next" | "ahead";

export interface TrackStep {
  key: "agenda" | "review" | "cleared" | "inspection" | "published" | "comments" | "final";
  label: string;
  date: string | null;
  /** Shown in place of the date: the agenda step names its edition, not a day. */
  shown?: string | null;
  state: TrackState;
  note: string | null;
}

const day = (iso: string | null | undefined): string => shortDate(iso) ?? String(iso ?? "");

/** OIRA appends a stage tag to some titles ("... Program (NPRM)"); the step says the stage already. */
export function ruleTitle(r: { title: string | null; rin: string }): string {
  const t = (r.title ?? "").replace(/\s*\((?:NPRM|ANPRM|SNPRM|IFR|Final Rule|Proposed Rule|Interim Final Rule)\)\s*$/i, "").trim();
  return t || `RIN ${r.rin}`;
}

export function reginfoUrl(rin: string): string {
  return `https://www.reginfo.gov/public/do/eAgendaViewRule?RIN=${encodeURIComponent(rin)}`;
}

/** A rule this record meets first in its final form: no proposal and no review of one. */
export function isFinalOnly(r: RuleRecord): boolean {
  return !r.pReceived && !r.proposedPublished && Boolean(r.fReceived || r.finalPublished || r.piType === "Rule");
}

function withdrawn(decision: string | null): boolean {
  return /^withdrawn/i.test(decision ?? "");
}

// ---------------------------------------------------------------------------
// The Unified Agenda
// ---------------------------------------------------------------------------

const ACTIVE_STAGES = new Set(["Prerule Stage", "Proposed Rule Stage", "Final Rule Stage"]);
const UNDETERMINED = /^next action undetermined$/i;

/** Whose agenda it is, by the RIN's agency code, the way a reader names them. */
export function agendaOwner(rin: string): string {
  const code = rin.slice(0, 4);
  if (code === "1615") return "USCIS";
  if (code === "1205" || code === "1235") return "DOL";
  if (code === "1400") return "the State Department";
  if (code === "1651") return "CBP";
  if (code === "1653") return "ICE";
  return "DHS";
}

const possessive = (who: string): string => `${who}'s`;
const capital = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** The agenda says the rule is still on its way (Python's `agenda_active`). */
export function agendaActive(r: Pick<RuleRecord, "aStage" | "aNextAction">): boolean {
  const stage = r.aStage ?? "";
  const action = r.aNextAction ?? "";
  return ACTIVE_STAGES.has(stage) || (stage === "Long-Term Actions" && action !== "" && !UNDETERMINED.test(action));
}

/** The printed action in a reader's words ("the proposal"), or null for one this doesn't know. */
function actionWords(action: string): string | null {
  const a = action.trim();
  if (/^(?:nprm|proposed rule)$/i.test(a)) return "the proposal";
  if (/^anprm$/i.test(a)) return "an advance notice of proposed rulemaking";
  if (/^(?:snprm|supplemental (?:nprm|proposed rule))$/i.test(a)) return "a supplemental proposal";
  if (/^final (?:rule|action)$/i.test(a)) return "the final rule";
  if (/^interim final (?:rule|action)$/i.test(a)) return "an interim final rule";
  if (/^temporary final (?:rule|action)$/i.test(a)) return "a temporary final rule";
  if (/^direct final (?:rule|action)$/i.test(a)) return "a direct final rule";
  return null;
}

/** The printed date in a reader's words, or null when it's to be determined. */
function dateWords(date: string): string | null {
  const d = date.trim();
  if (/^to be determined$/i.test(d)) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return `"${d}"`;
  if (m[2] === "00") return monthYear(`${m[3]}-${m[1]}`) ?? `"${d}"`;
  return shortDate(`${m[3]}-${m[1]}-${m[2]}`) ?? `"${d}"`;
}

/** "at the final rule stage", "among its long-term actions" */
function stageWords(stage: string | null): string {
  const s = (stage ?? "").trim();
  if (/^long-term actions$/i.test(s)) return "among its long-term actions";
  if (/^completed actions$/i.test(s)) return "as completed";
  return s ? `at the ${s.toLowerCase()}` : "with no stage";
}

interface Listing {
  edition: string | null;
  stage: string | null;
  action: string | null;
  date: string | null;
}

/**
 * What a listing says, after "lists". With no title: "the proposal for July
 * 2026". With a title (already quoted): `the proposal "X" for July 2026`.
 * Every action and date is the agency's, in words; an action this doesn't
 * know is quoted as printed.
 */
function listingWords(l: Listing, title: string | null): string {
  const named = title ?? "it";
  if (!l.action) return `${named} ${stageWords(l.stage)}, with no next action`;
  if (UNDETERMINED.test(l.action)) return title ? `${title} with its next action undetermined` : "its next action as undetermined";
  const when = l.date ? dateWords(l.date) : null;
  const tail = when ? ` for ${when}` : ", with the date to be determined";
  const known = actionWords(l.action);
  if (known) return `${known}${title ? ` ${title}` : ""}${tail}`;
  const quoted = `its next action, "${l.action.trim()}",`;
  return `${title ? `${title} with ` : ""}${quoted}${when ? ` for ${when}` : " with the date to be determined"}`;
}

/** The listing on the record, if any. */
function listingOf(r: Pick<RuleRecord, "aEdition" | "aStage" | "aNextAction" | "aNextDate">): Listing {
  return { edition: r.aEdition ?? null, stage: r.aStage ?? null, action: r.aNextAction ?? null, date: r.aNextDate ?? null };
}

/**
 * The agenda step's note: "DOL's 2026 agenda lists the proposal for July
 * 2026". Past tense, with the newest agenda named, when a newer edition the
 * record holds doesn't list the rule. Null with no listing.
 */
export function agendaNote(r: RuleRecord): string | null {
  if (!r.aEdition) return null;
  const who = possessive(agendaOwner(r.rin));
  const what = listingWords(listingOf(r), null);
  if (r.aOnCurrent === false) return `${capital(who)} ${r.aEdition} agenda listed ${what}. The newest agenda doesn't list it`;
  return `${capital(who)} ${r.aEdition} agenda lists ${what}`;
}

/** A rule the record knows only from the agenda: nothing reviewed, filed or published yet. */
export function isAgendaOnly(r: RuleRecord): boolean {
  return Boolean(r.aEdition) && !r.pReceived && !r.pCompleted && !r.fReceived && !r.fCompleted && !r.piFiled
    && !r.proposedPublished && !r.finalPublished;
}

/** The sort key of the printed next date: "2026-07-00", and to be determined last. */
export function agendaDateKey(r: Pick<RuleRecord, "aNextDate">): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((r.aNextDate ?? "").trim());
  return m ? `${m[3]}-${m[1]}-${m[2]}` : "9999";
}

/**
 * Whether the page shows a rule: one not yet final, final within
 * `finalShownDays`, or final long ago with the newest agenda, dated after its
 * final rule, still listing it on its way (an interim final rule awaiting its
 * final). A rule only the agenda knows is shown while the newest agenda lists it.
 */
export function shownInPipeline(r: RuleRecord, today: string, finalShownDays: number): boolean {
  if (isAgendaOnly(r)) return r.aOnCurrent !== false;
  if (!r.finalPublished) return true;
  if (daysBetween(r.finalPublished, today) <= finalShownDays) return true;
  return r.aOnCurrent !== false && agendaActive(r) && Boolean(r.aPublished) && (r.aPublished ?? "") > r.finalPublished;
}

/** How long a rule's newest step keeps it among the full cards. */
export const ACTIVE_DAYS = 90;

/**
 * A rule with something under way: at OIRA now, on public inspection and not
 * yet published, open for comment, a final rule not yet in effect, or a step
 * OIRA or the Register dated in the last ACTIVE_DAYS. The agenda's listing
 * doesn't count: an edition relists rules when nothing has happened to them.
 */
export function isActiveRule(r: RuleRecord, today: string): boolean {
  if ((r.pReceived && !r.pCompleted) || (r.fReceived && !r.fCompleted)) return true;
  if (r.piFiled) {
    const publishedSince = r.piType === "Rule" ? r.finalPublished : r.proposedPublished || r.finalPublished;
    if (!publishedSince) return true;
  }
  if (r.commentsClose && r.commentsClose >= today && !r.finalPublished) return true;
  if (r.effectiveOn && r.effectiveOn > today) return true;
  const steps = [r.pReceived, r.pCompleted, r.fReceived, r.fCompleted, r.piFiled, r.proposedPublished, r.finalPublished]
    .filter((d): d is string => Boolean(d));
  return steps.some((d) => d <= today && daysBetween(d, today) <= ACTIVE_DAYS);
}

/** The seven steps, each with its date or what's known about it. */
export function buildTrack(r: RuleRecord, today: string): TrackStep[] {
  const finalOnly = isFinalOnly(r);
  const received = finalOnly ? r.fReceived : r.pReceived;
  const stage = finalOnly ? r.fStage : r.pStage;
  const completed = finalOnly ? r.fCompleted : r.pCompleted;
  const decision = finalOnly ? r.fDecision : r.pDecision;
  const piForPhase = finalOnly ? r.piType === "Rule" : r.piType !== "Rule";
  const piFiled = piForPhase ? r.piFiled : null;
  const published = finalOnly ? r.finalPublished : r.proposedPublished;

  let finalNote: string | null = null;
  if (!finalOnly) {
    if (r.finalPublished && r.effectiveOn) {
      finalNote = r.effectiveOn > today ? `Takes effect ${day(r.effectiveOn)}` : `In effect since ${day(r.effectiveOn)}`;
    } else if (!r.finalPublished && r.fCompleted) {
      finalNote = `OIRA finished its review of the final rule ${day(r.fCompleted)}: "${r.fDecision ?? "no decision printed"}"`;
    } else if (!r.finalPublished && r.fReceived) {
      finalNote = `The final rule has been at OIRA since ${day(r.fReceived)}`;
    } else if (!r.finalPublished && r.piType === "Rule" && r.piFiled) {
      finalNote = `The final rule went on public inspection ${day(r.piFiled)}`;
    }
  }

  const raw: Omit<TrackStep, "state">[] = [
    {
      key: "agenda",
      label: "Listed in the Unified Agenda",
      // The edition's date decides the step's state; the step names the edition.
      date: r.aEdition ? (r.aPublished ?? null) : null,
      shown: r.aEdition ? `${r.aEdition} agenda` : null,
      note: agendaNote(r),
    },
    {
      key: "review",
      label: "In review at OIRA",
      date: received,
      note: stage ? `Sent as a ${stage.toLowerCase()}` : null,
    },
    {
      key: "cleared",
      label: withdrawn(decision) ? "Withdrawn from review" : "Review done",
      date: completed,
      note: decision ? `OIRA's decision: "${decision}"` : null,
    },
    {
      key: "inspection",
      label: "On public inspection",
      date: piFiled,
      note: piFiled && r.piScheduled ? `To be published ${day(r.piScheduled)}` : null,
    },
    {
      key: "published",
      label: finalOnly ? "Published as a final rule" : "Published",
      date: published,
      note: (finalOnly ? r.finalCitation : r.proposedCitation) ?? null,
    },
    {
      key: "comments",
      label: "Comments close",
      date: finalOnly ? null : r.commentsClose,
      note:
        !finalOnly && r.commentsClose && r.commentsClose >= today
          ? `${daysBetween(today, r.commentsClose)} ${daysBetween(today, r.commentsClose) === 1 ? "day" : "days"} left`
          : finalOnly
            ? "None on record for a rule published final"
            : null,
    },
    finalOnly
      ? { key: "final", label: "Takes effect", date: r.effectiveOn, note: null }
      : { key: "final", label: "Final rule", date: r.finalPublished, note: finalNote },
  ];

  // The last step with a date marks what the record has reached; an undated
  // step before it happened unrecorded, and the first undated one after is next.
  let last = -1;
  raw.forEach((s, i) => {
    if (s.date && s.date <= today) last = i;
  });
  // A rule withdrawn from review goes no further.
  const stopped = withdrawn(decision) && Boolean(completed) && !published;
  let nextGiven = stopped;
  return raw.map((s, i): TrackStep => {
    if (s.date) return { ...s, state: s.date <= today ? "done" : "upcoming" };
    if (i < last) return { ...s, state: "unrecorded" };
    if (s.key === "comments" && finalOnly) return { ...s, state: "unrecorded" };
    if (!nextGiven) {
      nextGiven = true;
      return { ...s, state: "next" };
    }
    return { ...s, state: "ahead" };
  });
}

/** Where a rule stands, in one or two sentences. */
export function standing(r: RuleRecord, today: string): string {
  if (r.finalPublished) {
    const done = r.effectiveOn && r.effectiveOn > today
      ? `Final rule published ${day(r.finalPublished)}; it takes effect ${day(r.effectiveOn)}.`
      : `Final rule published ${day(r.finalPublished)}${r.effectiveOn ? `, in effect since ${day(r.effectiveOn)}` : ""}.`;
    // An interim final rule is final in the Register; an agenda dated after it
    // that still lists a step says the rule isn't finished.
    const still = r.aOnCurrent !== false && agendaActive(r) && r.aNextAction && (r.aPublished ?? "") > r.finalPublished;
    return still ? `${done} ${agendaNote(r)}.` : done;
  }
  if (r.piType === "Rule" && r.piFiled) {
    return `The final rule is on public inspection since ${day(r.piFiled)}${r.piScheduled ? `, to be published ${day(r.piScheduled)}` : ""}.`;
  }
  if (r.fCompleted) {
    return withdrawn(r.fDecision)
      ? `The final rule was withdrawn from OIRA review on ${day(r.fCompleted)}.`
      : `OIRA finished its review of the final rule on ${day(r.fCompleted)}: "${r.fDecision ?? "no decision printed"}". Not yet published.`;
  }
  if (r.fReceived) return `The final rule has been at OIRA since ${day(r.fReceived)}.`;
  if (r.proposedPublished) {
    if (r.commentsClose && r.commentsClose >= today) {
      const n = daysBetween(today, r.commentsClose);
      return `Proposed ${day(r.proposedPublished)}. Comments close ${day(r.commentsClose)}, ${n} ${n === 1 ? "day" : "days"} left.`;
    }
    if (r.commentsClose) return `Proposed ${day(r.proposedPublished)}; comments closed ${day(r.commentsClose)}. No final rule yet.`;
    return `Proposed ${day(r.proposedPublished)}. No final rule yet.`;
  }
  if (r.piFiled) {
    return `On public inspection since ${day(r.piFiled)}${r.piScheduled ? `, to be published ${day(r.piScheduled)}` : ""}.`;
  }
  if (r.pCompleted) {
    return withdrawn(r.pDecision)
      ? `Withdrawn from OIRA review on ${day(r.pCompleted)}.`
      : `OIRA finished its review on ${day(r.pCompleted)}: "${r.pDecision ?? "no decision printed"}". Not yet in the Federal Register.`;
  }
  if (r.pReceived) {
    const n = daysBetween(r.pReceived, today);
    return `At OIRA since ${day(r.pReceived)}, ${n} ${n === 1 ? "day" : "days"} so far.`;
  }
  const listed = agendaNote(r);
  if (listed) return `${listed}. Not at OIRA on this record.`;
  return "Followed from the Federal Register.";
}

/** The date of the newest step the record holds, for ordering rules by what moved last. */
export function lastMoved(r: RuleRecord): string {
  // The agenda counts from the edition whose listing changed, so a rule an
  // edition relists unchanged hasn't moved.
  return [r.aListed, r.pReceived, r.pCompleted, r.fReceived, r.fCompleted, r.piFiled, r.proposedPublished, r.finalPublished]
    .filter((d): d is string => Boolean(d))
    .sort()
    .reverse()[0] ?? "";
}

/** An agenda step's detail (the edition and what it lists, as the ingest wrote it), or null. */
export function parseAgendaDetail(detail: string | null): Listing | null {
  try {
    const d = JSON.parse(detail ?? "") as Record<string, unknown>;
    const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
    if (!d || typeof d !== "object") return null;
    return { edition: str(d.edition), stage: str(d.stage), action: str(d.action), date: str(d.date) };
  } catch {
    return null;
  }
}

/** One step a rule took, as a sentence for the digest and the page. */
export function stepSentence(
  e: Pick<RuleStepEvent, "kind" | "onDate" | "detail">,
  r: Pick<RuleRecord, "rin" | "title" | "agency" | "commentsClose" | "effectiveOn">,
): string {
  const t = `"${ruleTitle(r)}"`;
  const on = day(e.onDate);
  switch (e.kind) {
    case "agenda": {
      const l = parseAgendaDetail(e.detail);
      const whose = capital(possessive(agendaOwner(r.rin)));
      if (!l) return `${whose} Unified Agenda lists ${t}.`;
      return `${whose} ${l.edition ? `${l.edition} ` : ""}Unified Agenda lists ${listingWords(l, t)}.`;
    }
    case "oira-received":
      return `${r.agency ?? "The agency"} sent ${t} to OIRA for review on ${on}${e.detail ? ` (${e.detail.toLowerCase()})` : ""}.`;
    case "oira-completed":
      return withdrawn(e.detail)
        ? `${t} was withdrawn from OIRA review on ${on}.`
        : `OIRA finished its review of ${t} on ${on}. Its decision: "${e.detail ?? "none printed"}".`;
    case "public-inspection":
      return `${t} went on public inspection on ${on}, ahead of publication in the Federal Register.`;
    case "proposed-published":
      return `${t} was published as a proposed rule on ${on}${r.commentsClose ? `; comments close ${day(r.commentsClose)}` : ""}.`;
    case "final-published":
      return `${t} was published as a final rule on ${on}${r.effectiveOn ? `; it takes effect ${day(r.effectiveOn)}` : ""}.`;
  }
}

/** Steps whose date falls in [from, to], newest first: the week's moves. */
export function stepsBetween(events: RuleStepEvent[], from: string, to: string): RuleStepEvent[] {
  return events
    .filter((e) => e.onDate >= from && e.onDate <= to)
    .sort((a, b) => b.onDate.localeCompare(a.onDate) || RULE_STEP_KINDS.indexOf(b.kind) - RULE_STEP_KINDS.indexOf(a.kind));
}
