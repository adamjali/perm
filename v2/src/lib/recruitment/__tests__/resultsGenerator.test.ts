import { describe, it, expect } from 'vitest';
import {
  generateRecruitmentResultsText,
  getMethodLabel,
  RECRUITMENT_METHOD_TYPES,
  type RecruitmentResultsCaseData,
} from '../resultsGenerator';

// ============================================================================
// Test Data Factory
// ============================================================================

function createBaseCase(
  overrides: Partial<RecruitmentResultsCaseData> = {}
): RecruitmentResultsCaseData {
  return {
    employerName: 'Acme Corporation',
    noticeOfFilingStartDate: '2024-12-10',
    noticeOfFilingEndDate: '2024-12-24',
    jobOrderStartDate: '2024-12-10',
    jobOrderEndDate: '2025-01-09',
    jobOrderState: 'CA',
    sundayAdFirstDate: '2024-12-14',
    sundayAdSecondDate: '2024-12-21',
    sundayAdNewspaper: 'The Daily News',
    isProfessionalOccupation: false,
    recruitmentApplicantsCount: 0,
    ...overrides,
  };
}

// ============================================================================
// generateRecruitmentResultsText - Mandatory Steps
// ============================================================================

describe('generateRecruitmentResultsText', () => {
  describe('mandatory steps', () => {
    it('generates Notice of Filing line with business days', () => {
      const text = generateRecruitmentResultsText(createBaseCase());
      expect(text).toContain('1. Notice of Filing was posted');
      expect(text).toContain("Acme Corporation's premises");
      expect(text).toContain('December 10, 2024');
      expect(text).toContain('December 24, 2024');
      expect(text).toMatch(/\d+ business days/);
    });

    it('generates Job Order/SWA line with state name and duration', () => {
      const text = generateRecruitmentResultsText(createBaseCase());
      expect(text).toContain('2. A job order was placed');
      expect(text).toContain('California State Workforce Agency');
      expect(text).toContain('December 10, 2024');
      expect(text).toContain('January 9, 2025');
      expect(text).toMatch(/\d+ days\)/);
    });

    it('generates Sunday ads line with newspaper name', () => {
      const text = generateRecruitmentResultsText(createBaseCase());
      expect(text).toContain('3. Two Sunday newspaper advertisements');
      expect(text).toContain('The Daily News');
      expect(text).toContain('December 14, 2024');
      expect(text).toContain('December 21, 2024');
    });

    it('uses [NEWSPAPER NAME] when newspaper not provided', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({ sundayAdNewspaper: undefined })
      );
      expect(text).toContain('[NEWSPAPER NAME]');
    });

    it('uses [STATE] when job order state not provided', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({ jobOrderState: undefined })
      );
      expect(text).toContain('[STATE] State Workforce Agency');
    });

    it('skips Notice of Filing if dates missing', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({ noticeOfFilingStartDate: undefined })
      );
      expect(text).not.toContain('Notice of Filing');
    });

    it('skips Job Order if dates missing', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({ jobOrderStartDate: undefined })
      );
      expect(text).not.toContain('job order');
    });

    it('skips Sunday ads if dates missing', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({ sundayAdFirstDate: undefined })
      );
      expect(text).not.toContain('Sunday newspaper');
    });
  });

  // ==========================================================================
  // Additional Recruitment Methods
  // ==========================================================================

  describe('additional recruitment methods - single date', () => {
    it('formats local_newspaper with description and date', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'local_newspaper', date: '2025-01-05', description: 'El Diario' },
          ],
        })
      );
      expect(text).toContain('El Diario ad published on January 5, 2025');
    });

    it('uses placeholder when description missing for outlet method', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'local_newspaper', date: '2025-01-05', description: '' },
          ],
        })
      );
      expect(text).toContain('[Newspaper Name] ad published on');
    });
  });

  describe('additional recruitment methods - date range', () => {
    it('formats job_website_ad with startDate/endDate and duration', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            {
              method: 'job_website_ad',
              date: '',
              description: 'Indeed',
              startDate: '2024-12-15',
              endDate: '2025-01-15',
            },
          ],
        })
      );
      expect(text).toContain('Indeed job posting from December 15, 2024 to January 15, 2025');
      expect(text).toMatch(/\(\d+ days\)/);
    });

    it('formats employer_website with startDate/endDate', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            {
              method: 'employer_website',
              date: '',
              description: '',
              startDate: '2024-12-10',
              endDate: '2025-01-10',
            },
          ],
        })
      );
      expect(text).toContain("Employer's website posting from December 10, 2024 to January 10, 2025");
    });

    it('falls back to date field for range method when startDate/endDate missing', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'employer_website', date: '2025-01-01', description: '' },
          ],
        })
      );
      expect(text).toContain("Employer's website posting from January 1, 2025 to January 1, 2025");
    });
  });

  describe('additional recruitment methods - multi/sub-entries', () => {
    it('formats radio_ad with sub-entries', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            {
              method: 'radio_ad',
              date: '',
              description: 'WNYC',
              subEntries: [
                { date: '2024-12-20', description: 'Morning' },
                { date: '2024-12-27', description: 'Evening' },
              ],
            },
          ],
        })
      );
      expect(text).toContain('WNYC broadcast on December 20, 2024 and December 27, 2024');
    });

    it('formats tv_ad with 3 sub-entries using comma-and format', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            {
              method: 'tv_ad',
              date: '',
              description: 'ABC News',
              subEntries: [
                { date: '2024-12-15' },
                { date: '2024-12-22' },
                { date: '2024-12-29' },
              ],
            },
          ],
        })
      );
      expect(text).toContain(
        'ABC News broadcast on December 15, 2024, December 22, 2024, and December 29, 2024'
      );
    });

    it('formats radio_ad with single sub-entry', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            {
              method: 'radio_ad',
              date: '',
              description: 'WNYC',
              subEntries: [{ date: '2024-12-20' }],
            },
          ],
        })
      );
      expect(text).toContain('WNYC broadcast on December 20, 2024');
    });

    it('falls back to date field when sub-entries empty', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'radio_ad', date: '2024-12-20', description: 'WNYC' },
          ],
        })
      );
      expect(text).toContain('WNYC broadcast on December 20, 2024');
    });

    it('falls back to date field when sub-entries have no dates', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            {
              method: 'radio_ad',
              date: '2024-12-20',
              description: 'WNYC',
              subEntries: [{ date: '' }],
            },
          ],
        })
      );
      expect(text).toContain('WNYC broadcast on December 20, 2024');
    });
  });

  // ==========================================================================
  // Empty Entry Filtering
  // ==========================================================================

  describe('empty entry filtering', () => {
    it('filters out entries with method but no dates at all', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'tv_ad', date: '', description: '' },
            { method: 'local_newspaper', date: '2025-01-05', description: 'Times' },
          ],
        })
      );
      // Only the local_newspaper should appear as method #4
      expect(text).toContain('Times ad published on January 5, 2025');
      expect(text).not.toContain('[TV Station]');
    });

    it('filters out entries without method type', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: '', date: '2025-01-05', description: 'Times' },
          ],
        })
      );
      // Empty method should be filtered, no additional methods in output
      expect(text).not.toContain('Times');
    });

    it('keeps entries with startDate but no date', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            {
              method: 'job_website_ad',
              date: '',
              description: 'Indeed',
              startDate: '2024-12-15',
              endDate: '2025-01-15',
            },
          ],
        })
      );
      expect(text).toContain('Indeed job posting from December 15, 2024');
    });

    it('keeps entries with sub-entries but no date', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            {
              method: 'radio_ad',
              date: '',
              description: 'WNYC',
              subEntries: [{ date: '2024-12-20' }],
            },
          ],
        })
      );
      expect(text).toContain('WNYC broadcast on December 20, 2024');
    });
  });

  // ==========================================================================
  // Non-professional cases
  // ==========================================================================

  describe('non-professional cases', () => {
    it('does not include additional methods for non-professional', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: false,
          additionalRecruitmentMethods: [
            { method: 'local_newspaper', date: '2025-01-05', description: 'Times' },
          ],
        })
      );
      expect(text).not.toContain('Times');
    });
  });

  // ==========================================================================
  // Applicant Count
  // ==========================================================================

  describe('applicant count', () => {
    it('shows 0 applicants', () => {
      const text = generateRecruitmentResultsText(createBaseCase({ recruitmentApplicantsCount: 0 }));
      expect(text).toContain('0 applicants responded');
    });

    it('shows 1 applicant (singular)', () => {
      const text = generateRecruitmentResultsText(createBaseCase({ recruitmentApplicantsCount: 1 }));
      expect(text).toContain('1 applicant responded');
      expect(text).not.toContain('1 applicants');
    });

    it('shows multiple applicants (plural)', () => {
      const text = generateRecruitmentResultsText(createBaseCase({ recruitmentApplicantsCount: 5 }));
      expect(text).toContain('5 applicants responded');
    });

    it('defaults to 0 when count not provided', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({ recruitmentApplicantsCount: undefined })
      );
      expect(text).toContain('0 applicants responded');
    });
  });

  // ==========================================================================
  // Recruitment Notes
  // ==========================================================================

  describe('recruitment notes', () => {
    it('includes notes when provided', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({ recruitmentNotes: 'No qualified applicants were found.' })
      );
      expect(text).toContain('No qualified applicants were found.');
    });

    it('omits notes section when not provided', () => {
      const text = generateRecruitmentResultsText(createBaseCase({ recruitmentNotes: undefined }));
      const lines = text.split('\n').filter(l => l.trim());
      // Should end with applicants line, no extra paragraph
      expect(lines[lines.length - 1]).toContain('applicants responded');
    });
  });

  // ==========================================================================
  // Line numbering
  // ==========================================================================

  describe('line numbering', () => {
    it('numbers mandatory steps sequentially', () => {
      const text = generateRecruitmentResultsText(createBaseCase());
      expect(text).toContain('1. Notice of Filing');
      expect(text).toContain('2. A job order');
      expect(text).toContain('3. Two Sunday');
    });

    it('continues numbering for additional methods', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'local_newspaper', date: '2025-01-05', description: 'Times' },
            { method: 'employer_website', date: '', description: '', startDate: '2024-12-10', endDate: '2025-01-10' },
          ],
        })
      );
      expect(text).toContain('4. Times ad published');
      expect(text).toContain("5. Employer's website posting");
    });
  });

  // ==========================================================================
  // Unknown method type fallback
  // ==========================================================================

  describe('unknown method types', () => {
    it('falls back to description-based format', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'some_unknown_type', date: '2025-01-05', description: 'Custom recruitment' },
          ],
        })
      );
      expect(text).toContain('Custom recruitment on January 5, 2025');
    });

    it('falls back to method name format when no description', () => {
      const text = generateRecruitmentResultsText(
        createBaseCase({
          isProfessionalOccupation: true,
          additionalRecruitmentMethods: [
            { method: 'some_unknown_type', date: '2025-01-05', description: '' },
          ],
        })
      );
      expect(text).toContain('Some unknown type on January 5, 2025');
    });
  });
});

// ============================================================================
// getMethodLabel
// ============================================================================

describe('getMethodLabel', () => {
  it('returns label for known methods', () => {
    expect(getMethodLabel('local_newspaper')).toBe('Local/Ethnic Newspaper Ad');
    expect(getMethodLabel('radio_ad')).toBe('Radio Advertisement');
    expect(getMethodLabel('employer_website')).toBe("Employer's Website");
  });

  it('returns Title Case for unknown methods', () => {
    expect(getMethodLabel('some_unknown')).toBe('Some Unknown');
  });

  it('has labels for all configured method types', () => {
    for (const key of Object.keys(RECRUITMENT_METHOD_TYPES)) {
      expect(getMethodLabel(key)).toBeTruthy();
    }
  });
});
