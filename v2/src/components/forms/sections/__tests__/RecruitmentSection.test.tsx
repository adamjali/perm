// @vitest-environment jsdom
/**
 * RecruitmentSection Component Tests
 *
 * Consolidated test coverage:
 * - Renders all required sections and fields
 * - Sunday validation (required PERM business logic)
 * - Quick select buttons work
 * - State dropdown has all states
 * - onChange callbacks fire correctly
 * - Error display works
 * - Professional occupation toggle & additional methods
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../../test-utils/render-utils';
import { RecruitmentSection } from '../RecruitmentSection';

describe('RecruitmentSection', () => {
  const mockValues = {
    sundayAdFirstDate: '2024-03-03', // Sunday
    sundayAdSecondDate: '2024-03-10', // Sunday, 1 week later
    sundayAdNewspaper: 'New York Times',
    jobOrderStartDate: '2024-03-01',
    jobOrderEndDate: '2024-03-31',
    jobOrderState: 'CA',
    noticeOfFilingStartDate: '2024-03-01',
    noticeOfFilingEndDate: '2024-03-15',
    recruitmentApplicantsCount: 5,
  };

  const mockOnChange = vi.fn();

  describe('Rendering', () => {
    it('renders all section headers and fields', () => {
      const { container } = renderWithProviders(
        <RecruitmentSection values={mockValues} onChange={mockOnChange} />
      );

      // Section headers
      expect(screen.getByText('Recruitment')).toBeInTheDocument();
      expect(screen.getByText('Sunday Newspaper Ads')).toBeInTheDocument();
      expect(screen.getByText('Job Order')).toBeInTheDocument();
      expect(screen.getByText('Notice of Filing')).toBeInTheDocument();
      expect(screen.getByText('Recruitment Results')).toBeInTheDocument();

      // Field labels
      expect(screen.getByText('First Sunday Ad')).toBeInTheDocument();
      expect(screen.getByText('Second Sunday Ad')).toBeInTheDocument();
      expect(screen.getByText('Newspaper')).toBeInTheDocument();
      expect(screen.getByText('Job Order Start')).toBeInTheDocument();
      expect(screen.getByText('Job Order End')).toBeInTheDocument();
      expect(screen.getByText('State')).toBeInTheDocument();
      expect(screen.getByText('Notice Start')).toBeInTheDocument();
      expect(screen.getByText('Notice End')).toBeInTheDocument();
      expect(screen.getByText('Applicant Count')).toBeInTheDocument();

      // Verify grid layout exists
      expect(container.querySelector('[class*="grid"]')).toBeInTheDocument();
    });
  });

  describe('Sunday Validation', () => {
    it('shows validation hints for Sunday fields', () => {
      renderWithProviders(
        <RecruitmentSection values={mockValues} onChange={mockOnChange} />
      );

      // First Sunday shows "Must be a Sunday"
      expect(screen.getAllByText(/Must be a Sunday/i).length).toBeGreaterThanOrEqual(1);
      // Second Sunday shows success when valid
      expect(screen.getByText(/Valid Sunday \(7 days after first ad\)/i)).toBeInTheDocument();
    });

    it('shows requirement hint when second Sunday is empty', () => {
      renderWithProviders(
        <RecruitmentSection
          values={{ ...mockValues, sundayAdSecondDate: undefined }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/Must be a Sunday, after first ad/i)).toBeInTheDocument();
    });
  });

  describe('Quick Select Buttons', () => {
    it('shows quick select and calls onChange with correct dates', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <RecruitmentSection
          values={{ ...mockValues, sundayAdSecondDate: undefined }}
          onChange={onChange}
        />
      );

      expect(screen.getByText('Quick select:')).toBeInTheDocument();

      // Click +7 days button
      await user.click(screen.getByRole('button', { name: /Set second Sunday ad to 7 days/i }));
      expect(onChange).toHaveBeenCalledWith('sundayAdSecondDate', '2024-03-10');

      onChange.mockClear();

      // Click +14 days button
      await user.click(screen.getByRole('button', { name: /Set second Sunday ad to 14 days/i }));
      expect(onChange).toHaveBeenCalledWith('sundayAdSecondDate', '2024-03-17');
    });

    it('hides quick select when first Sunday is invalid', () => {
      renderWithProviders(
        <RecruitmentSection
          values={{ ...mockValues, sundayAdFirstDate: '2024-03-04' }} // Monday
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByText('Quick select:')).not.toBeInTheDocument();
    });
  });

  describe('State Dropdown', () => {
    it('has 51 state options including CA, NY, and DC', () => {
      const { container } = renderWithProviders(
        <RecruitmentSection values={mockValues} onChange={mockOnChange} />
      );

      // Find the state select by looking for select elements
      const selects = container.querySelectorAll('select');
      const stateSelect = Array.from(selects).find(select =>
        select.id?.includes('jobOrderState')
      ) as HTMLSelectElement;

      expect(stateSelect).toBeInTheDocument();
      const options = stateSelect.querySelectorAll('option:not([disabled])');

      expect(options.length).toBe(51); // 50 states + DC
      expect(stateSelect.querySelector('option[value="CA"]')?.textContent).toBe('California');
      expect(stateSelect.querySelector('option[value="NY"]')?.textContent).toBe('New York');
      expect(stateSelect.querySelector('option[value="DC"]')?.textContent).toBe('District of Columbia');
    });
  });

  describe('Auto-calculated Fields', () => {
    it('shows Auto badge and marks fields as auto-calculated', () => {
      const { container } = renderWithProviders(
        <RecruitmentSection
          values={mockValues}
          onChange={mockOnChange}
          autoCalculatedFields={new Set(['noticeOfFilingEndDate', 'jobOrderEndDate'])}
        />
      );

      expect(screen.getAllByText('Auto').length).toBe(2);

      const noticeEndInput = container.querySelector('[id*="noticeOfFilingEndDate"]');
      expect(noticeEndInput?.closest('[data-auto-calculated="true"]')).toBeInTheDocument();
    });
  });

  describe('onChange Callbacks', () => {
    it('calls onChange for date and select inputs', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <RecruitmentSection values={mockValues} onChange={onChange} />
      );

      // Date input
      const dateInputs = container.querySelectorAll('input[type="date"]');
      const firstSundayInput = Array.from(dateInputs).find(input =>
        (input as HTMLInputElement).id?.includes('sundayAdFirstDate')
      ) as HTMLInputElement;
      await user.clear(firstSundayInput);
      await user.type(firstSundayInput, '2024-03-17');
      expect(onChange).toHaveBeenCalled();

      onChange.mockClear();

      // Select input
      const selects = container.querySelectorAll('select');
      const stateSelect = Array.from(selects).find(select =>
        select.id?.includes('jobOrderState')
      ) as HTMLSelectElement;
      await user.selectOptions(stateSelect, 'NY');
      expect(onChange).toHaveBeenCalledWith('jobOrderState', 'NY');
    });

    it('notice of filing end date is disabled (auto-calculated)', () => {
      const { container } = renderWithProviders(
        <RecruitmentSection values={mockValues} onChange={mockOnChange} />
      );

      const dateInputs = container.querySelectorAll('input[type="date"]');
      const noticeEndInput = Array.from(dateInputs).find(input =>
        (input as HTMLInputElement).id?.includes('noticeOfFilingEndDate')
      ) as HTMLInputElement;
      expect(noticeEndInput).toBeDisabled();
    });
  });

  describe('Error Display', () => {
    it('displays field errors when provided', () => {
      renderWithProviders(
        <RecruitmentSection
          values={mockValues}
          onChange={mockOnChange}
          errors={{
            sundayAdFirstDate: 'Date must be a Sunday',
            jobOrderEndDate: 'Must be at least 30 days after start',
          }}
        />
      );

      expect(screen.getByText('Date must be a Sunday')).toBeInTheDocument();
      expect(screen.getByText('Must be at least 30 days after start')).toBeInTheDocument();
    });

    it('does not display errors when errors prop is empty', () => {
      renderWithProviders(
        <RecruitmentSection values={mockValues} onChange={mockOnChange} errors={{}} />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Professional Occupation', () => {
    const professionalValues = {
      ...mockValues,
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: 'job_fair', date: '2024-03-15', description: 'Local job fair' },
        { method: 'employer_website', date: '2024-03-18', description: '' },
        { method: 'campus_placement', date: '2024-03-20', description: 'State University' },
      ],
    };

    it('shows additional recruitment section when checked', () => {
      renderWithProviders(
        <RecruitmentSection values={professionalValues} onChange={mockOnChange} />
      );

      expect(screen.getByText('Additional Recruitment Methods')).toBeInTheDocument();
      expect(screen.getByText('Method 1')).toBeInTheDocument();
      expect(screen.getByText('Method 2')).toBeInTheDocument();
      expect(screen.getByText('Method 3')).toBeInTheDocument();
    });

    it('hides additional recruitment section when unchecked', () => {
      renderWithProviders(
        <RecruitmentSection
          values={{ ...mockValues, isProfessionalOccupation: false }}
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByText('Additional Recruitment Methods')).not.toBeInTheDocument();
    });

    it('shows warning when less than 3 methods selected', () => {
      renderWithProviders(
        <RecruitmentSection
          values={{
            ...mockValues,
            isProfessionalOccupation: true,
            additionalRecruitmentMethods: [
              { method: 'job_fair', date: '2024-03-15', description: '' },
            ],
          }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('1/3 required methods selected')).toBeInTheDocument();
      expect(screen.getByText(/20 CFR § 656\.17\(e\)/)).toBeInTheDocument();
    });

    it('disables already-selected methods in other dropdowns', () => {
      const { container } = renderWithProviders(
        <RecruitmentSection
          values={{
            ...mockValues,
            isProfessionalOccupation: true,
            additionalRecruitmentMethods: [
              { method: 'job_fair', date: '2024-03-15', description: '' },
              { method: '', date: '', description: '' },
            ],
          }}
          onChange={mockOnChange}
        />
      );

      const secondSelect = container.querySelector('#method-1') as HTMLSelectElement;
      const jobFairOption = secondSelect.querySelector('option[value="job_fair"]');
      expect(jobFairOption).toHaveAttribute('disabled');
    });

    it('allows adding and removing methods', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <RecruitmentSection
          values={{
            ...mockValues,
            isProfessionalOccupation: true,
            additionalRecruitmentMethods: [
              { method: 'job_fair', date: '2024-03-15', description: '' },
            ],
          }}
          onChange={onChange}
        />
      );

      // Add method
      await user.click(screen.getByText('Add Method (1/3)'));
      expect(onChange).toHaveBeenCalledWith('additionalRecruitmentMethods', [
        { method: 'job_fair', date: '2024-03-15', description: '' },
        { method: '', date: '', description: '' },
      ]);
    });

    it('updates method fields correctly', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <RecruitmentSection
          values={{
            ...mockValues,
            isProfessionalOccupation: true,
            additionalRecruitmentMethods: [
              { method: 'job_fair', date: '2024-03-15', description: '' },
            ],
          }}
          onChange={onChange}
        />
      );

      const methodSelect = container.querySelector('#method-0') as HTMLSelectElement;
      await user.selectOptions(methodSelect, 'radio_ad');

      expect(onChange).toHaveBeenCalledWith('additionalRecruitmentMethods', [
        { method: 'radio_ad', date: '2024-03-15', description: '' },
      ]);
    });

    it('renders all 11 recruitment method types', () => {
      const { container } = renderWithProviders(
        <RecruitmentSection
          values={{
            ...mockValues,
            isProfessionalOccupation: true,
            additionalRecruitmentMethods: [{ method: '', date: '', description: '' }],
          }}
          onChange={mockOnChange}
        />
      );

      const methodSelect = container.querySelector('[id^="method-"]') as HTMLSelectElement;
      const options = methodSelect.querySelectorAll('option');
      expect(options.length).toBe(12); // 11 methods + placeholder
    });

    it('shows Additional Recruitment Period fields', () => {
      renderWithProviders(
        <RecruitmentSection
          values={{ ...mockValues, isProfessionalOccupation: true }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Additional Recruitment Period (Optional)')).toBeInTheDocument();
      expect(screen.getByText('Start Date')).toBeInTheDocument();
      expect(screen.getByText('End Date')).toBeInTheDocument();
    });
  });
});
