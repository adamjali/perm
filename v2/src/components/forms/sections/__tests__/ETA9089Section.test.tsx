/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ETA9089Section } from '../ETA9089Section';
import { CaseFormProvider } from '../../CaseFormContext';
import type { CaseFormData } from '@/lib/forms/case-form-schema';
import { addDays } from 'date-fns';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Create base form values with required fields
 */
function createFormValues(overrides?: Partial<CaseFormData>): Partial<CaseFormData> {
  return {
    employerName: 'Test Corp',
    beneficiaryIdentifier: 'JD',
    positionTitle: 'Software Engineer',
    caseStatus: 'eta9089',
    progressStatus: 'working',
    isProfessionalOccupation: false,
    priorityLevel: 'normal',
    isFavorite: false,
    notes: [],
    tags: [],
    calendarSyncEnabled: true,
    additionalRecruitmentMethods: [],
    recruitmentApplicantsCount: 0,
    ...overrides,
  };
}

/**
 * Wrapper component that provides CaseFormContext for ETA9089Section tests.
 * RFIEntryList (within ETA9089Section) now uses useFieldArray which requires the context.
 */
const TestWrapper = ({
  values,
  children,
}: {
  values: Partial<CaseFormData>;
  children: React.ReactNode;
}) => (
  <CaseFormProvider mode="edit" initialData={values}>
    {children}
  </CaseFormProvider>
);

// ============================================================================
// Tests
// ============================================================================

describe('ETA9089Section', () => {
  const mockOnChange = vi.fn();
  const mockOnDateChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper to render ETA9089Section with CaseFormProvider context
   */
  const renderETA9089Section = (
    values: Partial<CaseFormData>,
    props?: {
      errors?: Record<string, string>;
      warnings?: Record<string, string>;
      autoCalculatedFields?: Set<string>;
    }
  ) => {
    return render(
      <TestWrapper values={values}>
        <ETA9089Section
          values={values}
          errors={props?.errors}
          warnings={props?.warnings}
          autoCalculatedFields={props?.autoCalculatedFields}
          onChange={mockOnChange}
          onDateChange={mockOnDateChange}
        />
      </TestWrapper>
    );
  };

  // ==========================================================================
  // RENDERING TESTS
  // ==========================================================================

  describe('Rendering', () => {
    it('renders all form fields', () => {
      const values = createFormValues();

      renderETA9089Section(values);

      expect(screen.getByLabelText(/filing date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/audit date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/certification date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/expiration date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/case number/i)).toBeInTheDocument();
    });

    it('displays section title', () => {
      const values = createFormValues();

      renderETA9089Section(values);

      expect(screen.getByText('ETA 9089')).toBeInTheDocument();
    });

    it('renders with default open state', () => {
      const values = createFormValues();

      renderETA9089Section(values);

      // Fields should be visible
      expect(screen.getByLabelText(/filing date/i)).toBeVisible();
    });
  });

  // ==========================================================================
  // AUTO-CALCULATION TESTS
  // ==========================================================================

  describe('Auto-Calculation', () => {
    it('marks expiration date as auto-calculated when certification date is set', () => {
      const certDate = new Date('2024-06-15');
      const values = createFormValues({
        eta9089CertificationDate: toISODate(certDate),
      });

      const autoFields = new Set(['eta9089ExpirationDate']);

      renderETA9089Section(values, { autoCalculatedFields: autoFields });

      // Expiration field should have "Auto" badge
      const expirationField = screen.getByLabelText(/expiration date/i);
      const container = expirationField.closest('[data-auto-calculated]');
      expect(container).toHaveAttribute('data-auto-calculated', 'true');
    });

    it('expiration date is disabled when auto-calculated', () => {
      const certDate = new Date('2024-06-15');
      const values = createFormValues({
        eta9089CertificationDate: toISODate(certDate),
        eta9089ExpirationDate: toISODate(addDays(certDate, 180)),
      });

      const autoFields = new Set(['eta9089ExpirationDate']);

      renderETA9089Section(values, { autoCalculatedFields: autoFields });

      const expirationInput = screen.getByLabelText(/expiration date/i) as HTMLInputElement;
      expect(expirationInput).toBeDisabled();
    });

    it('calls onDateChange when certification date changes', async () => {
      const user = userEvent.setup();
      const values = createFormValues();

      renderETA9089Section(values);

      const certInput = screen.getByLabelText(/certification date/i);
      await user.type(certInput, '2024-06-15');

      expect(mockOnDateChange).toHaveBeenCalledWith('eta9089CertificationDate', expect.any(String));
    });
  });

  // ==========================================================================
  // FILING WINDOW INDICATOR TESTS
  // ==========================================================================

  describe('Filing Window Indicator', () => {
    it('shows "Not yet open" status when filing window has not opened', () => {
      const recruitmentStartDate = new Date('2024-06-15'); // First recruitment activity
      const recruitmentEndDate = new Date('2024-06-20'); // Need 30 days to pass

      const values = createFormValues({
        // Start dates are needed for 180-day window calculation
        sundayAdFirstDate: toISODate(recruitmentStartDate),
        jobOrderStartDate: toISODate(recruitmentStartDate),
        noticeOfFilingStartDate: toISODate(recruitmentStartDate),
        // End dates are needed for 30-day opening calculation
        sundayAdSecondDate: toISODate(recruitmentEndDate),
        jobOrderEndDate: toISODate(recruitmentEndDate),
        noticeOfFilingEndDate: toISODate(recruitmentEndDate), // Required for recruitment complete
      });

      // Mock current date to be < 30 days after recruitment
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-07-01')); // Only 11 days after

      renderETA9089Section(values);

      expect(screen.getByText(/not yet open/i)).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('shows "Open" status when filing window is open', () => {
      const recruitmentStartDate = new Date('2024-05-01'); // First recruitment
      const recruitmentEndDate = new Date('2024-05-01');
      const pwdExpiration = new Date('2024-12-31');
      // Window opens 30 days after end = 2024-05-31
      // Window closes 180 days after first start = 2024-10-28

      const values = createFormValues({
        // Start dates for 180-day window calculation
        sundayAdFirstDate: toISODate(recruitmentStartDate),
        jobOrderStartDate: toISODate(recruitmentStartDate),
        noticeOfFilingStartDate: toISODate(recruitmentStartDate),
        // End dates for 30-day opening calculation
        sundayAdSecondDate: toISODate(recruitmentEndDate),
        jobOrderEndDate: toISODate(recruitmentEndDate),
        noticeOfFilingEndDate: toISODate(recruitmentEndDate), // Required for recruitment complete
        pwdExpirationDate: toISODate(pwdExpiration),
      });

      // Mock current date to be during open window
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15')); // 45 days after recruitment

      renderETA9089Section(values);

      // FilingWindowIndicator may have multiple elements matching "open" - use getAllByText
      const openElements = screen.getAllByText(/open/i);
      expect(openElements.length).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it('shows "Closing soon" status when less than 14 days remain', () => {
      const recruitmentStartDate = new Date('2024-05-01'); // First recruitment
      const recruitmentEndDate = new Date('2024-05-01');
      const pwdExpiration = new Date('2024-12-31');
      // Window closes on 2024-10-28 (180 days after first recruitment)
      // If today is 2024-10-16, that's 12 days before closing

      const values = createFormValues({
        // Start dates for 180-day window calculation
        sundayAdFirstDate: toISODate(recruitmentStartDate),
        jobOrderStartDate: toISODate(recruitmentStartDate),
        noticeOfFilingStartDate: toISODate(recruitmentStartDate),
        // End dates for 30-day opening calculation
        sundayAdSecondDate: toISODate(recruitmentEndDate),
        jobOrderEndDate: toISODate(recruitmentEndDate),
        noticeOfFilingEndDate: toISODate(recruitmentEndDate), // Required for recruitment complete
        pwdExpirationDate: toISODate(pwdExpiration),
      });

      // Mock current date to be 12 days before closing
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-10-16'));

      renderETA9089Section(values);

      expect(screen.getByText(/closing soon/i)).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('shows "Closed" status when filing window has passed', () => {
      const recruitmentStartDate = new Date('2024-01-01'); // First recruitment
      const recruitmentEndDate = new Date('2024-01-01');
      const pwdExpiration = new Date('2024-12-31');
      // Window closes on 2024-06-29 (180 days after first recruitment)

      const values = createFormValues({
        // Start dates for 180-day window calculation
        sundayAdFirstDate: toISODate(recruitmentStartDate),
        jobOrderStartDate: toISODate(recruitmentStartDate),
        noticeOfFilingStartDate: toISODate(recruitmentStartDate),
        // End dates for 30-day opening calculation
        sundayAdSecondDate: toISODate(recruitmentEndDate),
        jobOrderEndDate: toISODate(recruitmentEndDate),
        noticeOfFilingEndDate: toISODate(recruitmentEndDate), // Required for recruitment complete
        pwdExpirationDate: toISODate(pwdExpiration),
      });

      // Mock current date to be after closing
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-08-01'));

      renderETA9089Section(values);

      // FilingWindowIndicator may have multiple elements matching "closed" - use getAllByText
      const closedElements = screen.getAllByText(/closed/i);
      expect(closedElements.length).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it('shows window dates when window is open', () => {
      const recruitmentStartDate = new Date('2024-05-01'); // First recruitment
      const recruitmentEndDate = new Date('2024-05-01');
      const pwdExpiration = new Date('2024-12-31');
      // Window opens May 31 (30 days after end)
      // Window closes Oct 28 (180 days after first start)

      const values = createFormValues({
        // Start dates for 180-day window calculation
        sundayAdFirstDate: toISODate(recruitmentStartDate),
        jobOrderStartDate: toISODate(recruitmentStartDate),
        noticeOfFilingStartDate: toISODate(recruitmentStartDate),
        // End dates for 30-day opening calculation
        sundayAdSecondDate: toISODate(recruitmentEndDate),
        jobOrderEndDate: toISODate(recruitmentEndDate),
        noticeOfFilingEndDate: toISODate(recruitmentEndDate), // Required for recruitment complete
        pwdExpirationDate: toISODate(pwdExpiration),
      });

      // Mock current date to be during open window
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15'));

      renderETA9089Section(values);

      // Should show window dates in "MMM d, yyyy" format (per FilingWindowIndicator)
      expect(screen.getByText(/May 31, 2024/)).toBeInTheDocument(); // Opens
      expect(screen.getByText(/Oct 28, 2024/)).toBeInTheDocument(); // Closes

      vi.useRealTimers();
    });

    it('shows countdown when closing soon', () => {
      const recruitmentStartDate = new Date('2024-05-01'); // First recruitment
      const recruitmentEndDate = new Date('2024-05-01');
      const pwdExpiration = new Date('2024-12-31');
      // Window closes Oct 28 (180 days after first start)
      // Oct 23 = 5 days before closing

      const values = createFormValues({
        // Start dates for 180-day window calculation
        sundayAdFirstDate: toISODate(recruitmentStartDate),
        jobOrderStartDate: toISODate(recruitmentStartDate),
        noticeOfFilingStartDate: toISODate(recruitmentStartDate),
        // End dates for 30-day opening calculation
        sundayAdSecondDate: toISODate(recruitmentEndDate),
        jobOrderEndDate: toISODate(recruitmentEndDate),
        noticeOfFilingEndDate: toISODate(recruitmentEndDate), // Required for recruitment complete
        pwdExpirationDate: toISODate(pwdExpiration),
      });

      // Mock current date to be 5 days before closing
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-10-23'));

      renderETA9089Section(values);

      // Look for days remaining text (the number and "days remaining" may be in separate elements)
      expect(screen.getByText(/days remaining/i)).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // VALIDATION TESTS
  // ==========================================================================

  describe('Validation', () => {
    it('displays error for filing date outside window', () => {
      const values = createFormValues();
      const errors = {
        eta9089FilingDate: 'Filing date must be 30-180 days after recruitment ends',
      };

      renderETA9089Section(values, { errors });

      // Check for the exact error message
      expect(screen.getByText('Filing date must be 30-180 days after recruitment ends')).toBeInTheDocument();
    });

    it('displays warning when filing after PWD expiration', () => {
      const values = createFormValues();
      const warnings = {
        eta9089FilingDate: 'Filing date is after PWD expiration',
      };

      renderETA9089Section(values, { warnings });

      expect(screen.getByText(/after PWD expiration/i)).toBeInTheDocument();
    });

    it('displays error when certification date is before filing date', () => {
      const values = createFormValues();
      const errors = {
        eta9089CertificationDate: 'Certification date must be after filing date',
      };

      renderETA9089Section(values, { errors });

      expect(screen.getByText(/must be after filing date/i)).toBeInTheDocument();
    });

    it('audit date is optional (no validation error)', () => {
      const values = createFormValues({
        eta9089FilingDate: '2024-06-01',
        eta9089CertificationDate: '2024-09-01',
        // audit date intentionally omitted
      });

      renderETA9089Section(values);

      const auditInput = screen.getByLabelText(/audit date/i) as HTMLInputElement;
      expect(auditInput.value).toBe('');
    });
  });

  // ==========================================================================
  // USER INTERACTION TESTS
  // ==========================================================================

  describe('User Interactions', () => {
    it('calls onChange when filing date changes', () => {
      const values = createFormValues();

      renderETA9089Section(values);

      const filingInput = screen.getByLabelText(/filing date/i);
      fireEvent.change(filingInput, { target: { value: '2024-06-15' } });

      // Date fields call onDateChange, not onChange
      expect(mockOnDateChange).toHaveBeenCalledWith('eta9089FilingDate', '2024-06-15');
    });

    it('calls onChange when audit date changes', () => {
      const values = createFormValues();

      renderETA9089Section(values);

      const auditInput = screen.getByLabelText(/audit date/i);
      fireEvent.change(auditInput, { target: { value: '2024-07-01' } });

      // Date fields call onDateChange, not onChange
      expect(mockOnDateChange).toHaveBeenCalledWith('eta9089AuditDate', '2024-07-01');
    });

    it('calls onChange when case number changes', async () => {
      const user = userEvent.setup();
      const values = createFormValues();

      renderETA9089Section(values);

      const caseNumberInput = screen.getByLabelText(/case number/i);
      await user.type(caseNumberInput, 'ETA-2024-001');

      expect(mockOnChange).toHaveBeenCalledWith('eta9089CaseNumber', expect.any(String));
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('handles missing recruitment end date gracefully', () => {
      const values = createFormValues({
        // No recruitment dates
      });

      renderETA9089Section(values);

      // Should not crash, should show some neutral state
      expect(screen.getByText('ETA 9089')).toBeInTheDocument();
    });

    it('handles missing PWD expiration gracefully', () => {
      const recruitmentStartDate = new Date('2024-05-01'); // First recruitment
      const recruitmentEndDate = new Date('2024-05-01');

      const values = createFormValues({
        // Start dates for 180-day window calculation
        sundayAdFirstDate: toISODate(recruitmentStartDate),
        jobOrderStartDate: toISODate(recruitmentStartDate),
        noticeOfFilingStartDate: toISODate(recruitmentStartDate),
        // End dates for 30-day opening calculation
        sundayAdSecondDate: toISODate(recruitmentEndDate),
        jobOrderEndDate: toISODate(recruitmentEndDate),
        noticeOfFilingEndDate: toISODate(recruitmentEndDate),
        // No PWD expiration
      });

      // Mock current date to be during open window
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15')); // 45 days after recruitment

      renderETA9089Section(values);

      // Should show window based on recruitment dates only
      // FilingWindowIndicator may have multiple elements matching "open" - use getAllByText
      const openElements = screen.getAllByText(/open/i);
      expect(openElements.length).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it('handles already-filed case', () => {
      const values = createFormValues({
        eta9089FilingDate: '2024-06-15',
        eta9089CertificationDate: '2024-09-01',
        eta9089ExpirationDate: '2025-02-28',
      });

      renderETA9089Section(values);

      // All fields should be visible and populated
      const filingInput = screen.getByLabelText(/filing date/i) as HTMLInputElement;
      expect(filingInput.value).toBe('2024-06-15');
    });
  });
});
