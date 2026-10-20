/**
 * The chat's write actions, in one place.
 *
 * Every change the assistant can make goes through two steps here:
 *
 * 1. `prepareAction` turns what the model asked for into the exact arguments
 *    of the Convex mutation, checks them against the case as it is now (the
 *    PERM rules, the stage the dates support, an open RFI already there), and
 *    either answers the model with what's missing or returns a plan: the
 *    arguments, a line per change in plain words, and the case it applies to.
 * 2. `runAction` runs a plan's stored arguments and reads the case back, so the
 *    result says what was actually saved, never what was asked for.
 *
 * Auto mode prepares and runs at once; confirm mode prepares, records the plan
 * as a card (convex/chatConfirmations.ts), and the approval route runs the
 * stored plan. Both paths share this file, so they can't drift apart again.
 *
 * Oct 12 2026: the chat told a user a case update had saved when the stage it
 * reported was overwritten by the dates (cases.update recomputes the stage),
 * the archive tool deleted cases outright, list fields replaced the whole list,
 * and the wage went in as cents. Each is fixed below, with a test.
 */

import { createHash } from 'node:crypto';
import { format, parseISO } from 'date-fns';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { calculateRFIDueDate } from '@/lib/perm';
import { DATE_RANGE_METHODS } from '@convex/lib/perm/recruitment/methodCategories';
import { formatCaseStatus, formatProgressStatus } from '@convex/lib/notificationHelpers';
import type { PermissionLevel } from './tool-permissions';
import type {
  ArchiveCaseInput,
  BulkArchiveCasesInput,
  BulkCalendarSyncInput,
  BulkDeleteCasesInput,
  BulkUpdateStatusInput,
  CreateCaseInput,
  CreateJobDescriptionTemplateInput,
  DeleteCaseInput,
  DeleteJobDescriptionTemplateInput,
  DeleteNotificationInput,
  MarkNotificationReadInput,
  ReopenCaseInput,
  SyncToCalendarInput,
  UnsyncFromCalendarInput,
  UpdateCaseInput,
  UpdateJobDescriptionTemplateInput,
  UpdateSettingsInput,
} from './tools';

type CaseDoc = Doc<'cases'>;
type Args = Record<string, unknown>;

/** A request the model should answer itself: nothing was changed. */
export interface Answer {
  kind: 'answer';
  response: Record<string, unknown>;
}

/** A change ready to run, or to show as a card first. */
export interface Plan {
  kind: 'plan';
  toolName: string;
  args: Args;
  /** One line: what the card does. */
  description: string;
  /** A line per field or item that changes, in plain words. */
  changes: string[];
  warning?: string;
  permissionType?: PermissionLevel;
  /** Single-case plans: the case and its updatedAt when the plan was made. */
  caseId?: string;
  caseUpdatedAt?: number;
}

export type Prepared = Answer | Plan;

export interface ActionOutcome {
  ok: boolean;
  /** What the model and the card see. */
  result: Record<string, unknown>;
  /** One line for the confirmation record. */
  summary: string;
}

// =============================================================================
// Words
// =============================================================================

export function day(d: unknown): string {
  if (typeof d !== 'string' || d.length === 0) return 'nothing';
  try {
    return format(parseISO(d), 'MMM d, yyyy');
  } catch {
    return d;
  }
}

export function dollars(n: unknown): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 'nothing';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function stageWords(caseStatus: string, progressStatus: string): string {
  if (caseStatus === 'closed') return 'Closed';
  return `${formatCaseStatus(caseStatus)}, ${formatProgressStatus(progressStatus).toLowerCase()}`;
}

export function caseLabel(c: Pick<CaseDoc, 'employerName' | 'beneficiaryIdentifier' | 'positionTitle'>): string {
  const who = c.beneficiaryIdentifier ? ` for ${c.beneficiaryIdentifier}` : '';
  return `${c.employerName}${who} (${c.positionTitle})`;
}

/** Field names in the words the case form uses. */
export const FIELD_LABELS: Record<string, string> = {
  employerName: 'Employer',
  beneficiaryIdentifier: 'Foreign worker',
  positionTitle: 'Position title',
  jobTitle: 'Job title',
  caseStatus: 'Stage',
  progressStatus: 'Progress',
  priorityLevel: 'Priority',
  isProfessionalOccupation: 'Professional occupation',
  isFavorite: 'Favorite',
  isPinned: 'Pinned',
  calendarSyncEnabled: 'Calendar sync',
  showOnTimeline: 'Show on timeline',
  caseNumber: 'DOL case number',
  internalCaseNumber: 'Internal case number',
  pwdCaseNumber: 'PWD case number',
  eta9089CaseNumber: 'ETA 9089 case number',
  i140ReceiptNumber: 'I-140 receipt number',
  pwdFilingDate: 'PWD filing date',
  pwdDeterminationDate: 'PWD determination date',
  pwdExpirationDate: 'PWD expiration date',
  pwdWageLevel: 'Wage level',
  pwdWageAmount: 'Wage',
  jobOrderStartDate: 'Job order start',
  jobOrderEndDate: 'Job order end',
  jobOrderState: 'Job order state',
  sundayAdFirstDate: 'First Sunday ad',
  sundayAdSecondDate: 'Second Sunday ad',
  sundayAdNewspaper: 'Sunday ad newspaper',
  noticeOfFilingStartDate: 'Notice of filing start',
  noticeOfFilingEndDate: 'Notice of filing end',
  recruitmentApplicantsCount: 'Applicants',
  recruitmentNotes: 'Recruitment notes',
  recruitmentSummaryCustom: 'Recruitment summary',
  eta9089FilingDate: 'ETA 9089 filing date',
  eta9089AuditDate: 'ETA 9089 audit date',
  eta9089CertificationDate: 'ETA 9089 certification date',
  eta9089ExpirationDate: 'ETA 9089 expiration date',
  eta9089DenialDate: 'ETA 9089 denial date',
  eta9089ReconsiderationDate: 'Reconsideration requested',
  eta9089ReconsiderationDeniedDate: 'Reconsideration denied',
  eta9089BalcaRequestDate: 'BALCA review requested',
  i140FilingDate: 'I-140 filing date',
  i140ReceiptDate: 'I-140 receipt date',
  i140ApprovalDate: 'I-140 approval date',
  i140DenialDate: 'I-140 denial date',
  i140Category: 'I-140 category',
  i140PremiumProcessing: 'Premium processing',
  i140ServiceCenter: 'Service center',
  jobDescription: 'Job description',
  jobDescriptionPositionTitle: 'Job description title',
  employerFein: 'Employer FEIN',
  socCode: 'SOC code',
  socTitle: 'SOC title',
  additionalRecruitmentMethods: 'Recruitment methods',
  rfiEntries: 'RFI',
  rfeEntries: 'RFE',
  notes: 'Notes',
  tags: 'Tags',
};

const RECRUITMENT_METHOD_WORDS: Record<string, string> = {
  local_newspaper: 'Local or ethnic newspaper ad',
  radio_ad: 'Radio ad',
  tv_ad: 'TV ad',
  job_fair: 'Job fair',
  campus_placement: 'Campus placement office',
  trade_organization: 'Trade or professional organization',
  private_employment_firm: 'Private employment firm',
  employee_referral: 'Employee referral program',
  employer_website: "Employer's website",
  job_website_ad: 'Job website ad',
  on_campus_recruitment: 'On-campus recruitment',
};

function valueWords(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'nothing';
  if (field === 'pwdWageAmount') return dollars(value);
  if (field === 'employerFein') return 'a new value';
  if (field === 'jobDescription') return `${String(value).length.toLocaleString('en-US')} characters`;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (field.endsWith('Date')) return day(value);
  if (field === 'caseStatus') return formatCaseStatus(String(value));
  if (field === 'progressStatus') return formatProgressStatus(String(value));
  return String(value);
}

function methodWords(m: { method: string; date: string; startDate?: string; endDate?: string; description?: string }): string {
  const name = RECRUITMENT_METHOD_WORDS[m.method] ?? m.method;
  const when = m.endDate ? `${day(m.startDate || m.date)} to ${day(m.endDate)}` : day(m.date);
  return `${name}${m.description ? ` (${m.description})` : ''}, ${when}`;
}

// =============================================================================
// Hashing (duplicate cards)
// =============================================================================

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Args)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Identifies a change: the same tool with the same arguments hashes the same.
 * Generated ids and timestamps inside new list items are left out, so asking
 * twice for the same note or RFI counts as the same change.
 */
export function hashAction(toolName: string, args: Args): string {
  const stable = JSON.parse(
    JSON.stringify(args, (key, v) => (key === 'id' && typeof v === 'string' && /^(rfi|rfe|note)_/.test(v) ? undefined : key === 'createdAt' ? undefined : v)),
  );
  return createHash('sha256').update(`${toolName}\n${canonical(stable)}`).digest('hex');
}

// =============================================================================
// Shared reads
// =============================================================================

const CONVEX_ID = /^[a-z0-9]{20,40}$/;

function badId(label: string): Answer {
  return {
    kind: 'answer',
    response: {
      error: `That ${label} id isn't one this app uses.`,
      suggestion: 'Find the case with queryCases and use its _id.',
    },
  };
}

async function readCase(caseId: string, token: string): Promise<CaseDoc | null> {
  try {
    return (await fetchQuery(api.cases.get, { id: caseId as Id<'cases'> }, { token })) as CaseDoc | null;
  } catch {
    return null;
  }
}

function notFound(): Answer {
  return {
    kind: 'answer',
    response: {
      error: "That case wasn't found. It may have been deleted, or the id is from another account.",
      suggestion: 'Search again with queryCases.',
    },
  };
}

/** The validator's "[V-RULE] field: message" reduced to the message. */
function plainProblems(errors: string[]): string[] {
  return errors.map((e) => e.replace(/^\[[^\]]+\]\s*[^:]+:\s*/, ''));
}

/** The date that moves a case to a stage, for asking the person. */
export function dateNeededFor(caseStatus: string, progressStatus?: string): string {
  switch (caseStatus) {
    case 'pwd':
      return progressStatus === 'filed' ? 'the PWD filing date' : 'no dates: a case with none starts at PWD';
    case 'recruitment':
      return 'the PWD determination date';
    case 'eta9089':
      if (progressStatus === 'filed') return 'the ETA 9089 filing date';
      if (progressStatus === 'rfi_rfe') return 'the date the RFI was received';
      if (progressStatus === 'under_review') return 'the ETA 9089 denial date and the date reconsideration or BALCA review was requested';
      return 'the recruitment dates (recruitment done and the 30-day wait over)';
    case 'i140':
      if (progressStatus === 'filed') return 'the I-140 filing date';
      if (progressStatus === 'approved') return 'the I-140 approval date';
      if (progressStatus === 'rfi_rfe') return 'the date the RFE was received';
      return 'the ETA 9089 certification date';
    case 'closed':
      return 'nothing: closing a case is archiveCase';
    default:
      return 'the date for that step';
  }
}

// =============================================================================
// updateCase
// =============================================================================

const SCALAR_UPDATE_FIELDS = [
  'employerName',
  'positionTitle',
  'jobTitle',
  'priorityLevel',
  'isProfessionalOccupation',
  'isFavorite',
  'isPinned',
  'calendarSyncEnabled',
  'showOnTimeline',
  'caseNumber',
  'internalCaseNumber',
  'pwdCaseNumber',
  'eta9089CaseNumber',
  'i140ReceiptNumber',
  'pwdFilingDate',
  'pwdDeterminationDate',
  'pwdExpirationDate',
  'pwdWageLevel',
  'pwdWageAmount',
  'jobOrderStartDate',
  'jobOrderEndDate',
  'jobOrderState',
  'sundayAdFirstDate',
  'sundayAdSecondDate',
  'sundayAdNewspaper',
  'noticeOfFilingStartDate',
  'noticeOfFilingEndDate',
  'recruitmentApplicantsCount',
  'recruitmentNotes',
  'recruitmentSummaryCustom',
  'eta9089FilingDate',
  'eta9089AuditDate',
  'eta9089CertificationDate',
  'eta9089ExpirationDate',
  'eta9089DenialDate',
  'eta9089ReconsiderationDate',
  'eta9089ReconsiderationDeniedDate',
  'eta9089BalcaRequestDate',
  'i140FilingDate',
  'i140ReceiptDate',
  'i140ApprovalDate',
  'i140DenialDate',
  'i140Category',
  'i140PremiumProcessing',
  'i140ServiceCenter',
  'jobDescription',
  'jobDescriptionPositionTitle',
  'employerFein',
  'socCode',
  'socTitle',
] as const;

function newEntryId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const isRangeMethod = (method: string) => (DATE_RANGE_METHODS as readonly string[]).includes(method);

/**
 * A recruitment method the way the case form stores it: a posting that runs
 * over a period (job website, employer website, private firm) keeps its dates
 * in startDate and endDate with `date` empty; every other method has one date.
 */
export function toStoredMethod(m: { method: string; date: string; endDate?: string; description?: string }) {
  if (isRangeMethod(m.method)) {
    return { method: m.method, date: '', description: m.description ?? '', startDate: m.date, endDate: m.endDate ?? m.date };
  }
  return { method: m.method, date: m.date, ...(m.description ? { description: m.description } : {}) };
}

const methodStart = (x: { date: string; startDate?: string }) => x.startDate || x.date;

/**
 * The mutation arguments and plain-words changes for an update, before the
 * stage and rule checks. Exported for tests; `prepareUpdateCase` is the entry.
 */
export function buildCaseUpdate(
  params: UpdateCaseInput,
  current: CaseDoc,
  now: number = Date.now(),
): { args: Args; changes: string[] } | Answer {
  const args: Args = { id: current._id };
  const changes: string[] = [];
  const cur = current as unknown as Args;
  const p = params as unknown as Args;

  const ask = (message: string): Answer => ({ kind: 'answer', response: { needsInfo: true, message, changed: false } });

  for (const field of SCALAR_UPDATE_FIELDS) {
    const value = p[field];
    if (value === undefined) continue;
    if (value === cur[field]) continue;
    args[field] = value;
    changes.push(`${FIELD_LABELS[field]}: ${valueWords(field, cur[field])} to ${valueWords(field, value)}`);
  }
  if (params.foreignWorkerId !== undefined && params.foreignWorkerId !== current.beneficiaryIdentifier) {
    args.beneficiaryIdentifier = params.foreignWorkerId;
    changes.push(`Foreign worker: ${valueWords('x', current.beneficiaryIdentifier)} to ${valueWords('x', params.foreignWorkerId)}`);
  }

  for (const field of params.clearFields ?? []) {
    if (args[field] !== undefined) return ask(`${FIELD_LABELS[field] ?? field} was both set and cleared. Which did the person mean?`);
    if (cur[field] === undefined || cur[field] === null || cur[field] === '') continue;
    args[field] = null;
    changes.push(`${FIELD_LABELS[field] ?? field}: ${valueWords(field, cur[field])} to nothing`);
  }

  // Recruitment methods: remove, then add, never replace the list.
  if (params.addRecruitmentMethods?.length || params.removeRecruitmentMethods?.length) {
    const list = [...(current.additionalRecruitmentMethods ?? [])];
    let changed = false;
    for (const r of params.removeRecruitmentMethods ?? []) {
      const i = list.findIndex((m) => m.method === r.method && methodStart(m) === r.date);
      if (i < 0) return ask(`There's no ${RECRUITMENT_METHOD_WORDS[r.method] ?? r.method} on ${day(r.date)} on this case to remove.`);
      const [gone] = list.splice(i, 1);
      changes.push(`Remove recruitment method: ${methodWords(gone!)}`);
      changed = true;
    }
    for (const m of params.addRecruitmentMethods ?? []) {
      const name = RECRUITMENT_METHOD_WORDS[m.method] ?? m.method;
      if (isRangeMethod(m.method) && !m.endDate) return ask(`When did the ${name} posting end? It runs over a period, so it needs a start and an end date.`);
      if (m.endDate && m.endDate < m.date) return ask(`The ${name} ends before it starts.`);
      if (list.some((x) => x.method === m.method && methodStart(x) === m.date)) continue;
      const stored = toStoredMethod(m);
      list.push(stored);
      changes.push(`Add recruitment method: ${methodWords(stored)}`);
      changed = true;
    }
    if (changed) args.additionalRecruitmentMethods = list;
  }

  // RFI: answer the open one, then add a new one. One open RFI at a time.
  if (params.addRfi || params.rfiResponseSubmittedDate) {
    const list = (current.rfiEntries ?? []).map((e) => ({ ...e }));
    if (params.rfiResponseSubmittedDate) {
      const open = list.filter((e) => !e.responseSubmittedDate).sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))[0];
      if (!open) return ask('This case has no open RFI to mark answered.');
      if (params.rfiResponseSubmittedDate < open.receivedDate) return ask('The RFI response date is before the RFI was received.');
      open.responseSubmittedDate = params.rfiResponseSubmittedDate;
      changes.push(`RFI received ${day(open.receivedDate)}: answered ${day(params.rfiResponseSubmittedDate)}`);
    }
    if (params.addRfi) {
      const stillOpen = list.find((e) => !e.responseSubmittedDate);
      if (stillOpen) {
        return ask(`This case already has an open RFI, received ${day(stillOpen.receivedDate)}. Ask whether it was answered (rfiResponseSubmittedDate) before adding another.`);
      }
      const due = calculateRFIDueDate(params.addRfi.receivedDate);
      list.push({
        id: newEntryId('rfi'),
        receivedDate: params.addRfi.receivedDate,
        responseDueDate: due,
        ...(params.addRfi.title ? { title: params.addRfi.title } : {}),
        ...(params.addRfi.description ? { description: params.addRfi.description } : {}),
        createdAt: now,
      });
      changes.push(`Add RFI received ${day(params.addRfi.receivedDate)}, response due ${day(due)}`);
    }
    args.rfiEntries = list;
  }

  // RFE: the same, with the due date from the USCIS notice.
  if (params.addRfe || params.rfeResponseSubmittedDate) {
    const list = (current.rfeEntries ?? []).map((e) => ({ ...e }));
    if (params.rfeResponseSubmittedDate) {
      const open = list.filter((e) => !e.responseSubmittedDate).sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))[0];
      if (!open) return ask('This case has no open RFE to mark answered.');
      if (params.rfeResponseSubmittedDate < open.receivedDate) return ask('The RFE response date is before the RFE was received.');
      open.responseSubmittedDate = params.rfeResponseSubmittedDate;
      changes.push(`RFE received ${day(open.receivedDate)}: answered ${day(params.rfeResponseSubmittedDate)}`);
    }
    if (params.addRfe) {
      const stillOpen = list.find((e) => !e.responseSubmittedDate);
      if (stillOpen) {
        return ask(`This case already has an open RFE, received ${day(stillOpen.receivedDate)}. Ask whether it was answered (rfeResponseSubmittedDate) before adding another.`);
      }
      if (params.addRfe.responseDueDate < params.addRfe.receivedDate) return ask('The RFE due date is before it was received.');
      list.push({
        id: newEntryId('rfe'),
        receivedDate: params.addRfe.receivedDate,
        responseDueDate: params.addRfe.responseDueDate,
        ...(params.addRfe.title ? { title: params.addRfe.title } : {}),
        ...(params.addRfe.description ? { description: params.addRfe.description } : {}),
        createdAt: now,
      });
      changes.push(`Add RFE received ${day(params.addRfe.receivedDate)}, response due ${day(params.addRfe.responseDueDate)}`);
    }
    args.rfeEntries = list;
  }

  // Notes: add one, or mark existing ones done or deleted.
  if (params.addNote || params.noteChanges?.length) {
    const list = (current.notes ?? []).map((n) => ({ ...n }));
    for (const ch of params.noteChanges ?? []) {
      const note = list.find((n) => n.id === ch.id);
      if (!note) return ask(`There's no note with id ${ch.id} on this case.`);
      if (note.status === ch.status) continue;
      note.status = ch.status;
      changes.push(`Note "${note.content.slice(0, 60)}": ${ch.status === 'done' ? 'done' : ch.status === 'deleted' ? 'deleted' : 'open again'}`);
    }
    if (params.addNote) {
      list.push({
        id: newEntryId('note'),
        content: params.addNote.content,
        createdAt: now,
        status: 'pending',
        ...(params.addNote.priority ? { priority: params.addNote.priority } : {}),
        ...(params.addNote.category ? { category: params.addNote.category } : {}),
        ...(params.addNote.dueDate ? { dueDate: params.addNote.dueDate } : {}),
      });
      changes.push(`Add note: "${params.addNote.content.slice(0, 80)}"${params.addNote.dueDate ? `, due ${day(params.addNote.dueDate)}` : ''}`);
    }
    args.notes = list;
  }

  // Tags.
  if (params.addTags?.length || params.removeTags?.length) {
    const before = current.tags ?? [];
    const remove = new Set((params.removeTags ?? []).map((t) => t.toLowerCase()));
    const kept = before.filter((t) => !remove.has(t.toLowerCase()));
    const add = (params.addTags ?? []).filter((t) => !kept.some((k) => k.toLowerCase() === t.toLowerCase()));
    const next = [...kept, ...add];
    if (next.length !== before.length || next.some((t, i) => t !== before[i])) {
      args.tags = next;
      for (const t of before.filter((t) => remove.has(t.toLowerCase()))) changes.push(`Remove tag: ${t}`);
      for (const t of add) changes.push(`Add tag: ${t}`);
    }
  }

  // The stage set by hand, or handed back to the dates.
  if (params.setStageByHand) {
    if (!params.caseStatus && !params.progressStatus) return ask('Setting the stage by hand needs the stage. Which stage?');
    if (params.caseStatus === 'closed') return ask('To close a case use archiveCase.');
    args.caseStatus = params.caseStatus ?? current.caseStatus;
    args.progressStatus = params.progressStatus ?? current.progressStatus;
    args.progressStatusOverride = true;
  } else if (params.stageFollowsDates && current.progressStatusOverride) {
    args.progressStatusOverride = false;
    changes.push('Stage: follows the dates again');
  }

  return { args, changes };
}

export async function prepareUpdateCase(params: UpdateCaseInput, token: string): Promise<Prepared> {
  if (!CONVEX_ID.test(params.caseId)) return badId('case');
  const current = await readCase(params.caseId, token);
  if (!current) return notFound();
  if (params.caseStatus === 'closed' && !params.setStageByHand) {
    return {
      kind: 'answer',
      response: { needsInfo: true, changed: false, message: 'Closing a case is archiveCase, not updateCase.' },
    };
  }

  const built = buildCaseUpdate(params, current);
  if ('kind' in built) return built;
  let { args } = built;
  const { changes } = built;

  const asksForStage = params.caseStatus !== undefined || params.progressStatus !== undefined;

  // A case whose stage was already set by hand: a stage request keeps it by hand.
  if (asksForStage && !params.setStageByHand && current.progressStatusOverride && params.stageFollowsDates !== true) {
    args = {
      ...args,
      caseStatus: params.caseStatus ?? current.caseStatus,
      progressStatus: params.progressStatus ?? current.progressStatus,
    };
  }

  const changesSomething = Object.keys(args).some((k) => k !== 'id');
  if (!changesSomething && !asksForStage) {
    return {
      kind: 'answer',
      response: { changed: false, message: 'Nothing to change: the case already has these values.' },
    };
  }

  let preview: { valid: boolean; errors: string[]; caseStatus: string; progressStatus: string; stageFollowsDates: boolean };
  try {
    preview = await fetchQuery(api.cases.previewUpdate, args as Parameters<typeof fetchQuery<typeof api.cases.previewUpdate>>[1], { token });
  } catch (error) {
    return {
      kind: 'answer',
      response: {
        error: "The change couldn't be checked, so it wasn't made.",
        suggestion: error instanceof Error ? error.message : 'Try again.',
      },
    };
  }

  if (!preview.valid) {
    return {
      kind: 'answer',
      response: {
        changed: false,
        error: "This change breaks a PERM rule, so it wasn't made.",
        problems: plainProblems(preview.errors),
        suggestion: 'Tell the person what the rule says and ask which date is right.',
      },
    };
  }

  // The stage asked for must be the stage the dates give, unless set by hand.
  if (asksForStage && !params.setStageByHand && preview.stageFollowsDates) {
    const wantCase = params.caseStatus ?? preview.caseStatus;
    const wantProgress = params.progressStatus ?? preview.progressStatus;
    if (wantCase !== preview.caseStatus || wantProgress !== preview.progressStatus) {
      return {
        kind: 'answer',
        response: {
          needsInfo: true,
          changed: false,
          stageNow: stageWords(current.caseStatus, current.progressStatus),
          stageTheDatesGive: stageWords(preview.caseStatus, preview.progressStatus),
          message:
            `Nothing was changed. The stage follows the case's dates, and with ${changesSomething ? 'this change' : 'its dates'} the case is at ` +
            `${stageWords(preview.caseStatus, preview.progressStatus)}. To show ${stageWords(wantCase, wantProgress)}, ` +
            `I need ${dateNeededFor(wantCase, wantProgress)}. Ask the person for it (never assume today). ` +
            'If they want the stage set by hand without the date, call updateCase again with setStageByHand: true.',
        },
      };
    }
    if (!changesSomething) {
      return {
        kind: 'answer',
        response: { changed: false, message: `The case is already at ${stageWords(preview.caseStatus, preview.progressStatus)}.` },
      };
    }
  }

  if (preview.caseStatus !== current.caseStatus || preview.progressStatus !== current.progressStatus) {
    changes.push(
      `Stage: ${stageWords(current.caseStatus, current.progressStatus)} to ${stageWords(preview.caseStatus, preview.progressStatus)}${preview.stageFollowsDates ? '' : ' (set by hand)'}`,
    );
  }

  return {
    kind: 'plan',
    toolName: 'updateCase',
    args,
    description: `Update ${caseLabel(current)}`,
    changes,
    caseId: current._id,
    caseUpdatedAt: current.updatedAt,
  };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === null || a === '') a = undefined;
  if (b === null || b === '') b = undefined;
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  return a === b;
}

async function runUpdateCase(args: Args, token: string): Promise<ActionOutcome> {
  const id = args.id as string;
  const before = await readCase(id, token);
  await fetchMutation(api.cases.update, args as Parameters<typeof fetchMutation<typeof api.cases.update>>[1], { token });
  const after = await readCase(id, token);
  if (!after) {
    const message = "The update ran, but the case couldn't be read back to confirm it. Open the case to check.";
    return { ok: false, result: { success: false, caseId: id, message }, summary: message };
  }
  const saved: string[] = [];
  const notSaved: string[] = [];
  const got = after as unknown as Args;
  for (const [field, sent] of Object.entries(args)) {
    if (field === 'id' || field === 'progressStatusOverride') continue;
    if (field === 'caseStatus' || field === 'progressStatus') continue;
    const label = FIELD_LABELS[field] ?? field;
    if (sameValue(got[field], sent)) {
      if (Array.isArray(sent)) saved.push(label);
      else saved.push(`${label}: ${valueWords(field, got[field])}`);
    } else {
      notSaved.push(`${label} (asked for ${Array.isArray(sent) ? 'a change' : valueWords(field, sent)}, the case has ${Array.isArray(got[field]) ? 'something else' : valueWords(field, got[field])})`);
    }
  }
  if (args.caseStatus !== undefined && (after.caseStatus !== args.caseStatus || after.progressStatus !== args.progressStatus)) {
    notSaved.push(`Stage (asked for ${stageWords(String(args.caseStatus), String(args.progressStatus))})`);
  }
  const stage = stageWords(after.caseStatus, after.progressStatus);
  const stageMoved = before ? before.caseStatus !== after.caseStatus || before.progressStatus !== after.progressStatus : false;
  const label = caseLabel(after);
  const message =
    `${notSaved.length === 0 ? 'Saved' : 'Partly saved'} on ${label}. ` +
    (saved.length ? `${saved.join('; ')}. ` : '') +
    `Stage ${stageMoved ? 'now' : 'still'}: ${stage}${after.progressStatusOverride ? ' (set by hand)' : ''}.` +
    (notSaved.length ? ` Not saved: ${notSaved.join('; ')}.` : '');
  return {
    ok: notSaved.length === 0,
    result: {
      success: notSaved.length === 0,
      caseId: id,
      action: 'case_updated',
      saved,
      notSaved,
      stage,
      stageSetByHand: Boolean(after.progressStatusOverride),
      message,
    },
    summary: message,
  };
}

// =============================================================================
// createCase
// =============================================================================

export async function prepareCreateCase(params: CreateCaseInput, token: string): Promise<Prepared> {
  const args: Args = {
    employerName: params.employerName,
    positionTitle: params.positionTitle,
    beneficiaryIdentifier: params.foreignWorkerId ?? '',
  };
  const p = params as unknown as Args;
  const copy = [
    'priorityLevel', 'isProfessionalOccupation', 'isFavorite', 'calendarSyncEnabled',
    'pwdFilingDate', 'pwdDeterminationDate', 'pwdExpirationDate', 'pwdCaseNumber', 'pwdWageLevel', 'pwdWageAmount',
    'jobOrderStartDate', 'jobOrderEndDate', 'sundayAdFirstDate', 'sundayAdSecondDate', 'sundayAdNewspaper',
    'noticeOfFilingStartDate', 'noticeOfFilingEndDate',
    'eta9089FilingDate', 'eta9089CertificationDate', 'eta9089CaseNumber',
    'i140FilingDate', 'i140ReceiptNumber', 'i140Category', 'i140PremiumProcessing',
    'internalCaseNumber', 'employerFein', 'socCode', 'socTitle', 'jobOrderState',
  ];
  for (const f of copy) if (p[f] !== undefined) args[f] = p[f];
  if (params.additionalRecruitmentMethods?.length) {
    args.additionalRecruitmentMethods = params.additionalRecruitmentMethods.map(toStoredMethod);
  }
  if (params.setStageByHand) {
    if (params.caseStatus === 'closed') {
      return { kind: 'answer', response: { needsInfo: true, message: "A new case can't start closed." } };
    }
    args.caseStatus = params.caseStatus ?? 'pwd';
    args.progressStatus = params.progressStatus ?? 'working';
    args.progressStatusOverride = true;
  }

  let preview: { valid: boolean; errors: string[]; caseStatus: string; progressStatus: string };
  try {
    preview = await fetchQuery(api.cases.previewCreate, args as Parameters<typeof fetchQuery<typeof api.cases.previewCreate>>[1], { token });
  } catch (error) {
    return {
      kind: 'answer',
      response: { error: "The new case couldn't be checked, so it wasn't created.", suggestion: error instanceof Error ? error.message : 'Try again.' },
    };
  }
  if (!preview.valid) {
    return {
      kind: 'answer',
      response: {
        changed: false,
        error: "These dates break a PERM rule, so the case wasn't created.",
        problems: plainProblems(preview.errors),
        suggestion: 'Tell the person what the rule says and ask which date is right.',
      },
    };
  }
  if ((params.caseStatus || params.progressStatus) && !params.setStageByHand) {
    const wantCase = params.caseStatus ?? preview.caseStatus;
    const wantProgress = params.progressStatus ?? preview.progressStatus;
    if (wantCase !== preview.caseStatus || wantProgress !== preview.progressStatus) {
      return {
        kind: 'answer',
        response: {
          needsInfo: true,
          changed: false,
          message:
            `Nothing was created. A new case's stage follows its dates; with these it starts at ${stageWords(preview.caseStatus, preview.progressStatus)}. ` +
            `To start at ${stageWords(wantCase, wantProgress)}, I need ${dateNeededFor(wantCase, wantProgress)}. Ask the person for it, or call createCase with setStageByHand: true if they want the stage set without dates.`,
        },
      };
    }
  }

  const changes: string[] = [];
  for (const [field, value] of Object.entries(args)) {
    if (field === 'progressStatusOverride' || value === '' || value === undefined) continue;
    if (field === 'additionalRecruitmentMethods') {
      for (const m of value as Parameters<typeof methodWords>[0][]) changes.push(`Recruitment method: ${methodWords(m)}`);
      continue;
    }
    changes.push(`${FIELD_LABELS[field] ?? field}: ${valueWords(field, value)}`);
  }
  changes.push(`Stage: ${stageWords(preview.caseStatus, preview.progressStatus)}${params.setStageByHand ? ' (set by hand)' : ''}`);

  let warning: string | undefined;
  try {
    const dup = await fetchQuery(
      api.cases.checkDuplicates,
      { cases: [{ employerName: params.employerName, beneficiaryIdentifier: params.foreignWorkerId }] },
      { token },
    );
    const first = dup.duplicates[0];
    if (first) {
      warning = `There's already a case for ${first.employerName}${first.beneficiaryIdentifier ? ` and ${first.beneficiaryIdentifier}` : ''}${first.existingPositionTitle ? ` (${first.existingPositionTitle})` : ''}. Creating this makes a second one.`;
    }
  } catch {
    // The duplicate check is advice; the create itself doesn't depend on it.
  }

  return {
    kind: 'plan',
    toolName: 'createCase',
    args,
    description: `Create a case: ${caseLabel({ employerName: params.employerName, beneficiaryIdentifier: params.foreignWorkerId ?? '', positionTitle: params.positionTitle })}`,
    changes,
    warning,
  };
}

async function runCreateCase(args: Args, token: string): Promise<ActionOutcome> {
  const id = await fetchMutation(api.cases.create, args as Parameters<typeof fetchMutation<typeof api.cases.create>>[1], { token });
  const after = await readCase(id, token);
  const label = after ? caseLabel(after) : String(args.employerName);
  const stage = after ? stageWords(after.caseStatus, after.progressStatus) : 'unknown';
  const message = `Created a case: ${label}. Stage: ${stage}.`;
  return {
    ok: true,
    result: { success: true, caseId: id, action: 'case_created', stage, message },
    summary: message,
  };
}

// =============================================================================
// Close, reopen, delete
// =============================================================================

async function prepareArchiveCase(params: ArchiveCaseInput, token: string): Promise<Prepared> {
  if (!CONVEX_ID.test(params.caseId)) return badId('case');
  const c = await readCase(params.caseId, token);
  if (!c) return notFound();
  if (c.caseStatus === 'closed') {
    return { kind: 'answer', response: { changed: false, message: `${caseLabel(c)} is already closed.` } };
  }
  return {
    kind: 'plan',
    toolName: 'archiveCase',
    args: { ids: [c._id], status: 'closed', closureReason: params.reason ?? 'manual' },
    description: `Close ${caseLabel(c)}`,
    changes: [
      `Stage: ${stageWords(c.caseStatus, c.progressStatus)} to Closed`,
      'Everything on the case stays, and reopening it puts it back at the stage its dates support.',
    ],
    caseId: c._id,
    caseUpdatedAt: c.updatedAt,
  };
}

async function prepareReopenCase(params: ReopenCaseInput, token: string): Promise<Prepared> {
  if (!CONVEX_ID.test(params.caseId)) return badId('case');
  const c = await readCase(params.caseId, token);
  if (!c) return notFound();
  if (c.caseStatus !== 'closed') {
    return { kind: 'answer', response: { changed: false, message: `${caseLabel(c)} isn't closed; it's at ${stageWords(c.caseStatus, c.progressStatus)}.` } };
  }
  return {
    kind: 'plan',
    toolName: 'reopenCase',
    args: { id: c._id },
    description: `Reopen ${caseLabel(c)}`,
    changes: ['Stage: Closed to the stage its dates support'],
    caseId: c._id,
    caseUpdatedAt: c.updatedAt,
  };
}

async function prepareDeleteCase(params: DeleteCaseInput, token: string): Promise<Prepared> {
  if (!CONVEX_ID.test(params.caseId)) return badId('case');
  const c = await readCase(params.caseId, token);
  if (!c) return notFound();
  return {
    kind: 'plan',
    toolName: 'deleteCase',
    args: { id: c._id },
    description: `Delete ${caseLabel(c)} for good`,
    changes: ['The case, its dates, notes and documents are removed. This can\'t be undone.'],
    warning: "This can't be undone. To keep the record, close the case instead.",
    permissionType: 'destructive',
    caseId: c._id,
    caseUpdatedAt: c.updatedAt,
  };
}

// =============================================================================
// Calendar
// =============================================================================

async function prepareCalendar(caseId: string, enable: boolean, token: string): Promise<Prepared> {
  if (!CONVEX_ID.test(caseId)) return badId('case');
  const c = await readCase(caseId, token);
  if (!c) return notFound();
  if (enable) {
    const profile = await fetchQuery(api.users.currentUserProfile, {}, { token }).catch(() => null);
    if (profile && !profile.googleCalendarConnected) {
      return {
        kind: 'answer',
        response: { changed: false, message: "Google Calendar isn't connected, so there's nothing to sync to. Connect it in Settings, under Calendar sync." },
      };
    }
    if (profile && profile.calendarSyncEnabled === false) {
      return {
        kind: 'answer',
        response: { changed: false, message: 'Calendar sync is switched off for the whole account (Settings, Calendar sync). Turn it on there first.' },
      };
    }
    if (c.calendarSyncEnabled) {
      return { kind: 'answer', response: { changed: false, message: `${caseLabel(c)} already syncs to Google Calendar.` } };
    }
  } else if (!c.calendarSyncEnabled) {
    return { kind: 'answer', response: { changed: false, message: `${caseLabel(c)} doesn't sync to Google Calendar.` } };
  }
  return {
    kind: 'plan',
    toolName: enable ? 'syncToCalendar' : 'unsyncFromCalendar',
    args: { id: c._id },
    description: `${enable ? 'Sync' : 'Stop syncing'} ${caseLabel(c)} ${enable ? 'to' : 'with'} Google Calendar`,
    changes: [enable ? "The case's deadlines are added to your Google Calendar." : "The case's events are removed from your Google Calendar."],
    caseId: c._id,
    caseUpdatedAt: c.updatedAt,
  };
}

// =============================================================================
// Bulk
// =============================================================================

interface MinimalCase {
  _id: string;
  employerName: string;
  beneficiaryIdentifier?: string;
  caseStatus: string;
  calendarSyncEnabled?: boolean;
}

/** Most a bulk card can change at once. */
export const BULK_MAX = 500;

async function resolveBulk(
  params: { caseIds?: string[]; all?: boolean; filterByStatus?: string },
  token: string,
): Promise<MinimalCase[] | Answer> {
  const result = (await fetchQuery(
    api.chatCaseData.queryCases,
    { idsOnly: true, ...(params.all && !params.caseIds?.length && params.filterByStatus ? { caseStatus: params.filterByStatus as never } : {}) },
    { token },
  )) as { cases?: MinimalCase[] };
  const mine = result.cases ?? [];
  let picked: MinimalCase[];
  if (params.caseIds?.length) {
    const byId = new Map(mine.map((c) => [String(c._id), c]));
    const missing = params.caseIds.filter((id) => !byId.has(id));
    if (missing.length) {
      return {
        kind: 'answer',
        response: { error: `${missing.length} of those case ids aren't among this account's cases.`, suggestion: 'Use selectedCaseIds from getPageContext, or ids from queryCases.' },
      };
    }
    picked = [...new Set(params.caseIds)].map((id) => byId.get(id)!);
  } else if (params.all) {
    picked = mine;
  } else {
    return { kind: 'answer', response: { error: 'No cases named.', suggestion: 'Send caseIds (for selected cases use getPageContext), or all: true for every case.' } };
  }
  if (picked.length === 0) return { kind: 'answer', response: { changed: false, message: 'No cases match.' } };
  if (picked.length > BULK_MAX) {
    return { kind: 'answer', response: { error: `That's ${picked.length} cases; one change can cover ${BULK_MAX} at most.`, suggestion: 'Narrow it with filterByStatus or a selection.' } };
  }
  return picked;
}

function namesPreview(cases: MinimalCase[]): string[] {
  const shown = cases.slice(0, 8).map((c) => `${c.employerName}${c.beneficiaryIdentifier ? ` for ${c.beneficiaryIdentifier}` : ''}`);
  if (cases.length > shown.length) shown.push(`and ${cases.length - shown.length} more`);
  return shown;
}

async function prepareBulkStatus(params: BulkUpdateStatusInput, token: string): Promise<Prepared> {
  const picked = await resolveBulk(params, token);
  if (!Array.isArray(picked)) return picked;
  const moving = picked.filter((c) => c.caseStatus !== params.status);
  if (moving.length === 0) return { kind: 'answer', response: { changed: false, message: `All ${picked.length} are already at ${formatCaseStatus(params.status)}.` } };
  const closing = params.status === 'closed';
  const reopening = !closing && moving.every((c) => c.caseStatus === 'closed');
  return {
    kind: 'plan',
    toolName: 'bulkUpdateStatus',
    args: { ids: moving.map((c) => c._id), status: params.status },
    description: closing
      ? `Close ${moving.length} case${moving.length === 1 ? '' : 's'}`
      : reopening
        ? `Reopen ${moving.length} case${moving.length === 1 ? '' : 's'}`
        : `Set ${moving.length} case${moving.length === 1 ? '' : 's'} to ${formatCaseStatus(params.status)} by hand`,
    changes: [
      ...namesPreview(moving),
      closing
        ? 'Each keeps everything on it and can be reopened.'
        : reopening
          ? 'Each reopens at the stage its dates support.'
          : 'Closed cases among them reopen at the stage their dates support; the rest have the stage set by hand and stop following their dates.',
    ],
    permissionType: 'destructive',
  };
}

async function prepareBulkArchive(params: BulkArchiveCasesInput, token: string): Promise<Prepared> {
  const picked = await resolveBulk(params, token);
  if (!Array.isArray(picked)) return picked;
  const open = picked.filter((c) => c.caseStatus !== 'closed');
  if (open.length === 0) return { kind: 'answer', response: { changed: false, message: 'Those cases are already closed.' } };
  return {
    kind: 'plan',
    toolName: 'bulkArchiveCases',
    args: { ids: open.map((c) => c._id), status: 'closed', closureReason: 'manual' },
    description: `Close ${open.length} case${open.length === 1 ? '' : 's'}`,
    changes: [...namesPreview(open), 'Each keeps everything on it and can be reopened.'],
    permissionType: 'destructive',
  };
}

async function prepareBulkDelete(params: BulkDeleteCasesInput, token: string): Promise<Prepared> {
  const picked = await resolveBulk(params, token);
  if (!Array.isArray(picked)) return picked;
  return {
    kind: 'plan',
    toolName: 'bulkDeleteCases',
    args: { ids: picked.map((c) => c._id) },
    description: `Delete ${picked.length} case${picked.length === 1 ? '' : 's'} for good`,
    changes: namesPreview(picked),
    warning: "This can't be undone. Every record in these cases is removed. To keep them, close them instead.",
    permissionType: 'destructive',
  };
}

async function prepareBulkCalendar(params: BulkCalendarSyncInput, token: string): Promise<Prepared> {
  const picked = await resolveBulk(params, token);
  if (!Array.isArray(picked)) return picked;
  const changing = picked.filter((c) => Boolean(c.calendarSyncEnabled) !== params.enabled);
  if (changing.length === 0) {
    return { kind: 'answer', response: { changed: false, message: `Calendar sync is already ${params.enabled ? 'on' : 'off'} for those cases.` } };
  }
  if (params.enabled) {
    const profile = await fetchQuery(api.users.currentUserProfile, {}, { token }).catch(() => null);
    if (profile && !profile.googleCalendarConnected) {
      return { kind: 'answer', response: { changed: false, message: "Google Calendar isn't connected. Connect it in Settings, under Calendar sync, first." } };
    }
  }
  return {
    kind: 'plan',
    toolName: 'bulkCalendarSync',
    args: { ids: changing.map((c) => c._id), calendarSyncEnabled: params.enabled },
    description: `${params.enabled ? 'Sync' : 'Stop syncing'} ${changing.length} case${changing.length === 1 ? '' : 's'} ${params.enabled ? 'to' : 'with'} Google Calendar`,
    changes: namesPreview(changing),
    permissionType: 'destructive',
  };
}

// =============================================================================
// Settings, notifications, templates
// =============================================================================

const SETTING_WORDS: Record<string, string> = {
  emailNotificationsEnabled: 'Email notifications',
  pushNotificationsEnabled: 'Browser notifications',
  emailDeadlineReminders: 'Deadline reminder emails',
  calendarSyncEnabled: 'Calendar sync for the account',
  calendarSyncPwd: 'Calendar: PWD deadlines',
  calendarSyncEta9089: 'Calendar: ETA 9089 deadlines',
  darkModeEnabled: 'Dark mode',
  urgentDeadlineDays: 'Days that count as urgent',
  reminderDaysBefore: 'Reminder days before a deadline',
  quietHoursEnabled: 'Quiet hours',
  quietHoursStart: 'Quiet hours start',
  quietHoursEnd: 'Quiet hours end',
};

function settingWords(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function prepareSettings(params: UpdateSettingsInput): Prepared {
  const settings = Object.fromEntries(Object.entries(params.settings).filter(([, v]) => v !== undefined));
  if (Object.keys(settings).length === 0) return { kind: 'answer', response: { changed: false, message: 'No setting named.' } };
  if (settings.reminderDaysBefore) {
    settings.reminderDaysBefore = [...new Set(settings.reminderDaysBefore as number[])].sort((a, b) => b - a);
  }
  return {
    kind: 'plan',
    toolName: 'updateSettings',
    args: settings,
    description: 'Change settings',
    changes: Object.entries(settings).map(([k, v]) => `${SETTING_WORDS[k] ?? k}: ${settingWords(v)}`),
  };
}

// =============================================================================
// Entry points
// =============================================================================

/** The tools this module prepares and runs. */
export const ACTION_TOOLS = [
  'createCase',
  'updateCase',
  'archiveCase',
  'reopenCase',
  'deleteCase',
  'syncToCalendar',
  'unsyncFromCalendar',
  'markNotificationRead',
  'markAllNotificationsRead',
  'deleteNotification',
  'clearAllNotifications',
  'updateSettings',
  'bulkUpdateStatus',
  'bulkArchiveCases',
  'bulkDeleteCases',
  'bulkCalendarSync',
  'createJobDescriptionTemplate',
  'updateJobDescriptionTemplate',
  'deleteJobDescriptionTemplate',
] as const;

export type ActionTool = (typeof ACTION_TOOLS)[number];

export function isActionTool(name: string): name is ActionTool {
  return (ACTION_TOOLS as readonly string[]).includes(name);
}

export async function prepareAction(toolName: ActionTool, params: unknown, token: string): Promise<Prepared> {
  switch (toolName) {
    case 'createCase':
      return prepareCreateCase(params as CreateCaseInput, token);
    case 'updateCase':
      return prepareUpdateCase(params as UpdateCaseInput, token);
    case 'archiveCase':
      return prepareArchiveCase(params as ArchiveCaseInput, token);
    case 'reopenCase':
      return prepareReopenCase(params as ReopenCaseInput, token);
    case 'deleteCase':
      return prepareDeleteCase(params as DeleteCaseInput, token);
    case 'syncToCalendar':
      return prepareCalendar((params as SyncToCalendarInput).caseId, true, token);
    case 'unsyncFromCalendar':
      return prepareCalendar((params as UnsyncFromCalendarInput).caseId, false, token);
    case 'markNotificationRead': {
      const id = (params as MarkNotificationReadInput).notificationId;
      if (!CONVEX_ID.test(id)) return badId('notification');
      return { kind: 'plan', toolName, args: { notificationId: id }, description: 'Mark a notification as read', changes: [] };
    }
    case 'deleteNotification': {
      const id = (params as DeleteNotificationInput).notificationId;
      if (!CONVEX_ID.test(id)) return badId('notification');
      return { kind: 'plan', toolName, args: { notificationId: id }, description: 'Delete a notification', changes: [] };
    }
    case 'markAllNotificationsRead':
      return { kind: 'plan', toolName, args: {}, description: 'Mark every notification as read', changes: [], permissionType: 'destructive' };
    case 'clearAllNotifications':
      return {
        kind: 'plan',
        toolName,
        args: {},
        description: 'Delete every read notification',
        changes: ['Unread notifications stay.'],
        warning: "Deleted notifications can't be brought back.",
        permissionType: 'destructive',
      };
    case 'updateSettings':
      return prepareSettings(params as UpdateSettingsInput);
    case 'bulkUpdateStatus':
      return prepareBulkStatus(params as BulkUpdateStatusInput, token);
    case 'bulkArchiveCases':
      return prepareBulkArchive(params as BulkArchiveCasesInput, token);
    case 'bulkDeleteCases':
      return prepareBulkDelete(params as BulkDeleteCasesInput, token);
    case 'bulkCalendarSync':
      return prepareBulkCalendar(params as BulkCalendarSyncInput, token);
    case 'createJobDescriptionTemplate': {
      const t = params as CreateJobDescriptionTemplateInput;
      return {
        kind: 'plan',
        toolName,
        args: { name: t.name, description: t.description },
        description: `Save a job description template: ${t.name}`,
        changes: [`${t.description.length.toLocaleString('en-US')} characters`],
      };
    }
    case 'updateJobDescriptionTemplate': {
      const t = params as UpdateJobDescriptionTemplateInput;
      if (!CONVEX_ID.test(t.templateId)) return badId('template');
      if (!t.name && !t.description) return { kind: 'answer', response: { changed: false, message: 'Nothing to change: send a new name or description.' } };
      const existing = await fetchQuery(api.jobDescriptionTemplates.get, { id: t.templateId as Id<'jobDescriptionTemplates'> }, { token }).catch(() => null);
      if (!existing) return { kind: 'answer', response: { error: "That template wasn't found.", suggestion: 'List templates with listJobDescriptionTemplates.' } };
      return {
        kind: 'plan',
        toolName,
        args: { id: t.templateId, name: t.name ?? existing.name, description: t.description ?? existing.description },
        description: `Change the job description template ${existing.name}`,
        changes: [
          ...(t.name && t.name !== existing.name ? [`Name: ${existing.name} to ${t.name}`] : []),
          ...(t.description ? [`Description: ${t.description.length.toLocaleString('en-US')} characters`] : []),
        ],
      };
    }
    case 'deleteJobDescriptionTemplate': {
      const t = params as DeleteJobDescriptionTemplateInput;
      if (!CONVEX_ID.test(t.templateId)) return badId('template');
      const existing = await fetchQuery(api.jobDescriptionTemplates.get, { id: t.templateId as Id<'jobDescriptionTemplates'> }, { token }).catch(() => null);
      if (!existing) return { kind: 'answer', response: { error: "That template wasn't found." } };
      return {
        kind: 'plan',
        toolName,
        args: { id: t.templateId },
        description: `Delete the job description template ${existing.name}`,
        changes: ["Cases that used it keep their job description."],
        permissionType: 'confirm',
      };
    }
  }
}

function outcome(ok: boolean, message: string, extra: Record<string, unknown> = {}): ActionOutcome {
  return { ok, result: { success: ok, message, ...extra }, summary: message };
}

interface BulkResult {
  successCount: number;
  failedCount: number;
  unchangedCount?: number;
  errors?: string[];
}

function bulkMessage(verb: string, r: BulkResult, asked: number): string {
  const parts = [`${verb} ${r.successCount} of ${asked} case${asked === 1 ? '' : 's'}`];
  if (r.unchangedCount) parts.push(`${r.unchangedCount} already were`);
  if (r.failedCount) parts.push(`${r.failedCount} failed`);
  return `${parts.join('; ')}.`;
}

/** Run a plan's stored arguments and report what the data says afterwards. */
export async function runAction(toolName: string, args: Args, token: string): Promise<ActionOutcome> {
  switch (toolName) {
    case 'updateCase':
      return runUpdateCase(args, token);
    case 'createCase':
      return runCreateCase(args, token);
    case 'archiveCase':
    case 'bulkUpdateStatus':
    case 'bulkArchiveCases': {
      const ids = args.ids as Id<'cases'>[];
      const r = await fetchMutation(
        api.cases.bulkUpdateStatus,
        { ids, status: args.status as 'closed', ...(args.closureReason ? { closureReason: args.closureReason as 'manual' } : {}) },
        { token },
      );
      const verb = args.status === 'closed' ? 'Closed' : 'Changed';
      if (toolName === 'archiveCase') {
        const after = await readCase(ids[0]!, token);
        const ok = after?.caseStatus === 'closed';
        return outcome(ok, ok ? `Closed ${caseLabel(after!)}. It can be reopened.` : "The case wasn't closed. Open it to check.", {
          caseId: ids[0],
          action: 'case_closed',
          stage: after ? stageWords(after.caseStatus, after.progressStatus) : undefined,
        });
      }
      const stages = (r.results ?? []).map((x) => stageWords(x.caseStatus, x.progressStatus));
      return outcome(r.failedCount === 0, bulkMessage(verb, r, ids.length), {
        action: toolName === 'bulkArchiveCases' ? 'bulk_closed' : 'bulk_status_updated',
        successCount: r.successCount,
        failedCount: r.failedCount,
        unchangedCount: r.unchangedCount,
        stages,
        errors: r.errors,
      });
    }
    case 'reopenCase': {
      const r = await fetchMutation(api.cases.reopenCase, { id: args.id as Id<'cases'> }, { token });
      const after = await readCase(String(args.id), token);
      const stage = stageWords(r.newCaseStatus, r.newProgressStatus);
      return outcome(true, `Reopened ${after ? caseLabel(after) : 'the case'} at ${stage}.`, { caseId: args.id, action: 'reopened', stage });
    }
    case 'deleteCase': {
      const before = await readCase(String(args.id), token);
      await fetchMutation(api.cases.remove, { id: args.id as Id<'cases'> }, { token });
      const gone = (await readCase(String(args.id), token)) === null;
      return outcome(gone, gone ? `Deleted ${before ? caseLabel(before) : 'the case'} for good.` : "The case wasn't deleted.", {
        caseId: args.id,
        action: 'permanently_deleted',
      });
    }
    case 'syncToCalendar':
    case 'unsyncFromCalendar': {
      const enable = toolName === 'syncToCalendar';
      await fetchMutation(enable ? api.cases.enableCalendarSync : api.cases.disableCalendarSync, { id: args.id as Id<'cases'> }, { token });
      const after = await readCase(String(args.id), token);
      const ok = Boolean(after?.calendarSyncEnabled) === enable;
      return outcome(
        ok,
        ok
          ? enable
            ? `Calendar sync is on for ${caseLabel(after!)}. Its deadlines are being added to Google Calendar.`
            : `Calendar sync is off for ${caseLabel(after!)}. Its events are being removed from Google Calendar.`
          : "The calendar setting didn't change. Open the case to check.",
        { caseId: args.id, calendarSyncEnabled: after?.calendarSyncEnabled, action: enable ? 'calendar_sync_enabled' : 'calendar_sync_disabled' },
      );
    }
    case 'bulkCalendarSync': {
      const ids = args.ids as Id<'cases'>[];
      const enabled = Boolean(args.calendarSyncEnabled);
      const r = await fetchMutation(api.cases.bulkUpdateCalendarSync, { ids, calendarSyncEnabled: enabled }, { token });
      return outcome(r.failedCount === 0, bulkMessage(enabled ? 'Turned on calendar sync for' : 'Turned off calendar sync for', r, ids.length), {
        action: enabled ? 'bulk_calendar_sync_enabled' : 'bulk_calendar_sync_disabled',
        successCount: r.successCount,
        failedCount: r.failedCount,
      });
    }
    case 'bulkDeleteCases': {
      const ids = args.ids as Id<'cases'>[];
      const r = await fetchMutation(api.cases.bulkRemove, { ids }, { token });
      return outcome(r.failedCount === 0, `${bulkMessage('Deleted', r, ids.length)} This can't be undone.`, {
        action: 'bulk_permanently_deleted',
        successCount: r.successCount,
        failedCount: r.failedCount,
      });
    }
    case 'markNotificationRead':
      await fetchMutation(api.notifications.markAsRead, { notificationId: args.notificationId as Id<'notifications'> }, { token });
      return outcome(true, 'Marked the notification as read.', { action: 'notification_marked_read' });
    case 'deleteNotification':
      await fetchMutation(api.notifications.deleteNotification, { notificationId: args.notificationId as Id<'notifications'> }, { token });
      return outcome(true, 'Deleted the notification.', { action: 'notification_deleted' });
    case 'markAllNotificationsRead': {
      const r = await fetchMutation(api.notifications.markAllAsRead, {}, { token });
      return outcome(true, `Marked ${r.count} notification${r.count === 1 ? '' : 's'} as read.`, { action: 'all_notifications_marked_read', count: r.count });
    }
    case 'clearAllNotifications': {
      const r = await fetchMutation(api.notifications.deleteAllRead, {}, { token });
      return outcome(true, `Deleted ${r.count} read notification${r.count === 1 ? '' : 's'}.`, { action: 'all_read_notifications_cleared', count: r.count });
    }
    case 'updateSettings': {
      await fetchMutation(api.users.updateUserProfile, args as Parameters<typeof fetchMutation<typeof api.users.updateUserProfile>>[1], { token });
      const profile = (await fetchQuery(api.users.currentUserProfile, {}, { token }).catch(() => null)) as Args | null;
      const notSaved = profile
        ? Object.entries(args).filter(([k, v]) => JSON.stringify(profile[k]) !== JSON.stringify(v)).map(([k]) => SETTING_WORDS[k] ?? k)
        : [];
      const saved = Object.entries(args).map(([k, v]) => `${SETTING_WORDS[k] ?? k}: ${settingWords(v)}`);
      return outcome(
        notSaved.length === 0,
        notSaved.length === 0 ? `Settings saved. ${saved.join('; ')}.` : `Some settings didn't save: ${notSaved.join(', ')}.`,
        { action: 'settings_updated', saved, notSaved },
      );
    }
    case 'createJobDescriptionTemplate': {
      const id = await fetchMutation(api.jobDescriptionTemplates.create, { name: String(args.name), description: String(args.description) }, { token });
      return outcome(true, `Saved the template ${String(args.name)}.`, { templateId: id, action: 'template_created' });
    }
    case 'updateJobDescriptionTemplate': {
      await fetchMutation(
        api.jobDescriptionTemplates.update,
        { id: args.id as Id<'jobDescriptionTemplates'>, name: String(args.name), description: String(args.description) },
        { token },
      );
      return outcome(true, `Updated the template ${String(args.name)}.`, { templateId: args.id, action: 'template_updated' });
    }
    case 'deleteJobDescriptionTemplate': {
      await fetchMutation(api.jobDescriptionTemplates.remove, { id: args.id as Id<'jobDescriptionTemplates'> }, { token });
      return outcome(true, 'Deleted the template.', { templateId: args.id, action: 'template_deleted' });
    }
    default:
      return outcome(false, `Unknown action: ${toolName}`);
  }
}
