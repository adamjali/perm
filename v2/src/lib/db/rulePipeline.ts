import "server-only";

import type { RuleRecord, RuleStepEvent, RuleStepKind } from "@convex/lib/ruleSteps";
import { RULE_STEP_KINDS, shownInPipeline } from "@convex/lib/ruleSteps";

import { rows } from "./client";

/**
 * The rules on their way, as `scripts/ingest_rule_pipeline.py` keeps them:
 * the Unified Agenda's listing, OIRA's review dates and decision, the public
 * inspection filing, the proposal and the final rule from the Register, by RIN.
 *
 * A failed read THROWS, so the page keeps its last good render rather than
 * printing "nothing is in review" over a read that never happened. The one
 * exception is a table that doesn't exist yet (before the ingest's first run),
 * which is an honest empty answer.
 */

export interface DbRule {
  rin: string;
  agency: string | null;
  title: string | null;
  p_stage: string | null;
  p_received: string | null;
  p_completed: string | null;
  p_decision: string | null;
  f_stage: string | null;
  f_received: string | null;
  f_completed: string | null;
  f_decision: string | null;
  major: string | null;
  pi_document: string | null;
  pi_type: string | null;
  pi_filed: string | null;
  pi_scheduled: string | null;
  pi_url: string | null;
  proposed_document: string | null;
  proposed_published: string | null;
  proposed_url: string | null;
  proposed_citation: string | null;
  comments_close: string | null;
  final_document: string | null;
  final_published: string | null;
  final_url: string | null;
  final_citation: string | null;
  effective_on: string | null;
  // The agenda's columns; absent on a table from before the agenda was read.
  a_pub_id?: string | null;
  a_edition?: string | null;
  a_published?: string | null;
  a_agency?: string | null;
  a_stage?: string | null;
  a_priority?: string | null;
  a_next_action?: string | null;
  a_next_date?: string | null;
  a_abstract?: string | null;
  a_url?: string | null;
  a_listed?: string | null;
}

interface DbEvent {
  rin: string;
  kind: string;
  on_date: string;
  detail: string | null;
}

const s = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

function noTable(err: unknown): boolean {
  return /no such table/i.test(String((err as { message?: unknown })?.message ?? err));
}

/** Edition ids sort as numbers: 202510, and the single 2012 edition as 201200. */
function pubKey(pub: string | null): number {
  const d = (pub ?? "").replace(/\D/g, "");
  return d ? Number(d.padEnd(6, "0")) : 0;
}

function toRecord(r: DbRule, newestPub: number): RuleRecord {
  const aPubId = s(r.a_pub_id);
  return {
    rin: r.rin,
    agency: s(r.agency),
    title: s(r.title),
    pStage: s(r.p_stage),
    pReceived: s(r.p_received),
    pCompleted: s(r.p_completed),
    pDecision: s(r.p_decision),
    fStage: s(r.f_stage),
    fReceived: s(r.f_received),
    fCompleted: s(r.f_completed),
    fDecision: s(r.f_decision),
    major: s(r.major),
    piDocument: s(r.pi_document),
    piType: s(r.pi_type),
    piFiled: s(r.pi_filed),
    piScheduled: s(r.pi_scheduled),
    piUrl: s(r.pi_url),
    proposedDocument: s(r.proposed_document),
    proposedPublished: s(r.proposed_published),
    proposedUrl: s(r.proposed_url),
    proposedCitation: s(r.proposed_citation),
    commentsClose: s(r.comments_close),
    finalDocument: s(r.final_document),
    finalPublished: s(r.final_published),
    finalUrl: s(r.final_url),
    finalCitation: s(r.final_citation),
    effectiveOn: s(r.effective_on),
    aPubId,
    aEdition: s(r.a_edition),
    aPublished: s(r.a_published),
    aAgency: s(r.a_agency),
    aStage: s(r.a_stage),
    aPriority: s(r.a_priority),
    aNextAction: s(r.a_next_action),
    aNextDate: s(r.a_next_date),
    aAbstract: s(r.a_abstract),
    aUrl: s(r.a_url),
    aListed: s(r.a_listed),
    aOnCurrent: aPubId ? pubKey(aPubId) >= newestPub : undefined,
  };
}

/** Every rule, and its records read as the page needs them. Exported for the test. */
export function toRecords(list: DbRule[]): RuleRecord[] {
  const newestPub = Math.max(0, ...list.map((r) => pubKey(s(r.a_pub_id))));
  return list.map((r) => toRecord(r, newestPub));
}

export interface RulePipeline {
  rules: RuleRecord[];
  /** Every recorded step, newest first. */
  events: RuleStepEvent[];
}

/**
 * Every rule followed (a few dozen: the rules from these agencies that OIRA
 * reviews or the agenda lists), and their steps. A rule whose final rule came
 * out more than FINAL_SHOWN_DAYS ago has finished its way and is left off
 * (it's in the Register list below on the page), unless an agenda dated after
 * that final rule still lists it on its way; `shownInPipeline` decides.
 */
export const FINAL_SHOWN_DAYS = 90;

// Rows the page may show: the database leaves off finished rules unless an
// agenda came after their final rule; `shownInPipeline` decides the rest.
const RULES_SQL =
  "SELECT * FROM rule_pipeline WHERE final_published IS NULL OR final_published >= ? OR a_published > final_published " +
  "ORDER BY rin LIMIT 400";
// The same before the ingest has added the agenda's columns.
const RULES_SQL_BEFORE_AGENDA =
  "SELECT * FROM rule_pipeline WHERE final_published IS NULL OR final_published >= ? ORDER BY rin LIMIT 400";

function noAgendaColumn(err: unknown): boolean {
  return /no such column:\s*a_/i.test(String((err as { message?: unknown })?.message ?? err));
}

export async function getRulePipeline(today: string): Promise<RulePipeline> {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - FINAL_SHOWN_DAYS);
  const finishedBefore = d.toISOString().slice(0, 10);
  try {
    const [ruleRows, eventRows] = await Promise.all([
      rows<DbRule>(RULES_SQL, [finishedBefore]).catch((err: unknown) => {
        if (noAgendaColumn(err)) return rows<DbRule>(RULES_SQL_BEFORE_AGENDA, [finishedBefore]);
        throw err;
      }),
      rows<DbEvent>(
        "SELECT rin, kind, on_date, detail FROM rule_pipeline_events ORDER BY on_date DESC LIMIT 1000",
      ),
    ]);
    const kinds = new Set<string>(RULE_STEP_KINDS);
    return {
      rules: toRecords(ruleRows).filter((r) => shownInPipeline(r, today, FINAL_SHOWN_DAYS)),
      events: eventRows
        .filter((e) => kinds.has(e.kind) && typeof e.on_date === "string")
        .map((e) => ({ rin: e.rin, kind: e.kind as RuleStepKind, onDate: e.on_date, detail: s(e.detail) })),
    };
  } catch (err) {
    if (noTable(err)) return { rules: [], events: [] };
    throw err;
  }
}
