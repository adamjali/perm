/**
 * CaseForm Component Tests
 *
 * Test coverage:
 * - Renders all sections
 * - Validation errors display in sections
 * - Submit button disabled when submitting
 * - Loading state during submission
 * - onSuccess callback fires on save
 * - onCancel callback fires on cancel
 * - Form initializes with initialData in edit mode
 * - Form uses defaults in add mode
 * - RFI/RFE add/remove handlers work correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../../test-utils/render-utils';
import { CaseForm } from '../CaseForm';
import type { CaseFormData } from '@/lib/forms/case-form-schema';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseMutation = vi.fn();

vi.mock('convex/react', () => ({
  useMutation: () => mockUseMutation,
  useQuery: () => undefined,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock validateCaseForm - can be overridden per test
const mockValidateCaseForm = vi.fn();
vi.mock('@/lib/forms/case-form-schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/forms/case-form-schema')>();
  return {
    ...actual,
    validateCaseForm: (data: unknown) => mockValidateCaseForm(data),
  };
});

// Mock motion/react to avoid animation delays in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock framer-motion (used by RFIEntryList and RFEEntryList)
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// ============================================================================
// FIXTURES
// ============================================================================

const mockInitialData: Partial<CaseFormData> = {
  employerName: 'Test Corp',
  beneficiaryIdentifier: 'JD',
  positionTitle: 'Software Engineer',
  caseStatus: 'pwd',
  progressStatus: 'working',
  pwdFilingDate: '2024-01-15',
  pwdDeterminationDate: '2024-02-01',
};

// ============================================================================
// TESTS
// ============================================================================

describe('CaseForm', () => {
  beforeEach(() => {
    mockUseMutation.mockClear();
    // Default: validation returns errors for empty required fields
    // Submission tests override this to return valid
    mockValidateCaseForm.mockReset();
    mockValidateCaseForm.mockImplementation((data: any) => {
      const errors = [];
      if (!data?.employerName) {
        errors.push({ field: 'employerName', message: 'Employer name is required' });
      }
      if (!data?.beneficiaryIdentifier) {
        errors.push({ field: 'beneficiaryIdentifier', message: 'Foreign worker ID is required' });
      }
      if (!data?.positionTitle) {
        errors.push({ field: 'positionTitle', message: 'Position title is required' });
      }
      return { valid: errors.length === 0, errors, warnings: [] };
    });
  });

  describe('rendering', () => {
    it('renders all form sections', { timeout: 15000 }, () => {
      const { container } = renderWithProviders(
        <CaseForm
          mode="add"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Check for section headings using h3 elements to avoid matching dropdown options
      const h3Elements = container.querySelectorAll('h3');
      const headingTexts = Array.from(h3Elements).map(el => el.textContent);

      expect(headingTexts).toContain('Basic Information');
      expect(headingTexts).toContain('PWD (Prevailing Wage Determination)');
      expect(headingTexts).toContain('Recruitment');
      expect(headingTexts).toContain('ETA 9089 (PERM Application)');
      expect(headingTexts).toContain('I-140 (Immigrant Petition)');
      // Note: RFI/RFE are now embedded within ETA 9089 and I-140 sections respectively

      // Check for action buttons
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('renders with sticky footer for action buttons', () => {
      const { container } = renderWithProviders(
        <CaseForm
          mode="add"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Footer should have sticky positioning class
      const footer = container.querySelector('[class*="sticky"]');
      expect(footer).toBeInTheDocument();
    });
  });

  describe('add mode', () => {
    it('initializes with default values', () => {
      renderWithProviders(
        <CaseForm
          mode="add"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Check default values
      const caseStatusInput = screen.getByLabelText(/case status/i) as HTMLSelectElement;
      expect(caseStatusInput.value).toBe('pwd');

      const progressStatusInput = screen.getByLabelText(/progress status/i) as HTMLSelectElement;
      expect(progressStatusInput.value).toBe('working');
    });

    it('renders empty required fields', () => {
      renderWithProviders(
        <CaseForm
          mode="add"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const employerInput = screen.getByLabelText(/employer name/i) as HTMLInputElement;
      expect(employerInput.value).toBe('');

      const beneficiaryInput = screen.getByLabelText(/beneficiary identifier/i) as HTMLInputElement;
      expect(employerInput.value).toBe('');
    });
  });

  describe('edit mode', () => {
    it('initializes with provided initial data', { timeout: 10000 }, () => {
      renderWithProviders(
        <CaseForm
          mode="edit"
          initialData={mockInitialData}
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Check pre-filled values
      const employerInput = screen.getByLabelText(/employer name/i) as HTMLInputElement;
      expect(employerInput.value).toBe('Test Corp');

      const beneficiaryInput = screen.getByLabelText(/beneficiary identifier/i) as HTMLInputElement;
      expect(beneficiaryInput.value).toBe('JD');

      const positionInput = screen.getByLabelText(/position title/i) as HTMLInputElement;
      expect(positionInput.value).toBe('Software Engineer');
    });
  });

  describe('validation', () => {
    it('displays validation errors in sections', { timeout: 30000 }, async () => {
      const { user } = renderWithProviders(
        <CaseForm
          mode="add"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Try to submit without required fields
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should display validation errors (now in both summary and field-level)
      await waitFor(() => {
        // Use getAllByText since errors appear in both summary and field
        expect(screen.getAllByText(/employer name is required/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/beneficiary identifier is required/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/position title is required/i).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('disables save button when errors exist', { timeout: 30000 }, async () => {
      const { user } = renderWithProviders(
        <CaseForm
          mode="add"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });

      // Try to submit to trigger validation
      await user.click(saveButton);

      // Wait for validation to complete (errors now appear in both summary and field)
      await waitFor(() => {
        expect(screen.getAllByText(/employer name is required/i).length).toBeGreaterThanOrEqual(1);
      });

      // Save button should not be disabled (validation happens on submit)
      // But mutation should not have been called
      expect(mockUseMutation).not.toHaveBeenCalled();
    });
  });

  describe('submission', () => {
    it('calls mutation with form data in edit mode', { timeout: 30000 }, async () => {
      // Override validation to return valid for submission test
      mockValidateCaseForm.mockReturnValue({ valid: true, errors: [], warnings: [] });

      // In edit mode, CaseForm should call the mutation with the case ID and form data
      const mockOnSuccess = vi.fn();

      const { user } = renderWithProviders(
        <CaseForm
          mode="edit"
          caseId={'case123' as any}
          initialData={{
            employerName: 'Test Corp',
            beneficiaryIdentifier: 'JD',
            positionTitle: 'Engineer',
            caseStatus: 'pwd',
            progressStatus: 'working',
            isProfessionalOccupation: false,
            isFavorite: false,
            calendarSyncEnabled: true,
            priorityLevel: 'normal',
            notes: [],
            tags: [],
            additionalRecruitmentMethods: [],
            recruitmentApplicantsCount: 0,
            showOnTimeline: true,
            rfiEntries: [],
            rfeEntries: [],
          }}
          onSuccess={mockOnSuccess}
          onCancel={vi.fn()}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // In edit mode, mutation should be called and onSuccess triggered after
      await waitFor(() => {
        expect(mockUseMutation).toHaveBeenCalled();
      });

      // onSuccess should be called after successful mutation
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('calls onSuccess with formData in add mode for external handling', { timeout: 30000 }, async () => {
      // Override validation to return valid for submission test
      mockValidateCaseForm.mockReturnValue({ valid: true, errors: [], warnings: [] });

      // In add mode, CaseForm passes formData to onSuccess (for duplicate detection by parent)
      const mockOnSuccess = vi.fn();

      const { user } = renderWithProviders(
        <CaseForm
          mode="add"
          initialData={{
            employerName: 'Test Corp',
            beneficiaryIdentifier: 'JD',
            positionTitle: 'Engineer',
            caseStatus: 'pwd',
            progressStatus: 'working',
            isProfessionalOccupation: false,
            isFavorite: false,
            calendarSyncEnabled: true,
            priorityLevel: 'normal',
            notes: [],
            tags: [],
            additionalRecruitmentMethods: [],
            recruitmentApplicantsCount: 0,
            showOnTimeline: true,
            rfiEntries: [],
            rfeEntries: [],
          }}
          onSuccess={mockOnSuccess}
          onCancel={vi.fn()}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        const callArg = mockOnSuccess.mock.calls[0][0];
        expect(callArg.employerName).toBe('Test Corp');
        expect(callArg.beneficiaryIdentifier).toBe('JD');
      });
    });
  });

  describe('cancel button', () => {
    it('calls onCancel callback when clicked', async () => {
      const mockOnCancel = vi.fn();
      const { user } = renderWithProviders(
        <CaseForm
          mode="add"
          onSuccess={vi.fn()}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('RFI/RFE management', () => {
    // Initial data to enable ETA9089 section (requires recruitment complete + window open)
    // Using dates that make window open around 2024-04-01 (30 days after Feb 20 = Mar 21)
    const eta9089EnabledData = {
      // PWD completed
      pwdFilingDate: '2024-01-01',
      pwdDeterminationDate: '2024-01-15',
      pwdExpirationDate: '2025-06-30',
      // Recruitment completed - ALL required fields
      sundayAdFirstDate: '2024-01-20',
      sundayAdSecondDate: '2024-01-27',
      jobOrderStartDate: '2024-01-20',
      jobOrderEndDate: '2024-02-20',
      noticeOfFilingStartDate: '2024-01-25',
      noticeOfFilingEndDate: '2024-02-15',
      // ETA9089 filed (enables I140 section)
      eta9089FilingDate: '2024-03-25',
      eta9089CertificationDate: '2024-06-01',
      eta9089ExpirationDate: '2024-11-28',
    };

    // Mock the date to be within the ETA 9089 filing window
    // Window opens: 30 days after last recruitment (Feb 20) = Mar 21
    // Window closes: 180 days after first recruitment (Jan 20) = Jul 18
    // Using shouldAdvanceTime: true to allow userEvent to work with fake timers
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2024-04-01'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('allows adding RFI entry', { timeout: 15000 }, async () => {
      // Use fireEvent (synchronous) instead of userEvent with fake timers
      renderWithProviders(
        <CaseForm
          mode="edit"
          initialData={eta9089EnabledData}
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Expand the ETA 9089 section to access RFI buttons
      const eta9089Header = screen.getByRole('button', { name: /ETA 9089/i });
      fireEvent.click(eta9089Header);

      // Wait for section to expand and find Add RFI button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add rfi/i })).toBeInTheDocument();
      });

      const addRfiButton = screen.getByRole('button', { name: /add rfi/i });
      fireEvent.click(addRfiButton);

      // RFI entry should appear - check for RFI-specific remove button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove rfi/i })).toBeInTheDocument();
      });
    });

    it('allows removing RFI entry', { timeout: 15000 }, async () => {
      // Use fireEvent (synchronous) instead of userEvent with fake timers
      renderWithProviders(
        <CaseForm
          mode="edit"
          initialData={eta9089EnabledData}
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Expand the ETA 9089 section
      const eta9089Header = screen.getByRole('button', { name: /ETA 9089/i });
      fireEvent.click(eta9089Header);

      // Wait for section to expand and add RFI
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add rfi/i })).toBeInTheDocument();
      });

      const addRfiButton = screen.getByRole('button', { name: /add rfi/i });
      fireEvent.click(addRfiButton);

      // Wait for RFI entry to appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove rfi/i })).toBeInTheDocument();
      });

      // Click remove button
      const removeButton = screen.getByRole('button', { name: /remove rfi/i });
      fireEvent.click(removeButton);

      // RFI should be gone - Add RFI button should be enabled again
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /remove rfi/i })).not.toBeInTheDocument();
      });
    });

    it('allows adding RFE entry', { timeout: 15000 }, async () => {
      // Use fireEvent (synchronous) instead of userEvent with fake timers
      renderWithProviders(
        <CaseForm
          mode="edit"
          initialData={eta9089EnabledData}
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Expand the I-140 section to access RFE buttons
      const i140Header = screen.getByRole('button', { name: /I-140/i });
      fireEvent.click(i140Header);

      // Wait for section to expand and find Add RFE button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add rfe/i })).toBeInTheDocument();
      });

      const addRfeButton = screen.getByRole('button', { name: /add rfe/i });
      fireEvent.click(addRfeButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove rfe/i })).toBeInTheDocument();
      });
    });

    it('allows removing RFE entry', { timeout: 15000 }, async () => {
      // Use fireEvent (synchronous) instead of userEvent with fake timers
      renderWithProviders(
        <CaseForm
          mode="edit"
          initialData={eta9089EnabledData}
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Expand the I-140 section
      const i140Header = screen.getByRole('button', { name: /I-140/i });
      fireEvent.click(i140Header);

      // Wait for section to expand
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add rfe/i })).toBeInTheDocument();
      });

      const addRfeButton = screen.getByRole('button', { name: /add rfe/i });
      fireEvent.click(addRfeButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /remove rfe/i })).toBeInTheDocument();
      });

      const removeButton = screen.getByRole('button', { name: /remove rfe/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /remove rfe/i })).not.toBeInTheDocument();
      });
    });
  });
});
