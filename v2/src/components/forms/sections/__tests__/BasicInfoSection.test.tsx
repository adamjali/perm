// @vitest-environment jsdom
/**
 * BasicInfoSection Component Tests (TDD)
 * Tests written BEFORE implementation following TDD methodology.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../../test-utils/render-utils';
import { BasicInfoSection } from '../BasicInfoSection';

describe('BasicInfoSection', () => {
  // ============================================================================
  // TEST DATA
  // ============================================================================

  const mockValues = {
    employerName: 'Tech Corp Inc',
    beneficiaryIdentifier: 'JD',
    positionTitle: 'Senior Software Engineer',
    caseNumber: 'CASE-2024-001',
    caseStatus: 'pwd' as const,
    progressStatus: 'working' as const,
  };

  const mockOnChange = vi.fn();

  // ============================================================================
  // BASIC RENDERING
  // ============================================================================

  describe('Basic Rendering', () => {
    it('renders section title "Basic Information"', () => {
      renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    it('renders all required fields', () => {
      renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      // Should have labels for all required fields
      expect(screen.getByText('Employer Name')).toBeInTheDocument();
      expect(screen.getByText('Foreign Worker ID')).toBeInTheDocument();
      expect(screen.getByText('Position Title')).toBeInTheDocument();
    });

    it('renders optional case number field', () => {
      renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      expect(screen.getByText('Case Number')).toBeInTheDocument();
    });

    it('renders case status dropdown', () => {
      renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      expect(screen.getByText('Case Status')).toBeInTheDocument();
    });

    it('renders progress status dropdown', () => {
      renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      expect(screen.getByText('Progress Status')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // REQUIRED FIELD INDICATORS
  // ============================================================================

  describe('Required Field Indicators', () => {
    it('shows required indicator on employerName', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      // Find the label for employerName and check for asterisk
      const employerLabel = screen.getByText('Employer Name').closest('label');
      expect(employerLabel?.textContent).toContain('*');
    });

    it('shows foreignWorkerId as optional (no required indicator)', () => {
      renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const foreignWorkerLabel = screen.getByText('Foreign Worker ID').closest('label');
      // Foreign Worker ID is now optional, so should NOT have the required indicator
      expect(foreignWorkerLabel?.textContent).not.toContain('*');
    });

    it('shows required indicator on positionTitle', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const positionLabel = screen.getByText('Position Title').closest('label');
      expect(positionLabel?.textContent).toContain('*');
    });

    it('shows required indicator on caseStatus', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const caseStatusLabel = screen.getByText('Case Status').closest('label');
      expect(caseStatusLabel?.textContent).toContain('*');
    });

    it('shows required indicator on progressStatus', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const progressLabel = screen.getByText('Progress Status').closest('label');
      expect(progressLabel?.textContent).toContain('*');
    });

    it('does NOT show required indicator on caseNumber (optional)', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const caseNumberLabel = screen.getByText('Case Number').closest('label');
      // Should NOT contain asterisk (optional field)
      const asterisks = caseNumberLabel?.querySelectorAll('[class*="text-destructive"]');
      expect(asterisks?.length || 0).toBe(0);
    });
  });

  // ============================================================================
  // ERROR DISPLAY
  // ============================================================================

  describe('Error Display', () => {
    it('displays error for employerName', () => {
      renderWithProviders(
        <BasicInfoSection
          values={mockValues}
          onChange={mockOnChange}
          errors={{ employerName: 'Employer name is required' }}
        />
      );

      expect(screen.getByText('Employer name is required')).toBeInTheDocument();
    });

    it('displays multiple errors for different fields', () => {
      renderWithProviders(
        <BasicInfoSection
          values={mockValues}
          onChange={mockOnChange}
          errors={{
            employerName: 'Employer name is required',
            positionTitle: 'Position title is required',
          }}
        />
      );

      expect(screen.getByText('Employer name is required')).toBeInTheDocument();
      expect(screen.getByText('Position title is required')).toBeInTheDocument();
    });

    it('does not display errors when errors prop is empty', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} errors={{}} />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not display errors when errors prop is undefined', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // CASE STATUS DROPDOWN
  // ============================================================================

  describe('Case Status Dropdown', () => {
    it('has 5 case status options', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      // Find the case status select element
      const selects = container.querySelectorAll('select');
      const caseStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('caseStatus') ||
               select.name?.includes('caseStatus') ||
               select.getAttribute('aria-label')?.includes('Case Status');
      });

      expect(caseStatusSelect).toBeInTheDocument();
      const options = caseStatusSelect?.querySelectorAll('option');

      // Should have 5 status options (excluding placeholder if any)
      const statusOptions = Array.from(options || []).filter(
        opt => opt.value && !opt.disabled
      );
      expect(statusOptions.length).toBe(5);
    });

    it('includes PWD status option', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const caseStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('caseStatus') || select.name?.includes('caseStatus');
      });

      const pwdOption = caseStatusSelect?.querySelector('option[value="pwd"]');
      expect(pwdOption).toBeInTheDocument();
      expect(pwdOption?.textContent).toBe('PWD');
    });

    it('includes Recruitment status option', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const caseStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('caseStatus') || select.name?.includes('caseStatus');
      });

      const recruitmentOption = caseStatusSelect?.querySelector('option[value="recruitment"]');
      expect(recruitmentOption).toBeInTheDocument();
      expect(recruitmentOption?.textContent).toBe('Recruitment');
    });

    it('includes ETA 9089 status option', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const caseStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('caseStatus') || select.name?.includes('caseStatus');
      });

      const eta9089Option = caseStatusSelect?.querySelector('option[value="eta9089"]');
      expect(eta9089Option).toBeInTheDocument();
      expect(eta9089Option?.textContent).toBe('ETA 9089');
    });

    it('includes I-140 status option', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const caseStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('caseStatus') || select.name?.includes('caseStatus');
      });

      const i140Option = caseStatusSelect?.querySelector('option[value="i140"]');
      expect(i140Option).toBeInTheDocument();
      expect(i140Option?.textContent).toBe('I-140');
    });

    it('includes Closed status option', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const caseStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('caseStatus') || select.name?.includes('caseStatus');
      });

      const closedOption = caseStatusSelect?.querySelector('option[value="closed"]');
      expect(closedOption).toBeInTheDocument();
      expect(closedOption?.textContent).toBe('Closed');
    });

    it('displays selected case status value', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection
          values={{ ...mockValues, caseStatus: 'recruitment' }}
          onChange={mockOnChange}
        />
      );

      const selects = container.querySelectorAll('select');
      const caseStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('caseStatus') || select.name?.includes('caseStatus');
      }) as HTMLSelectElement;

      expect(caseStatusSelect?.value).toBe('recruitment');
    });
  });

  // ============================================================================
  // PROGRESS STATUS DROPDOWN
  // ============================================================================

  describe('Progress Status Dropdown', () => {
    it('has 6 progress status options', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const progressStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('progressStatus') ||
               select.name?.includes('progressStatus') ||
               select.getAttribute('aria-label')?.includes('Progress Status');
      });

      expect(progressStatusSelect).toBeInTheDocument();
      const options = progressStatusSelect?.querySelectorAll('option');

      const statusOptions = Array.from(options || []).filter(
        opt => opt.value && !opt.disabled
      );
      expect(statusOptions.length).toBe(6);
    });

    it('includes Working status option', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const progressStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('progressStatus') || select.name?.includes('progressStatus');
      });

      const workingOption = progressStatusSelect?.querySelector('option[value="working"]');
      expect(workingOption).toBeInTheDocument();
      expect(workingOption?.textContent).toBe('Working');
    });

    it('includes Waiting for Intake status option', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const progressStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('progressStatus') || select.name?.includes('progressStatus');
      });

      const waitingOption = progressStatusSelect?.querySelector('option[value="waiting_intake"]');
      expect(waitingOption).toBeInTheDocument();
      expect(waitingOption?.textContent).toBe('Waiting for Intake');
    });

    it('includes Filed status option', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const progressStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('progressStatus') || select.name?.includes('progressStatus');
      });

      const filedOption = progressStatusSelect?.querySelector('option[value="filed"]');
      expect(filedOption).toBeInTheDocument();
      expect(filedOption?.textContent).toBe('Filed');
    });

    it('includes Approved status option', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const progressStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('progressStatus') || select.name?.includes('progressStatus');
      });

      const approvedOption = progressStatusSelect?.querySelector('option[value="approved"]');
      expect(approvedOption).toBeInTheDocument();
      expect(approvedOption?.textContent).toBe('Approved');
    });

    it('includes Under Review status option', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const progressStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('progressStatus') || select.name?.includes('progressStatus');
      });

      const reviewOption = progressStatusSelect?.querySelector('option[value="under_review"]');
      expect(reviewOption).toBeInTheDocument();
      expect(reviewOption?.textContent).toBe('Under Review');
    });

    it('includes RFI/RFE status option', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const progressStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('progressStatus') || select.name?.includes('progressStatus');
      });

      const rfiRfeOption = progressStatusSelect?.querySelector('option[value="rfi_rfe"]');
      expect(rfiRfeOption).toBeInTheDocument();
      expect(rfiRfeOption?.textContent).toBe('RFI/RFE');
    });

    it('displays selected progress status value', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection
          values={{ ...mockValues, progressStatus: 'filed' }}
          onChange={mockOnChange}
        />
      );

      const selects = container.querySelectorAll('select');
      const progressStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('progressStatus') || select.name?.includes('progressStatus');
      }) as HTMLSelectElement;

      expect(progressStatusSelect?.value).toBe('filed');
    });
  });

  // ============================================================================
  // ONCHANGE CALLBACKS
  // ============================================================================

  describe('onChange Callbacks', () => {
    it('calls onChange when employer name changes', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={onChange} />
      );

      const inputs = container.querySelectorAll('input[type="text"]');
      const employerInput = Array.from(inputs).find(input => {
        return input.id?.includes('employerName') ||
               (input as HTMLInputElement).value === mockValues.employerName;
      }) as HTMLInputElement;

      expect(employerInput).toBeInTheDocument();

      await user.clear(employerInput);
      await user.type(employerInput, 'New Company');

      expect(onChange).toHaveBeenCalled();
    });

    it('calls onChange with correct field name for beneficiaryIdentifier', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={onChange} />
      );

      const inputs = container.querySelectorAll('input[type="text"]');
      const beneficiaryInput = Array.from(inputs).find(input => {
        return input.id?.includes('beneficiaryIdentifier') ||
               (input as HTMLInputElement).placeholder?.includes('Initials');
      }) as HTMLInputElement;

      expect(beneficiaryInput).toBeInTheDocument();

      await user.clear(beneficiaryInput);
      await user.type(beneficiaryInput, 'AB');

      expect(onChange).toHaveBeenCalled();
      // Check at least one call has 'beneficiaryIdentifier' as first arg
      const beneficiaryCalls = onChange.mock.calls.filter(call => call[0] === 'beneficiaryIdentifier');
      expect(beneficiaryCalls.length).toBeGreaterThan(0);
    });

    it('calls onChange when case status changes', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={onChange} />
      );

      const selects = container.querySelectorAll('select');
      const caseStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('caseStatus') || select.name?.includes('caseStatus');
      }) as HTMLSelectElement;

      expect(caseStatusSelect).toBeInTheDocument();

      await user.selectOptions(caseStatusSelect, 'recruitment');

      expect(onChange).toHaveBeenCalledWith('caseStatus', 'recruitment');
    });

    it('calls onChange when progress status changes', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={onChange} />
      );

      const selects = container.querySelectorAll('select');
      const progressStatusSelect = Array.from(selects).find(select => {
        return select.id?.includes('progressStatus') || select.name?.includes('progressStatus');
      }) as HTMLSelectElement;

      expect(progressStatusSelect).toBeInTheDocument();

      await user.selectOptions(progressStatusSelect, 'filed');

      expect(onChange).toHaveBeenCalledWith('progressStatus', 'filed');
    });
  });

  // ============================================================================
  // STATUS COLOR INDICATORS
  // ============================================================================

  describe('Status Color Indicators', () => {
    it('shows colored dot for PWD status', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection
          values={{ ...mockValues, caseStatus: 'pwd' }}
          onChange={mockOnChange}
        />
      );

      // Should have a colored dot element (w-3 h-3 rounded-full)
      const statusDot = container.querySelector('[class*="w-3"][class*="h-3"][class*="rounded-full"]');
      expect(statusDot).toBeInTheDocument();
    });

    it('shows colored dot for Recruitment status', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection
          values={{ ...mockValues, caseStatus: 'recruitment' }}
          onChange={mockOnChange}
        />
      );

      const statusDot = container.querySelector('[class*="w-3"][class*="h-3"][class*="rounded-full"]');
      expect(statusDot).toBeInTheDocument();
    });

    it('shows colored dot for ETA 9089 status', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection
          values={{ ...mockValues, caseStatus: 'eta9089' }}
          onChange={mockOnChange}
        />
      );

      const statusDot = container.querySelector('[class*="w-3"][class*="h-3"][class*="rounded-full"]');
      expect(statusDot).toBeInTheDocument();
    });

    it('shows colored dot for I-140 status', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection
          values={{ ...mockValues, caseStatus: 'i140' }}
          onChange={mockOnChange}
        />
      );

      const statusDot = container.querySelector('[class*="w-3"][class*="h-3"][class*="rounded-full"]');
      expect(statusDot).toBeInTheDocument();
    });

    it('shows colored dot for Closed status', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection
          values={{ ...mockValues, caseStatus: 'closed' }}
          onChange={mockOnChange}
        />
      );

      const statusDot = container.querySelector('[class*="w-3"][class*="h-3"][class*="rounded-full"]');
      expect(statusDot).toBeInTheDocument();
    });
  });

  // ============================================================================
  // LAYOUT
  // ============================================================================

  describe('Layout', () => {
    it('uses 2-column grid on desktop', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      // Should have grid with md:grid-cols-2
      const gridElement = container.querySelector('[class*="md:grid-cols-2"]') ||
                         container.querySelector('[class*="grid-cols-2"]');
      expect(gridElement).toBeInTheDocument();
    });

    it('renders beneficiaryIdentifier with placeholder text', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );

      const inputs = container.querySelectorAll('input[type="text"]');
      const beneficiaryInput = Array.from(inputs).find(input => {
        return (input as HTMLInputElement).placeholder?.includes('Initials') ||
               (input as HTMLInputElement).placeholder?.includes('unique ID');
      });

      expect(beneficiaryInput).toBeInTheDocument();
    });
  });
});
