import { describe, it, expect } from 'vitest';
import {
  getTodayISO,
  parseAndValidateDate,
  validateDateOrder,
  validateDateAfter,
  error,
  warning,
  mergeResults,
  composeValidators,
  result,
} from '../validation';
import { createValidationResult } from '../../types';
import { parseISO } from 'date-fns';

describe('getTodayISO', () => {
  it('returns a valid ISO date string', () => {
    const today = getTodayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('parseAndValidateDate', () => {
  it('parses a valid date', () => {
    const result = parseAndValidateDate({ value: '2024-06-15', fieldName: 'test', ruleId: 'R-1' });
    expect(result.date).toBeTruthy();
    expect(result.error).toBeNull();
  });

  it('returns error for invalid date', () => {
    const result = parseAndValidateDate({ value: 'not-a-date', fieldName: 'test', ruleId: 'R-1' });
    expect(result.date).toBeNull();
    expect(result.error).toMatchObject({
      ruleId: 'R-1',
      severity: 'error',
      field: 'test',
    });
  });
});

describe('validateDateOrder', () => {
  it('returns null when A is before B', () => {
    const a = parseISO('2024-01-01');
    const b = parseISO('2024-06-01');
    const issue = validateDateOrder(a, b, { ruleId: 'R-1', field: 'test', message: 'Order wrong' });
    expect(issue).toBeNull();
  });

  it('returns error when A is after B', () => {
    const a = parseISO('2024-06-01');
    const b = parseISO('2024-01-01');
    const issue = validateDateOrder(a, b, { ruleId: 'R-1', field: 'test', message: 'Order wrong' });
    expect(issue).toMatchObject({ severity: 'error', ruleId: 'R-1' });
  });
});

describe('validateDateAfter', () => {
  it('returns null when A is after B', () => {
    const a = parseISO('2024-06-01');
    const b = parseISO('2024-01-01');
    expect(validateDateAfter(a, b, { ruleId: 'R-1', field: 'test', message: 'Not after' })).toBeNull();
  });

  it('returns error when A is before B', () => {
    const a = parseISO('2024-01-01');
    const b = parseISO('2024-06-01');
    const issue = validateDateAfter(a, b, { ruleId: 'R-1', field: 'test', message: 'Not after' });
    expect(issue).toMatchObject({ severity: 'error' });
  });
});

describe('error / warning builders', () => {
  it('creates error issue', () => {
    const e = error('R-1', 'pwd_filing_date', 'Required', '20 CFR 656.40');
    expect(e).toEqual({ ruleId: 'R-1', severity: 'error', field: 'pwd_filing_date', message: 'Required', regulation: '20 CFR 656.40' });
  });

  it('creates warning issue', () => {
    const w = warning('R-2', 'pwd_expiration_date', 'Expires soon');
    expect(w).toEqual({ ruleId: 'R-2', severity: 'warning', field: 'pwd_expiration_date', message: 'Expires soon', regulation: undefined });
  });
});

describe('mergeResults', () => {
  it('merges errors and warnings from multiple results', () => {
    const r1 = createValidationResult([error('R-1', 'a', 'err1')], []);
    const r2 = createValidationResult([], [warning('R-2', 'b', 'warn1')]);
    const merged = mergeResults([r1, r2]);
    expect(merged.errors).toHaveLength(1);
    expect(merged.warnings).toHaveLength(1);
    expect(merged.valid).toBe(false);
  });

  it('returns valid when no errors', () => {
    const r1 = createValidationResult([], [warning('R-1', 'a', 'warn')]);
    const merged = mergeResults([r1]);
    expect(merged.valid).toBe(true);
  });
});

describe('composeValidators', () => {
  it('composes multiple validators', () => {
    const v1 = () => createValidationResult([error('R-1', 'a', 'err')], []);
    const v2 = () => createValidationResult([], [warning('R-2', 'b', 'warn')]);
    const composed = composeValidators(v1, v2);
    const r = composed(null);
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toHaveLength(1);
  });
});

describe('result', () => {
  it('creates ValidationResult from arrays', () => {
    const r = result([error('R-1', 'a', 'err')], [warning('R-2', 'b', 'warn')]);
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toHaveLength(1);
  });

  it('defaults warnings to empty', () => {
    const r = result([]);
    expect(r.valid).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });
});
