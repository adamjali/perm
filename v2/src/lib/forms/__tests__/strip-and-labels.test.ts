/**
 * Tests for stripIncompleteRecruitmentEntries and getFieldLabel
 *
 * Covers:
 * - stripIncompleteRecruitmentEntries: filters empty entries before validation
 * - getFieldLabel: human-readable labels for field paths
 */
import { describe, it, expect } from 'vitest';
import {
  stripIncompleteRecruitmentEntries,
  getFieldLabel,
  FIELD_LABELS,
  type CaseFormData,
} from '../case-form-schema';

// Minimal valid form data factory — uses `as CaseFormData` to bypass branded ISODateString
// since test data doesn't go through Zod parse
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
    expect(result).toBe(data); // Same reference
  });

  it('returns same data when methods is undefined', () => {
    const data = createMinimalFormData({ additionalRecruitmentMethods: undefined });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result).toBe(data);
  });

  it('strips entries with method but no dates', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'radio_ad', date: '', description: '' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toEqual([]);
  });

  it('strips entries with no method type', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: '', date: '2024-06-01', description: '' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toEqual([]);
  });

  it('keeps entries with method and date', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'local_newspaper', date: '2024-06-01', description: 'Times' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toHaveLength(1);
  });

  it('keeps entries with startDate even without date', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'job_website_ad', date: '', description: 'Indeed', startDate: '2024-06-01' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toHaveLength(1);
  });

  it('keeps entries with endDate even without date or startDate', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'employer_website', date: '', description: '', endDate: '2024-07-01' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toHaveLength(1);
  });

  it('keeps entries with populated sub-entries', () => {
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
    expect(result.additionalRecruitmentMethods).toHaveLength(1);
  });

  it('strips entries with empty sub-entries', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        {
          method: 'radio_ad',
          date: '',
          description: 'WNYC',
          subEntries: [{ date: '', description: '' }],
        },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toEqual([]);
  });

  it('returns same reference when nothing stripped', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'local_newspaper', date: '2024-06-01', description: 'Times' },
        { method: 'job_website_ad', date: '', description: 'Indeed', startDate: '2024-06-01', endDate: '2024-07-01' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result).toBe(data); // Same reference = no unnecessary copy
  });

  it('mixes kept and stripped entries correctly', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: 'local_newspaper', date: '2024-06-01', description: 'Times' },
        { method: 'tv_ad', date: '', description: '' }, // stripped
        { method: 'radio_ad', date: '', description: 'WNYC', subEntries: [{ date: '2024-06-15' }] },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toHaveLength(2);
    expect(result.additionalRecruitmentMethods![0]!.method).toBe('local_newspaper');
    expect(result.additionalRecruitmentMethods![1]!.method).toBe('radio_ad');
  });

  it('does not mutate original data', () => {
    const methods = [
      { method: 'local_newspaper', date: '2024-06-01', description: 'Times' },
      { method: 'tv_ad', date: '', description: '' },
    ];
    const data = createMinimalFormData({ additionalRecruitmentMethods: methods });
    stripIncompleteRecruitmentEntries(data);
    expect(data.additionalRecruitmentMethods).toHaveLength(2); // Original unchanged
  });

  // Sub-entry edge cases
  it('cleans empty sub-entries but keeps method when valid sub-entries remain', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        {
          method: 'radio_ad',
          date: '',
          description: 'WNYC',
          subEntries: [
            { date: '2024-06-15', description: 'Morning' },
            { date: '', description: '' }, // empty — should be stripped
          ],
        },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toHaveLength(1);
    expect(result.additionalRecruitmentMethods![0]!.subEntries).toHaveLength(1);
    expect(result.additionalRecruitmentMethods![0]!.subEntries![0]!.date).toBe('2024-06-15');
  });

  it('strips method entirely when ALL sub-entries are empty and no other dates', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        {
          method: 'tv_ad',
          date: '',
          description: 'ABC',
          subEntries: [
            { date: '', description: '' },
            { date: '', description: 'placeholder' },
          ],
        },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toEqual([]);
  });

  it('strips method with only description but no method type', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        { method: '', date: '', description: 'Some note' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toEqual([]);
  });

  it('strips method with method type but only empty sub-entries', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        {
          method: 'radio_ad',
          date: '',
          description: '',
          subEntries: [{ date: '', description: '' }],
        },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toEqual([]);
  });

  it('handles multiple methods with mixed sub-entry validity', () => {
    const data = createMinimalFormData({
      additionalRecruitmentMethods: [
        {
          method: 'radio_ad',
          date: '',
          description: 'WNYC',
          subEntries: [{ date: '2024-06-15' }],
        },
        {
          method: 'tv_ad',
          date: '',
          description: 'ABC',
          subEntries: [{ date: '', description: '' }], // all empty — method stripped
        },
        { method: 'local_newspaper', date: '2024-06-20', description: 'Times' },
      ],
    });
    const result = stripIncompleteRecruitmentEntries(data);
    expect(result.additionalRecruitmentMethods).toHaveLength(2);
    expect(result.additionalRecruitmentMethods![0]!.method).toBe('radio_ad');
    expect(result.additionalRecruitmentMethods![1]!.method).toBe('local_newspaper');
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
