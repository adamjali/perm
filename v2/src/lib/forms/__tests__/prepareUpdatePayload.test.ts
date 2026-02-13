import { describe, it, expect } from 'vitest';
import { prepareUpdatePayload, NULLABLE_FIELDS } from '../prepareUpdatePayload';

describe('prepareUpdatePayload', () => {
  // ============================================================================
  // CORE: undefined handling differs by field type
  // ============================================================================

  it('converts undefined to null for nullable string/date fields', () => {
    const data = {
      pwdFilingDate: undefined,
      sundayAdSecondDate: undefined,
      eta9089CaseNumber: undefined,
      i140Category: undefined,
      jobDescription: undefined,
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.pwdFilingDate).toBeNull();
    expect(result.sundayAdSecondDate).toBeNull();
    expect(result.eta9089CaseNumber).toBeNull();
    expect(result.i140Category).toBeNull();
    expect(result.jobDescription).toBeNull();
  });

  it('omits undefined for non-nullable fields (boolean, number, array, object, ID)', () => {
    const data = {
      isFavorite: undefined,
      isPinned: undefined,
      isProfessionalOccupation: undefined,
      calendarSyncEnabled: undefined,
      showOnTimeline: undefined,
      i140PremiumProcessing: undefined,
      progressStatusOverride: undefined,
      recruitmentApplicantsCount: undefined,
      pwdWageAmount: undefined,
      caseStatus: undefined,
      priorityLevel: undefined,
      tags: undefined,
      additionalRecruitmentMethods: undefined,
      duplicateOf: undefined,
      markedAsDuplicateAt: undefined,
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    // None of these should be in the payload
    expect(result).not.toHaveProperty('isFavorite');
    expect(result).not.toHaveProperty('isPinned');
    expect(result).not.toHaveProperty('isProfessionalOccupation');
    expect(result).not.toHaveProperty('calendarSyncEnabled');
    expect(result).not.toHaveProperty('showOnTimeline');
    expect(result).not.toHaveProperty('i140PremiumProcessing');
    expect(result).not.toHaveProperty('progressStatusOverride');
    expect(result).not.toHaveProperty('recruitmentApplicantsCount');
    expect(result).not.toHaveProperty('pwdWageAmount');
    expect(result).not.toHaveProperty('caseStatus');
    expect(result).not.toHaveProperty('priorityLevel');
    expect(result).not.toHaveProperty('tags');
    expect(result).not.toHaveProperty('additionalRecruitmentMethods');
    expect(result).not.toHaveProperty('duplicateOf');
    expect(result).not.toHaveProperty('markedAsDuplicateAt');
  });

  it('omits undefined for non-nullable string fields (employerName, positionTitle)', () => {
    const data = {
      employerName: undefined,
      beneficiaryIdentifier: undefined,
      positionTitle: undefined,
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result).not.toHaveProperty('employerName');
    expect(result).not.toHaveProperty('beneficiaryIdentifier');
    expect(result).not.toHaveProperty('positionTitle');
  });

  // ============================================================================
  // PRESERVES: non-undefined values pass through unchanged
  // ============================================================================

  it('preserves string values as-is', () => {
    const data = {
      pwdFilingDate: '2024-01-15',
      employerName: 'Test Corp',
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.pwdFilingDate).toBe('2024-01-15');
    expect(result.employerName).toBe('Test Corp');
  });

  it('preserves booleans as-is', () => {
    const data = {
      isProfessionalOccupation: false,
      isFavorite: true,
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.isProfessionalOccupation).toBe(false);
    expect(result.isFavorite).toBe(true);
  });

  it('preserves numbers as-is (including zero)', () => {
    const data = {
      pwdWageAmount: 75000,
      recruitmentApplicantsCount: 0,
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.pwdWageAmount).toBe(75000);
    expect(result.recruitmentApplicantsCount).toBe(0);
  });

  it('preserves arrays as-is (including empty)', () => {
    const data = {
      rfiEntries: [{ id: '1', receivedDate: '2024-01-15' }],
      notes: [],
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.rfiEntries).toEqual([{ id: '1', receivedDate: '2024-01-15' }]);
    expect(result.notes).toEqual([]);
  });

  it('preserves null values as-is', () => {
    const data = { sundayAdSecondDate: null };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.sundayAdSecondDate).toBeNull();
  });

  it('preserves empty strings as-is', () => {
    const data = { beneficiaryIdentifier: '' };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.beneficiaryIdentifier).toBe('');
  });

  // ============================================================================
  // MIXED: realistic form data with both types
  // ============================================================================

  it('handles mixed form data correctly (the actual bug scenario)', () => {
    const data = {
      employerName: 'Test Corp',
      positionTitle: 'Engineer',
      // User cleared these date fields — should become null
      pwdFilingDate: undefined,
      sundayAdFirstDate: undefined,
      // These booleans were not modified — should be omitted
      isFavorite: undefined,
      isProfessionalOccupation: undefined,
      // This boolean HAS a value — should be preserved
      isPinned: false,
      // This number was not modified — should be omitted
      pwdWageAmount: undefined,
    };
    const result = prepareUpdatePayload(data as Record<string, unknown>);
    expect(result.employerName).toBe('Test Corp');
    expect(result.positionTitle).toBe('Engineer');
    expect(result.pwdFilingDate).toBeNull();
    expect(result.sundayAdFirstDate).toBeNull();
    expect(result).not.toHaveProperty('isFavorite');
    expect(result).not.toHaveProperty('isProfessionalOccupation');
    expect(result.isPinned).toBe(false);
    expect(result).not.toHaveProperty('pwdWageAmount');
  });

  // ============================================================================
  // NULLABLE_FIELDS: exported set is correct
  // ============================================================================

  it('NULLABLE_FIELDS contains all expected date/string fields', () => {
    const expectedFields = [
      'pwdFilingDate', 'pwdDeterminationDate', 'pwdExpirationDate', 'pwdCaseNumber',
      'pwdWageLevel', 'jobOrderStartDate', 'jobOrderEndDate',
      'sundayAdFirstDate', 'sundayAdSecondDate', 'sundayAdNewspaper',
      'i140FilingDate', 'i140ReceiptDate', 'i140ReceiptNumber',
      'i140ApprovalDate', 'i140DenialDate', 'i140Category', 'i140ServiceCenter',
      'eta9089FilingDate', 'eta9089AuditDate', 'eta9089CertificationDate',
      'eta9089ExpirationDate', 'eta9089CaseNumber',
      'caseNumber', 'internalCaseNumber', 'employerFein',
      'jobTitle', 'socCode', 'socTitle', 'jobOrderState',
      'jobDescription', 'jobDescriptionPositionTitle',
    ];
    for (const field of expectedFields) {
      expect(NULLABLE_FIELDS.has(field), `Missing nullable field: ${field}`).toBe(true);
    }
  });

  it('NULLABLE_FIELDS does not contain boolean/number/array fields', () => {
    const nonNullableFields = [
      'isFavorite', 'isPinned', 'isProfessionalOccupation',
      'calendarSyncEnabled', 'showOnTimeline', 'i140PremiumProcessing',
      'progressStatusOverride', 'recruitmentApplicantsCount', 'pwdWageAmount',
      'tags', 'documents', 'notes', 'rfiEntries', 'rfeEntries',
      'employerName', 'beneficiaryIdentifier', 'positionTitle',
    ];
    for (const field of nonNullableFields) {
      expect(NULLABLE_FIELDS.has(field), `Should not be nullable: ${field}`).toBe(false);
    }
  });
});
