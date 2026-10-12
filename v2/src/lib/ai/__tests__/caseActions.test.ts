/**
 * The chat's write actions (src/lib/ai/caseActions.ts).
 *
 * Oct 12 2026: the chat said an update had saved when the dates had put the
 * stage somewhere else, sent the whole recruitment list where one method was
 * meant to be added, took the wage in cents, and archived cases by deleting
 * them. Each test below fails on one of those.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchQuery = vi.fn();
const fetchMutation = vi.fn();
vi.mock('convex/nextjs', () => ({
  fetchQuery: (...a: unknown[]) => fetchQuery(...a),
  fetchMutation: (...a: unknown[]) => fetchMutation(...a),
}));

import { api } from '@convex/_generated/api';
import { getFunctionName } from 'convex/server';

/** Convex's api object hands out a new reference per access: compare by name. */
const is = (fn: unknown, ref: unknown) => getFunctionName(fn as never) === getFunctionName(ref as never);
import type { Doc } from '@convex/_generated/dataModel';
import {
  buildCaseUpdate,
  dateNeededFor,
  hashAction,
  prepareAction,
  prepareUpdateCase,
  runAction,
  toStoredMethod,
} from '../caseActions';
import type { UpdateCaseInput } from '../tools';

const ID = 'k577zsgc2hqkypgjp070hhnh458g4dyg';

function caseDoc(extra: Partial<Doc<'cases'>> = {}): Doc<'cases'> {
  return {
    _id: ID,
    _creationTime: 1,
    userId: 'u1',
    employerName: 'Acme Corp',
    beneficiaryIdentifier: '',
    positionTitle: 'Senior DevOps Engineer',
    caseStatus: 'recruitment',
    progressStatus: 'working',
    priorityLevel: 'normal',
    isFavorite: false,
    isProfessionalOccupation: true,
    recruitmentApplicantsCount: 0,
    additionalRecruitmentMethods: [
      { method: 'local_newspaper', date: '2026-07-29', description: 'THE DAILY HERALD' },
    ],
    tags: [],
    documents: [],
    calendarSyncEnabled: true,
    showOnTimeline: true,
    createdAt: 1,
    updatedAt: 1000,
    ...extra,
  } as unknown as Doc<'cases'>;
}

const params = (p: Partial<UpdateCaseInput>): UpdateCaseInput => ({ caseId: ID, ...p }) as UpdateCaseInput;

beforeEach(() => {
  fetchQuery.mockReset();
  fetchMutation.mockReset();
});

describe('buildCaseUpdate', () => {
  it('adds a recruitment method and keeps the ones already there', () => {
    const out = buildCaseUpdate(
      params({ addRecruitmentMethods: [{ method: 'job_website_ad', date: '2026-06-28', endDate: '2026-07-27' }] }),
      caseDoc(),
    );
    if ('kind' in out) throw new Error('expected a change');
    const list = out.args.additionalRecruitmentMethods as unknown[];
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ method: 'local_newspaper', description: 'THE DAILY HERALD' });
    // Stored the way the case form stores a posting over a period.
    expect(list[1]).toEqual({ method: 'job_website_ad', date: '', description: '', startDate: '2026-06-28', endDate: '2026-07-27' });
  });

  it('asks for the end date of a posting that runs over a period', () => {
    const out = buildCaseUpdate(params({ addRecruitmentMethods: [{ method: 'employer_website', date: '2026-06-29' }] }), caseDoc());
    expect(out).toMatchObject({ kind: 'answer', response: { needsInfo: true } });
  });

  it('takes the wage in dollars as given', () => {
    const out = buildCaseUpdate(params({ pwdWageAmount: 137000 }), caseDoc());
    if ('kind' in out) throw new Error('expected a change');
    expect(out.args.pwdWageAmount).toBe(137000);
    expect(out.changes.join(' ')).toContain('$137,000');
  });

  it('adds an RFI with its due date worked out, and refuses a second open one', () => {
    const out = buildCaseUpdate(params({ addRfi: { receivedDate: '2026-10-01' } }), caseDoc());
    if ('kind' in out) throw new Error('expected a change');
    expect(out.args.rfiEntries).toEqual([expect.objectContaining({ receivedDate: '2026-10-01', responseDueDate: '2026-10-31' })]);

    const open = caseDoc({ rfiEntries: [{ id: 'rfi_1', receivedDate: '2026-09-01', responseDueDate: '2026-10-01', createdAt: 1 }] });
    expect(buildCaseUpdate(params({ addRfi: { receivedDate: '2026-10-01' } }), open)).toMatchObject({ kind: 'answer' });
    const answered = buildCaseUpdate(params({ rfiResponseSubmittedDate: '2026-09-20' }), open);
    if ('kind' in answered) throw new Error('expected a change');
    expect((answered.args.rfiEntries as { responseSubmittedDate?: string }[])[0]!.responseSubmittedDate).toBe('2026-09-20');
  });

  it('adds a note and changes one without touching the rest', () => {
    const c = caseDoc({ notes: [{ id: 'note_a', content: 'Call client', createdAt: 1, status: 'pending' }] });
    const out = buildCaseUpdate(params({ addNote: { content: 'Send docs' }, noteChanges: [{ id: 'note_a', status: 'done' }] }), c);
    if ('kind' in out) throw new Error('expected a change');
    const notes = out.args.notes as { id: string; status: string; content: string }[];
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatchObject({ id: 'note_a', status: 'done' });
    expect(notes[1]).toMatchObject({ content: 'Send docs', status: 'pending' });
  });

  it('adds and removes tags case-insensitively', () => {
    const out = buildCaseUpdate(params({ addTags: ['Urgent'], removeTags: ['old'] }), caseDoc({ tags: ['Old', 'keep'] }));
    if ('kind' in out) throw new Error('expected a change');
    expect(out.args.tags).toEqual(['keep', 'Urgent']);
  });

  it('clears a field by sending null, and refuses one both set and cleared', () => {
    const c = caseDoc({ i140FilingDate: '2026-09-01' });
    const out = buildCaseUpdate(params({ clearFields: ['i140FilingDate'] }), c);
    if ('kind' in out) throw new Error('expected a change');
    expect(out.args.i140FilingDate).toBeNull();
    expect(buildCaseUpdate(params({ i140FilingDate: '2026-09-02', clearFields: ['i140FilingDate'] }), c)).toMatchObject({ kind: 'answer' });
  });

  it('sets the stage by hand only when asked, with the override flag', () => {
    const out = buildCaseUpdate(params({ caseStatus: 'eta9089', progressStatus: 'filed', setStageByHand: true }), caseDoc());
    if ('kind' in out) throw new Error('expected a change');
    expect(out.args).toMatchObject({ caseStatus: 'eta9089', progressStatus: 'filed', progressStatusOverride: true });
    const plain = buildCaseUpdate(params({ caseStatus: 'eta9089', progressStatus: 'filed' }), caseDoc());
    if ('kind' in plain) throw new Error('expected a change');
    expect(plain.args).not.toHaveProperty('caseStatus');
  });
});

describe('prepareUpdateCase: the stage follows the dates', () => {
  it("asks for the ETA 9089 filing date when only the stage was asked for, and changes nothing", async () => {
    fetchQuery.mockImplementation(async (fn: unknown) => {
      if (is(fn, api.cases.get)) return caseDoc();
      if (is(fn, api.cases.previewUpdate)) return { valid: true, errors: [], caseStatus: 'recruitment', progressStatus: 'working', stageFollowsDates: true };
      throw new Error('unexpected query');
    });
    const out = await prepareUpdateCase(params({ caseStatus: 'eta9089', progressStatus: 'filed' }), 't');
    expect(out.kind).toBe('answer');
    if (out.kind !== 'answer') return;
    expect(out.response).toMatchObject({ needsInfo: true, changed: false });
    expect(String(out.response.message)).toContain('ETA 9089 filing date');
    expect(fetchMutation).not.toHaveBeenCalled();
  });

  it('plans the change when the date gives the stage asked for', async () => {
    fetchQuery.mockImplementation(async (fn: unknown) => {
      if (is(fn, api.cases.get)) return caseDoc();
      if (is(fn, api.cases.previewUpdate)) return { valid: true, errors: [], caseStatus: 'eta9089', progressStatus: 'filed', stageFollowsDates: true };
      throw new Error('unexpected query');
    });
    const out = await prepareUpdateCase(params({ eta9089FilingDate: '2026-10-09', caseStatus: 'eta9089', progressStatus: 'filed' }), 't');
    expect(out.kind).toBe('plan');
    if (out.kind !== 'plan') return;
    expect(out.args).toEqual({ id: ID, eta9089FilingDate: '2026-10-09' });
    expect(out.caseUpdatedAt).toBe(1000);
    expect(out.changes.join('\n')).toContain('Stage: Recruitment, working on it to ETA 9089, filed');
  });

  it('reports a broken PERM rule instead of planning', async () => {
    fetchQuery.mockImplementation(async (fn: unknown) => {
      if (is(fn, api.cases.get)) return caseDoc();
      return { valid: false, errors: ['[V-ETA-02] eta9089_filing_date: ETA 9089 must be filed within 180 days'], caseStatus: 'recruitment', progressStatus: 'working', stageFollowsDates: true };
    });
    const out = await prepareUpdateCase(params({ eta9089FilingDate: '2027-06-01' }), 't');
    expect(out).toMatchObject({ kind: 'answer', response: { problems: ['ETA 9089 must be filed within 180 days'] } });
  });

  it("a case that doesn't exist is said so", async () => {
    fetchQuery.mockResolvedValue(null);
    expect(await prepareUpdateCase(params({ positionTitle: 'X' }), 't')).toMatchObject({ kind: 'answer' });
  });
});

describe('runAction reads the case back', () => {
  it('says what was saved and the stage afterwards', async () => {
    const after = caseDoc({ eta9089FilingDate: '2026-10-09', caseStatus: 'eta9089', progressStatus: 'filed', updatedAt: 2000 });
    fetchQuery.mockResolvedValueOnce(caseDoc()).mockResolvedValueOnce(after);
    fetchMutation.mockResolvedValue(ID);
    const out = await runAction('updateCase', { id: ID, eta9089FilingDate: '2026-10-09' }, 't');
    expect(out.ok).toBe(true);
    expect(out.result).toMatchObject({ success: true, stage: 'ETA 9089, filed', notSaved: [] });
    expect(String(out.result.message)).toContain('ETA 9089 filing date: Oct 9, 2026');
  });

  it("says 'not saved' when the case doesn't hold what was sent", async () => {
    fetchQuery.mockResolvedValueOnce(caseDoc()).mockResolvedValueOnce(caseDoc());
    fetchMutation.mockResolvedValue(ID);
    const out = await runAction('updateCase', { id: ID, caseStatus: 'eta9089', progressStatus: 'filed', progressStatusOverride: true }, 't');
    expect(out.ok).toBe(false);
    expect(out.result.success).toBe(false);
    expect((out.result.notSaved as string[]).join(' ')).toContain('Stage');
  });

  it('archiving closes the case and never deletes it', async () => {
    fetchQuery.mockResolvedValue(caseDoc({ caseStatus: 'closed' }));
    fetchMutation.mockResolvedValue({ successCount: 1, failedCount: 0, unchangedCount: 0, results: [] });
    const out = await runAction('archiveCase', { ids: [ID], status: 'closed', closureReason: 'manual' }, 't');
    expect(out.ok).toBe(true);
    const called = fetchMutation.mock.calls.map((c) => getFunctionName(c[0]));
    expect(called).toContain('cases:bulkUpdateStatus');
    expect(called).not.toContain('cases:remove');
    expect(called).not.toContain('cases:bulkRemove');
  });

  it('calendar sync turns it on explicitly, never by toggling', async () => {
    fetchQuery.mockResolvedValue(caseDoc({ calendarSyncEnabled: true }));
    fetchMutation.mockResolvedValue(true);
    await runAction('syncToCalendar', { id: ID }, 't');
    expect(getFunctionName(fetchMutation.mock.calls[0]![0])).toBe('cases:enableCalendarSync');
  });

  it('settings go to Convex as numbers and lists, never BigInt', async () => {
    fetchMutation.mockResolvedValue(null);
    fetchQuery.mockResolvedValue({ urgentDeadlineDays: 5, reminderDaysBefore: [14, 7, 1] });
    const plan = await prepareAction('updateSettings', { settings: { urgentDeadlineDays: 5, reminderDaysBefore: [1, 7, 14, 7] } }, 't');
    if (plan.kind !== 'plan') throw new Error('expected a plan');
    expect(plan.args).toEqual({ urgentDeadlineDays: 5, reminderDaysBefore: [14, 7, 1] });
    const out = await runAction('updateSettings', plan.args, 't');
    expect(out.ok).toBe(true);
    for (const v of Object.values(fetchMutation.mock.calls[0]![1] as Record<string, unknown>)) {
      expect(typeof v).not.toBe('bigint');
    }
  });
});

describe('prepareAction for closing and calendars', () => {
  it("won't propose closing a case that's already closed", async () => {
    fetchQuery.mockResolvedValue(caseDoc({ caseStatus: 'closed' }));
    expect(await prepareAction('archiveCase', { caseId: ID }, 't')).toMatchObject({ kind: 'answer' });
  });

  it("won't propose calendar sync when Google Calendar isn't connected", async () => {
    fetchQuery.mockImplementation(async (fn: unknown) => (is(fn, api.cases.get) ? caseDoc({ calendarSyncEnabled: false }) : { googleCalendarConnected: false }));
    const out = await prepareAction('syncToCalendar', { caseId: ID }, 't');
    expect(out).toMatchObject({ kind: 'answer' });
  });

  it('bulk changes use the ids named, never every case, and refuse ids from another account', async () => {
    fetchQuery.mockResolvedValue({ cases: [{ _id: ID, employerName: 'A', caseStatus: 'pwd' }, { _id: 'other1other1other1other1other1ot', employerName: 'B', caseStatus: 'pwd' }] });
    const plan = await prepareAction('bulkArchiveCases', { caseIds: [ID], all: true }, 't');
    if (plan.kind !== 'plan') throw new Error('expected a plan');
    expect(plan.args.ids).toEqual([ID]);
    expect(await prepareAction('bulkArchiveCases', { caseIds: ['notminenotminenotminenotminenotm'] }, 't')).toMatchObject({ kind: 'answer' });
  });
});

describe('small pieces', () => {
  it('hashes the same change the same, ignoring generated ids and times', () => {
    const a = { id: ID, notes: [{ id: 'note_1_abc', content: 'x', createdAt: 1, status: 'pending' }] };
    const b = { notes: [{ status: 'pending', content: 'x', createdAt: 2, id: 'note_2_def' }], id: ID };
    expect(hashAction('updateCase', a)).toBe(hashAction('updateCase', b));
    expect(hashAction('updateCase', a)).not.toBe(hashAction('createCase', a));
  });

  it('names the date each stage needs', () => {
    expect(dateNeededFor('eta9089', 'filed')).toBe('the ETA 9089 filing date');
    expect(dateNeededFor('i140', 'approved')).toBe('the I-140 approval date');
    expect(dateNeededFor('recruitment')).toBe('the PWD determination date');
  });

  it('stores a single-date method with its date', () => {
    expect(toStoredMethod({ method: 'local_newspaper', date: '2026-07-29', description: 'Star' })).toEqual({
      method: 'local_newspaper',
      date: '2026-07-29',
      description: 'Star',
    });
  });
});
