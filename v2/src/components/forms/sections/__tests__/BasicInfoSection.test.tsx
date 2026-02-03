// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../../test-utils/render-utils';
import { BasicInfoSection } from '../BasicInfoSection';

const mockValues = {
  employerName: 'Tech Corp Inc',
  beneficiaryIdentifier: 'JD',
  positionTitle: 'Senior Software Engineer',
  caseNumber: 'CASE-2024-001',
  caseStatus: 'pwd' as const,
  progressStatus: 'working' as const,
};
const mockOnChange = vi.fn();

describe('BasicInfoSection', () => {
  it('renders section title and all fields', () => {
    renderWithProviders(<BasicInfoSection values={mockValues} onChange={mockOnChange} />);
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    for (const label of ['Employer Name', 'Foreign Worker ID', 'Position Title', 'Case Number', 'Case Status', 'Progress Status']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  describe('required field indicators', () => {
    it.each([
      ['Employer Name', true],
      ['Position Title', true],
      ['Case Status', true],
      ['Progress Status', true],
      ['Foreign Worker ID', false],
      ['Case Number', false],
    ])('%s required=%s', (label, isRequired) => {
      renderWithProviders(<BasicInfoSection values={mockValues} onChange={mockOnChange} />);
      const fieldLabel = screen.getByText(label).closest('label');
      if (isRequired) {
        expect(fieldLabel?.textContent).toContain('*');
      } else {
        const asterisks = fieldLabel?.querySelectorAll('[class*="text-destructive"]');
        expect(asterisks?.length || 0).toBe(0);
      }
    });
  });

  describe('error display', () => {
    it('displays errors for fields', () => {
      renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange}
          errors={{ employerName: 'Employer name is required', positionTitle: 'Position title is required' }} />
      );
      expect(screen.getByText('Employer name is required')).toBeInTheDocument();
      expect(screen.getByText('Position title is required')).toBeInTheDocument();
    });

    it.each([{}, undefined])('does not display errors when errors=%s', (errors) => {
      renderWithProviders(<BasicInfoSection values={mockValues} onChange={mockOnChange} errors={errors} />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('case status dropdown', () => {
    const findSelect = (container: HTMLElement, name: string) =>
      Array.from(container.querySelectorAll('select')).find(
        (s) => s.id?.includes(name) || s.name?.includes(name)
      );

    it.each([
      ['pwd', 'PWD'],
      ['recruitment', 'Recruitment'],
      ['eta9089', 'ETA 9089'],
      ['i140', 'I-140'],
      ['closed', 'Closed'],
    ])('includes %s option with label %s', (value, label) => {
      const { container } = renderWithProviders(<BasicInfoSection values={mockValues} onChange={mockOnChange} />);
      const select = findSelect(container, 'caseStatus');
      const option = select?.querySelector(`option[value="${value}"]`);
      expect(option).toBeInTheDocument();
      expect(option?.textContent).toBe(label);
    });

    it('has 5 status options', () => {
      const { container } = renderWithProviders(<BasicInfoSection values={mockValues} onChange={mockOnChange} />);
      const select = findSelect(container, 'caseStatus');
      const options = Array.from(select?.querySelectorAll('option') || []).filter(opt => opt.value && !opt.disabled);
      expect(options.length).toBe(5);
    });

    it('displays selected value', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={{ ...mockValues, caseStatus: 'recruitment' }} onChange={mockOnChange} />
      );
      expect((findSelect(container, 'caseStatus') as HTMLSelectElement)?.value).toBe('recruitment');
    });
  });

  describe('progress status dropdown', () => {
    const findSelect = (container: HTMLElement, name: string) =>
      Array.from(container.querySelectorAll('select')).find(
        (s) => s.id?.includes(name) || s.name?.includes(name)
      );

    it.each([
      ['working', 'Working'],
      ['waiting_intake', 'Waiting for Intake'],
      ['filed', 'Filed'],
      ['approved', 'Approved'],
      ['under_review', 'Under Review'],
      ['rfi_rfe', 'RFI/RFE'],
    ])('includes %s option with label %s', (value, label) => {
      const { container } = renderWithProviders(<BasicInfoSection values={mockValues} onChange={mockOnChange} />);
      const select = findSelect(container, 'progressStatus');
      const option = select?.querySelector(`option[value="${value}"]`);
      expect(option).toBeInTheDocument();
      expect(option?.textContent).toBe(label);
    });

    it('has 6 progress options and displays selected value', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={{ ...mockValues, progressStatus: 'filed' }} onChange={mockOnChange} />
      );
      const select = findSelect(container, 'progressStatus');
      const options = Array.from(select?.querySelectorAll('option') || []).filter(opt => opt.value && !opt.disabled);
      expect(options.length).toBe(6);
      expect((select as HTMLSelectElement)?.value).toBe('filed');
    });
  });

  describe('onChange callbacks', () => {
    it('calls onChange when employer name changes', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(<BasicInfoSection values={mockValues} onChange={onChange} />);
      const input = Array.from(container.querySelectorAll('input[type="text"]')).find(
        (i) => (i as HTMLInputElement).value === mockValues.employerName
      ) as HTMLInputElement;
      await user.clear(input);
      await user.type(input, 'New Company');
      expect(onChange).toHaveBeenCalled();
    });

    it.each([
      ['caseStatus', 'recruitment'],
      ['progressStatus', 'filed'],
    ])('calls onChange when %s changes', async (field, value) => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(<BasicInfoSection values={mockValues} onChange={onChange} />);
      const select = Array.from(container.querySelectorAll('select')).find(
        (s) => s.id?.includes(field) || s.name?.includes(field)
      ) as HTMLSelectElement;
      await user.selectOptions(select, value);
      expect(onChange).toHaveBeenCalledWith(field, value);
    });
  });

  it('shows colored status indicator dot for each case status', () => {
    const { container } = renderWithProviders(<BasicInfoSection values={mockValues} onChange={mockOnChange} />);
    expect(container.querySelector('[class*="w-3"][class*="h-3"][class*="rounded-full"]')).toBeInTheDocument();
  });
});
