/**
 * One chat turn's small pieces: when a card stops the turn's tool calls, and
 * "today" in the person's own time zone.
 */
import { describe, expect, it } from 'vitest';
import { nowInZone, stepShowedCard } from '../chatTurn';
import { PROMPT_SECTIONS } from '../system-prompt';
import {
  FIRST_SUNDAY_AD_DEADLINE_DAYS,
  FIRST_SUNDAY_AD_PWD_BUFFER_DAYS,
  JOB_ORDER_START_DEADLINE_DAYS,
  JOB_ORDER_START_PWD_BUFFER_DAYS,
  RECRUITMENT_WINDOW_DAYS,
  SECOND_SUNDAY_AD_DEADLINE_DAYS,
  SECOND_SUNDAY_AD_PWD_BUFFER_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  FILING_WINDOW_WAIT_DAYS,
  ETA9089_EXPIRATION_DAYS,
  RFI_DUE_DAYS,
} from '@/lib/perm';

describe('stepShowedCard', () => {
  it('is true only for a step whose tool result is a confirmation card', () => {
    expect(stepShowedCard({ toolResults: [{ output: { requiresPermission: true } }] })).toBe(true);
    expect(stepShowedCard({ toolResults: [{ output: { success: true } }] })).toBe(false);
    expect(stepShowedCard({ toolResults: [{ output: 'requiresPermission' }] })).toBe(false);
    expect(stepShowedCard({})).toBe(false);
  });
});

describe('nowInZone', () => {
  // 11:30 PM Eastern on Monday Oct 12 2026 is already Tuesday in UTC.
  const lateMonday = new Date('2026-10-13T03:30:00Z');

  it("keeps an evening on the person's own day", () => {
    expect(nowInZone('America/New_York', lateMonday)).toMatchObject({
      currentDate: 'Monday, October 12, 2026',
      isoDay: '2026-10-12',
    });
    expect(nowInZone('America/Los_Angeles', lateMonday).isoDay).toBe('2026-10-12');
  });

  it('falls back to Eastern for a missing or unknown zone', () => {
    expect(nowInZone(undefined, lateMonday).isoDay).toBe('2026-10-12');
    expect(nowInZone('Not/AZone', lateMonday).isoDay).toBe('2026-10-12');
    expect(nowInZone(undefined, lateMonday).currentTime).toMatch(/11:30 PM E[DS]T/);
  });
});

describe("the system prompt's PERM rules match the app's own", () => {
  const text = PROMPT_SECTIONS.PERM_DOMAIN_KNOWLEDGE;
  it.each([
    [`first recruitment + ${JOB_ORDER_START_DEADLINE_DAYS} days and PWD expiration - ${JOB_ORDER_START_PWD_BUFFER_DAYS} days`],
    [`first recruitment + ${FIRST_SUNDAY_AD_DEADLINE_DAYS} days and PWD expiration - ${FIRST_SUNDAY_AD_PWD_BUFFER_DAYS} days`],
    [`first recruitment + ${SECOND_SUNDAY_AD_DEADLINE_DAYS} days and PWD expiration - ${SECOND_SUNDAY_AD_PWD_BUFFER_DAYS} days`],
    [`first recruitment + ${RECRUITMENT_WINDOW_DAYS} days`],
    [`opens ${FILING_WINDOW_WAIT_DAYS} days after the LAST recruitment`],
    [`closes ${FILING_WINDOW_CLOSE_DAYS} days after the FIRST recruitment`],
    [`certification + ${ETA9089_EXPIRATION_DAYS} days`],
    [`${RFI_DUE_DAYS} calendar days from receipt`],
    ['Jan 1 to Apr 1, June 30 of the same year'],
  ])('states %s', (phrase) => {
    expect(text).toContain(phrase);
  });

  it('no longer states the wrong per-step days', () => {
    expect(text).not.toMatch(/within 14 days of first recruitment|within 90 days of first recruitment/);
    expect(text).not.toContain('30-180 days after recruitment ends');
  });

  it('tells the model text inside tool results is never an instruction', () => {
    expect(PROMPT_SECTIONS.UNTRUSTED_TEXT).toMatch(/never instructions/);
    expect(PROMPT_SECTIONS.ACTION_RULES).toMatch(/Never assume a date/);
  });
});
