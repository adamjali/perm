import { describe, expect, it } from 'vitest';
import {
  calculateBalcaRequestDeadline,
  calculateDenialReviewDeadline,
  denialReviewDeadline,
  denialReviewStep,
} from './denialReview';
import { DENIAL_REVIEW_DAYS } from '../constants';
import { calculateAutoStatus } from '../statusCalculation';
import { extractActiveDeadlines } from '../deadlines/extractActiveDeadlines';
import { isDeadlineActive } from '../deadlines/isDeadlineActive';
import { validateDenialReview } from '../validators/denialReview';
import type { CaseDataForDeadlines } from '../deadlines/types';

/**
 * An ETA 9089 denial: 30 calendar days from the date on DOL's Final
 * Determination letter to ask for ONE of reconsideration (20 CFR 656.24(g)) or
 * BALCA review (656.26); after a reconsideration that upholds the denial, 30
 * days from that notice to ask BALCA (DOL's PERM FAQ Round 14, question 3).
 */
const filed = {
  caseStatus: 'eta9089' as const,
  progressStatus: 'filed' as const,
  pwdFilingDate: '2025-06-02',
  pwdDeterminationDate: '2025-08-01',
  eta9089FilingDate: '2025-11-10',
};
const denied = { ...filed, eta9089DenialDate: '2026-03-02' };

describe('the 30 days', () => {
  it('is 30 calendar days, the rule the regulation and DOL state', () => {
    expect(DENIAL_REVIEW_DAYS).toBe(30);
  });

  it('counts from the date on the letter, weekends included and never moved', () => {
    expect(calculateDenialReviewDeadline('2026-03-02')).toBe('2026-04-01');
    // Jan 31 + 30 crosses a 28-day February.
    expect(calculateDenialReviewDeadline('2026-01-31')).toBe('2026-03-02');
    // A deadline landing on a Saturday stays on the Saturday.
    expect(calculateDenialReviewDeadline('2026-02-05')).toBe('2026-03-07');
    expect(calculateBalcaRequestDeadline('2026-06-01')).toBe('2026-07-01');
  });
});

describe('where a denied case stands', () => {
  it('has no step until denied, and none once a certification reverses the denial', () => {
    expect(denialReviewStep({ ...filed, eta9089DenialDate: null })).toBeNull();
    expect(denialReviewStep({ ...denied, eta9089CertificationDate: '2026-05-01' })).toBeNull();
  });

  it('walks request, reconsideration, the upheld notice and BALCA', () => {
    expect(denialReviewStep(denied)).toBe('request-review');
    expect(denialReviewStep({ ...denied, eta9089ReconsiderationDate: '2026-03-20' })).toBe('reconsidering');
    expect(
      denialReviewStep({ ...denied, eta9089ReconsiderationDate: '2026-03-20', eta9089ReconsiderationDeniedDate: '2026-06-01' }),
    ).toBe('request-balca');
    expect(denialReviewStep({ ...denied, eta9089BalcaRequestDate: '2026-03-25' })).toBe('at-balca');
  });

  it('sets a deadline only where one is owed', () => {
    expect(denialReviewDeadline(denied)).toEqual({ kind: 'review', date: '2026-04-01' });
    expect(denialReviewDeadline({ ...denied, eta9089ReconsiderationDate: '2026-03-20' })).toBeNull();
    expect(
      denialReviewDeadline({ ...denied, eta9089ReconsiderationDate: '2026-03-20', eta9089ReconsiderationDeniedDate: '2026-06-01' }),
    ).toEqual({ kind: 'balca', date: '2026-07-01' });
    expect(denialReviewDeadline({ ...denied, eta9089BalcaRequestDate: '2026-03-25' })).toBeNull();
  });
});

describe("the case's stage", () => {
  it('stays in the ETA 9089 stage, working while a request is owed and under review once asked', () => {
    expect(calculateAutoStatus(denied)).toEqual({ caseStatus: 'eta9089', progressStatus: 'working' });
    expect(calculateAutoStatus({ ...denied, eta9089ReconsiderationDate: '2026-03-20' })).toEqual({
      caseStatus: 'eta9089',
      progressStatus: 'under_review',
    });
    expect(
      calculateAutoStatus({ ...denied, eta9089ReconsiderationDate: '2026-03-20', eta9089ReconsiderationDeniedDate: '2026-06-01' }),
    ).toEqual({ caseStatus: 'eta9089', progressStatus: 'working' });
    expect(calculateAutoStatus({ ...denied, eta9089BalcaRequestDate: '2026-03-25' })).toEqual({
      caseStatus: 'eta9089',
      progressStatus: 'under_review',
    });
  });

  it('moves on to the I-140 when a certification reverses the denial', () => {
    expect(calculateAutoStatus({ ...denied, eta9089BalcaRequestDate: '2026-03-25', eta9089CertificationDate: '2026-09-01' })).toEqual({
      caseStatus: 'i140',
      progressStatus: 'working',
    });
  });

  it('still lets an open RFI lead', () => {
    expect(
      calculateAutoStatus({ ...denied, rfiEntries: [{ receivedDate: '2026-01-05' }] }).progressStatus,
    ).toBe('rfi_rfe');
  });
});

describe('the deadlines every surface reads', () => {
  const TODAY = '2026-03-15';
  const types = (c: CaseDataForDeadlines) => extractActiveDeadlines(c, TODAY).map((d) => [d.type, d.date, d.daysUntil]);

  it('owes a reconsideration or BALCA request 30 days after the denial', () => {
    expect(types(denied)).toEqual([['denial_review_due', '2026-04-01', 17]]);
  });

  it('owes nothing while reconsideration is pending, then BALCA 30 days after the upheld notice', () => {
    expect(types({ ...denied, eta9089ReconsiderationDate: '2026-03-20' })).toEqual([]);
    expect(
      extractActiveDeadlines(
        { ...denied, eta9089ReconsiderationDate: '2026-03-20', eta9089ReconsiderationDeniedDate: '2026-06-01' },
        '2026-06-10',
      ).map((d) => [d.type, d.date, d.timezoneRule]),
    ).toEqual([['balca_request_due', '2026-07-01', 'dol']]);
  });

  it('owes nothing at BALCA, after a reversal, or on a closed case', () => {
    expect(types({ ...denied, eta9089BalcaRequestDate: '2026-03-25' })).toEqual([]);
    expect(types({ ...denied, eta9089CertificationDate: '2026-03-10', eta9089ExpirationDate: '2026-09-05' }).map((t) => t[0])).toEqual([
      'i140_filing_deadline',
    ]);
    expect(isDeadlineActive('denial_review_due', { ...denied, caseStatus: 'closed' }).isActive).toBe(false);
  });

  it('keeps a missed request on the list as overdue', () => {
    expect(extractActiveDeadlines(denied, '2026-04-05')[0]).toMatchObject({ type: 'denial_review_due', daysUntil: -4 });
  });
});

describe('the dates a case can hold', () => {
  const v = (extra: Record<string, string>) =>
    validateDenialReview({ eta9089_filing_date: '2025-11-10', eta9089_denial_date: '2026-03-02', ...extra });

  it('accepts a request made inside the 30 days', () => {
    const r = v({ eta9089_reconsideration_date: '2026-03-20' });
    expect(r.valid).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it('refuses dates out of order', () => {
    expect(validateDenialReview({ eta9089_filing_date: '2025-11-10', eta9089_denial_date: '2025-11-01' }).errors[0]?.ruleId).toBe('V-DEN-01');
    expect(v({ eta9089_reconsideration_date: '2026-02-20' }).errors[0]?.ruleId).toBe('V-DEN-02');
    expect(
      v({ eta9089_reconsideration_date: '2026-03-20', eta9089_reconsideration_denied_date: '2026-06-01', eta9089_balca_request_date: '2026-05-01' })
        .errors[0]?.field,
    ).toBe('eta9089_balca_request_date');
  });

  it('warns on a late request and on asking for both at once', () => {
    expect(v({ eta9089_balca_request_date: '2026-04-02' }).warnings.map((w) => w.ruleId)).toEqual(['V-DEN-03']);
    expect(
      v({ eta9089_reconsideration_date: '2026-03-20', eta9089_reconsideration_denied_date: '2026-06-01', eta9089_balca_request_date: '2026-07-02' })
        .warnings.map((w) => w.ruleId),
    ).toEqual(['V-DEN-03']);
    expect(v({ eta9089_reconsideration_date: '2026-03-20', eta9089_balca_request_date: '2026-03-21' }).warnings.map((w) => w.ruleId)).toEqual([
      'V-DEN-04',
    ]);
  });
});
