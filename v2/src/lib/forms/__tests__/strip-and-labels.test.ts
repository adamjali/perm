import { describe, it, expect } from 'vitest';
import {
  stripIncompleteRecruitmentEntries,
  getFieldLabel,
  validateCaseForm,
  FIELD_LABELS,
  type CaseFormData,
} from '../case-form-schema';
import { mapFieldToInputName } from '../../../components/forms/case-form.helpers';

// Minimal valid form data factory
function createMinimalFormData(
  overrides: Record<string, unknown> = {}
): CaseFormData {
  return {
    employerName: 'Test Corp',
    beneficiaryIdentifier: 'John Doe',
    positionTitle: 'Engineer',
    caseStatus: 'pwd',
    progressStatus: 'working',
    progressStatusOverride: false,
    isProfessionalOccupation: false,
    additionalRecruitmentMethods: [],
    rfiEntries: [],
    rfeEntries: [],
    notes: [],
    tags: [],
    priorityLevel: 'normal',
    isFavorite: false,
    calendarSyncEnabled: true,
    showOnTimeline: true,
    recruitmentApplicantsCount: 0,
    ...overrides,
  } as CaseFormData;
}

// ============================================================================
// stripIncompleteRecruitmentEntries
// ============================================================================

describe('stripIncompleteRecruitmentEntries', () => {
  it('returns same data when no recruitment methods', () => {
    const data = createMinimalFormData({ additionalRecruitmentMethods: [] });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result).toBe(data);
  });

  it('returns same data when methods is undefined', () => {
    const data = createMinimalFormData({ additionalRecruitmentMethods: undefined });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result).toBe(data);
  });

  it('strips entries with no method type selected', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: '', date: '2024-06-01', description: 'leftover' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toEqual([]);
  });

  it('keeps entries with method selected even without dates (validation handles it)', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'radio_ad', date: '', description: '' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toHaveLength(1);
  });

  it('keeps entries with method and date', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'local_newspaper', date: '2024-06-01', description: 'Times' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result).toBe(data); // Same reference
  });

  it('keeps entries with method and sub-entries', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        {
          method: 'radio_ad',
          date: '',
          description: 'WNYC',
          subEntries: [{ date: '2024-06-15', description: 'Morning slot' }],
        },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result).toBe(data); // Same reference
  });

  it('strips only empty-method entries from mixed array', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'local_newspaper', date: '2024-06-01', description: 'Times' },
        { method: '', date: '', description: '' }, // empty slot
        { method: 'radio_ad', date: '', description: '' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toHaveLength(2);
    expect(result.additionalRecruitmentMethods![0]!.method).toBe('local_newspaper');
    expect(result.additionalRecruitmentMethods![1]!.method).toBe('radio_ad');
  });

  it('returns same reference when nothing stripped', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'local_newspaper', date: '2024-06-01', description: 'Times' },
        { method: 'job_website_ad', date: '', startDate: '2024-06-01', endDate: '2024-07-01' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result).toBe(data);
  });

  it('does not mutate original data', () => {
    const methods = [
      { method: 'local_newspaper', date: '2024-06-01', description: 'Times' },
      { method: '', date: '', description: '' },
    ];
    const data = createMinimalFormData({ additionalRecruitmentMethods: methods });
    stripIncompleteRecruitmentEntries(data);
    expect(data.additionalRecruitmentMethods).toHaveLength(2);
  });
});

// ============================================================================
// getFieldLabel
// ============================================================================

describe('getFieldLabel', () => {
  it('returns mapped label for known flat fields', () => {
    expect(getFieldLabel('employerName')).toBe('Employer Name');
    expect(getFieldLabel('pwdFilingDate')).toBe('PWD Filing Date');
    expect(getFieldLabel('eta9089FilingDate')).toBe('ETA 9089 Filing Date');
    expect(getFieldLabel('i140FilingDate')).toBe('I-140 Filing Date');
  });

  it('returns label for all entries in FIELD_LABELS', () => {
    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      expect(getFieldLabel(key)).toBe(label);
    }
  });

  it('handles additionalRecruitmentMethods nested paths', () => {
    expect(getFieldLabel('additionalRecruitmentMethods.0.date')).toBe('Recruitment Method #1 Date');
    expect(getFieldLabel('additionalRecruitmentMethods.0.method')).toBe('Recruitment Method #1 Method Type');
    expect(getFieldLabel('additionalRecruitmentMethods.2.startDate')).toBe('Recruitment Method #3 Start Date');
    expect(getFieldLabel('additionalRecruitmentMethods.1.endDate')).toBe('Recruitment Method #2 End Date');
    expect(getFieldLabel('additionalRecruitmentMethods.0.description')).toBe('Recruitment Method #1 Description');
  });

  it('handles sub-entry paths', () => {
    expect(getFieldLabel('additionalRecruitmentMethods.0.subEntries.0.date'))
      .toBe('Recruitment Method #1 Entry #1 Date');
    expect(getFieldLabel('additionalRecruitmentMethods.1.subEntries.2.date'))
      .toBe('Recruitment Method #2 Entry #3 Date');
    expect(getFieldLabel('additionalRecruitmentMethods.0.subEntries.0.description'))
      .toBe('Recruitment Method #1 Entry #1 Description');
  });

  it('handles unknown subfield in recruitment methods', () => {
    expect(getFieldLabel('additionalRecruitmentMethods.0.foo')).toBe('Recruitment Method #1 foo');
  });

  it('handles rfiEntries nested paths', () => {
    expect(getFieldLabel('rfiEntries.0.receivedDate')).toBe('RFI Received Date');
    expect(getFieldLabel('rfiEntries.1.responseDueDate')).toBe('RFI Due Date');
    expect(getFieldLabel('rfiEntries.0.responseSubmittedDate')).toBe('RFI Submitted Date');
  });

  it('handles rfeEntries nested paths', () => {
    expect(getFieldLabel('rfeEntries.0.receivedDate')).toBe('RFE Received Date');
    expect(getFieldLabel('rfeEntries.1.responseDueDate')).toBe('RFE Due Date');
  });

  it('falls back to Title Case for unknown fields', () => {
    expect(getFieldLabel('someWeirdField')).toBe('Some Weird Field');
    expect(getFieldLabel('caseNumber')).toBe('Case Number');
  });

  it('handles single-word unknown fields', () => {
    expect(getFieldLabel('notes')).toBe('Notes');
  });
});

// ============================================================================
// validateCaseForm - required dates per method category
// ============================================================================

describe('validateCaseForm required dates', () => {
  it('requires date for single-date methods', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'local_newspaper', date: '', description: '' },
      ],
    });
    const result = validateCaseForm(data);
    const dateError = result.errors.find(e => e.field === 'additionalRecruitmentMethods.0.date');
    expect(dateError).toBeDefined();
    expect(dateError!.message).toBe('Date is required');
  });

  it('requires startDate for date-range methods', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'job_website_ad', date: '', description: '' },
      ],
    });
    const result = validateCaseForm(data);
    const startError = result.errors.find(e => e.field === 'additionalRecruitmentMethods.0.startDate');
    expect(startError).toBeDefined();
    expect(startError!.message).toBe('Start date is required');
  });

  it('requires at least one broadcast date for sub-entry methods', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'radio_ad', date: '', description: '', subEntries: [{ date: '', description: '' }] },
      ],
    });
    const result = validateCaseForm(data);
    const subError = result.errors.find(e =>
      e.field.includes('subEntries') && e.message.includes('broadcast date')
    );
    expect(subError).toBeDefined();
  });

  it('passes when single-date method has a date', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'local_newspaper', date: '2024-06-01', description: 'Times' },
      ],
    });
    const result = validateCaseForm(data);
    const dateError = result.errors.find(e => e.field === 'additionalRecruitmentMethods.0.date' && e.message === 'Date is required');
    expect(dateError).toBeUndefined();
  });

  it('passes when date-range method has startDate', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'job_website_ad', date: '', startDate: '2024-06-01', description: '' },
      ],
    });
    const result = validateCaseForm(data);
    const startError = result.errors.find(e => e.field === 'additionalRecruitmentMethods.0.startDate' && e.message === 'Start date is required');
    expect(startError).toBeUndefined();
  });

  it('passes when sub-entry method has at least one date', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        {
          method: 'radio_ad', date: '', description: '',
          subEntries: [{ date: '', description: '' }, { date: '2024-06-15', description: 'Morning' }],
        },
      ],
    });
    const result = validateCaseForm(data);
    const subError = result.errors.find(e =>
      e.field.includes('subEntries') && e.message.includes('broadcast date')
    );
    expect(subError).toBeUndefined();
  });

  it('allows empty sub-entry date strings without Zod error', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        {
          method: 'tv_ad', date: '', description: '',
          subEntries: [{ date: '', description: '' }],
        },
      ],
    });
    const result = validateCaseForm(data);
    // Should NOT have "Invalid date" Zod error — only the friendly "broadcast date required"
    const zodDateError = result.errors.find(e =>
      e.field.includes('subEntries') && e.message.includes('Invalid date')
    );
    expect(zodDateError).toBeUndefined();
  });
});

// ============================================================================
// mapFieldToInputName - recruitment method scroll-to-field
// ============================================================================

describe('mapFieldToInputName', () => {
  it('maps recruitment method date paths', () => {
    expect(mapFieldToInputName('additionalRecruitmentMethods.0.date')).toBe('method-date-0');
    expect(mapFieldToInputName('additionalRecruitmentMethods.2.date')).toBe('method-date-2');
  });

  it('maps recruitment method startDate/endDate paths', () => {
    expect(mapFieldToInputName('additionalRecruitmentMethods.0.startDate')).toBe('method-start-0');
    expect(mapFieldToInputName('additionalRecruitmentMethods.1.endDate')).toBe('method-end-1');
  });

  it('maps recruitment method select paths', () => {
    expect(mapFieldToInputName('additionalRecruitmentMethods.0.method')).toBe('method-0');
  });

  it('maps sub-entry date paths', () => {
    expect(mapFieldToInputName('additionalRecruitmentMethods.0.subEntries.0.date')).toBe('sub-entry-date-0');
    expect(mapFieldToInputName('additionalRecruitmentMethods.1.subEntries.2.date')).toBe('sub-entry-date-2');
  });

  it('maps RFI/RFE paths unchanged', () => {
    expect(mapFieldToInputName('rfiEntries.0.receivedDate')).toBe('rfi-0-receivedDate');
    expect(mapFieldToInputName('rfeEntries.1.responseDueDate')).toBe('rfe-1-responseDueDate');
  });

  it('returns standard field names as-is', () => {
    expect(mapFieldToInputName('employerName')).toBe('employerName');
    expect(mapFieldToInputName('pwdFilingDate')).toBe('pwdFilingDate');
  });
});
