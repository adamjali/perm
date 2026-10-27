/**
 * A rule's way through review and the Federal Register, in words and steps.
 *
 * The facts are `scripts/ingest_rule_pipeline.py`'s: OIRA's review dates and
 * decision as OIRA prints them, the public inspection filing, and the
 * Register's own record of the proposal and the final rule. Nothing here is
 * an estimate: a step either has a date from one of those records or it
 * hasn't happened yet (or happened before the record began, which is said).
 *
 * Pure and shared: the policy page draws the track from `buildTrack`, and the
 * weekly digest and the page both word a step with `stepSentence`.
 */
import { shortDate } from "./months";
import { daysBetween } from "./time";

export type RuleStepKind =
  | "oira-received"
  | "oira-completed"
  | "public-inspection"
  | "proposed-published"
  | "final-published";

export const RULE_STEP_KINDS: readonly RuleStepKind[] = [
  "oira-received",
  "oira-completed",
  "public-inspection",
  "proposed-published",
  "final-published",
];

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
  key: "review" | "cleared" | "inspection" | "published" | "comments" | "final";
  label: string;
  date: string | null;
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

/** The six steps, each with its date or what's known about it. */
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

/** Where a rule stands, in one sentence. */
export function standing(r: RuleRecord, today: string): string {
  if (r.finalPublished) {
    if (r.effectiveOn && r.effectiveOn > today) return `Final rule published ${day(r.finalPublished)}; it takes effect ${day(r.effectiveOn)}.`;
    return `Final rule published ${day(r.finalPublished)}${r.effectiveOn ? `, in effect since ${day(r.effectiveOn)}` : ""}.`;
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
  return "Followed from the Federal Register.";
}

/** The date of the newest step the record holds, for ordering rules by what moved last. */
export function lastMoved(r: RuleRecord): string {
  return [r.pReceived, r.pCompleted, r.fReceived, r.fCompleted, r.piFiled, r.proposedPublished, r.finalPublished]
    .filter((d): d is string => Boolean(d))
    .sort()
    .reverse()[0] ?? "";
}

/** One step a rule took, as a sentence for the digest and the page. */
export function stepSentence(
  e: Pick<RuleStepEvent, "kind" | "onDate" | "detail">,
  r: Pick<RuleRecord, "rin" | "title" | "agency" | "commentsClose" | "effectiveOn">,
): string {
  const t = `"${ruleTitle(r)}"`;
  const on = day(e.onDate);
  switch (e.kind) {
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
