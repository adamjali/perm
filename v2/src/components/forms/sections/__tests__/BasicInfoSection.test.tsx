// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../../test-utils/render-utils';
import { BasicInfoSection } from '../BasicInfoSection';
import { FormSectionProvider } from '@/components/forms/useCaseFormSection';
import type { CaseFormData } from '@/lib/forms/case-form-schema';

const mockValues = {
  employerName: 'Tech Corp Inc',
  beneficiaryIdentifier: 'JD',
  positionTitle: 'Senior Software Engineer',
  caseNumber: 'G-100-24339-516453',
  internalCaseNumber: 'MATTER-2024-001',
  caseStatus: 'pwd' as const,
  progressStatus: 'working' as const,
};
const mockOnChange = vi.fn();

describe('BasicInfoSection', () => {
  it('renders section title and all fields', () => {
    renderWithProviders(<BasicInfoSection values={mockValues} onChange={mockOnChange} />);
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    for (const label of ['Employer Name', 'Foreign Worker ID', 'Position Title', 'DOL case number', 'Internal reference', 'Case Status', 'Progress Status']) {
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
      ['DOL case number', false],
      ['Internal reference', false],
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

  /**
   * The DOL number and the attorney's own reference are two different things
   * and this section used to offer one field for both: labelled "Case Number",
   * asking for an "Internal reference". `internalCaseNumber` was in the zod
   * schema, the CSV export, the importer and the AI tools with no input in the
   * form at all, so whatever was typed here went to the DOL field.
   */
  describe('case numbers', () => {
    it('renders each number in its own input, carrying its own value', () => {
      const { container } = renderWithProviders(
        <BasicInfoSection values={mockValues} onChange={mockOnChange} />
      );
      const dol = container.querySelector<HTMLInputElement>('#caseNumber');
      const internal = container.querySelector<HTMLInputElement>('#internalCaseNumber');

      expect(dol?.value).toBe('G-100-24339-516453');
      expect(dol?.placeholder).toBe('G-100-24339-516453');
      expect(internal?.value).toBe('MATTER-2024-001');
      expect(internal?.name).toBe('internalCaseNumber');
    });

    it.each([
      ['caseNumber', 'G-100-25001-000111'],
      ['internalCaseNumber', 'MATTER-2025-777'],
    ])('typing in %s reports that exact schema key', async (field, typed) => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <BasicInfoSection values={{ ...mockValues, caseNumber: '', internalCaseNumber: '' }} onChange={onChange} />
      );
      const input = container.querySelector<HTMLInputElement>(`#${field}`)!;
      await user.type(input, typed);

      const fieldsTouched = new Set(onChange.mock.calls.map((c) => c[0] as string));
      expect(fieldsTouched).toEqual(new Set([field]));
      expect(onChange).toHaveBeenLastCalledWith(field, typed.slice(-1));
    });

    /**
     * Production renders this section through FormSectionProvider, not props.
     * A field the component draws but the hook never reads from context is an
     * input that is always blank and whose edits never reach the form.
     */
    it('reads and writes both numbers through the form context', async () => {
      const onChange = vi.fn();
      const formData = {
        employerName: 'Tech Corp Inc',
        beneficiaryIdentifier: 'JD',
        positionTitle: 'Senior Software Engineer',
        caseNumber: 'G-100-24339-516453',
        internalCaseNumber: 'MATTER-2024-001',
        caseStatus: 'pwd',
        progressStatus: 'working',
      } as unknown as CaseFormData;

      const { user, container } = renderWithProviders(
        <FormSectionProvider
          mode="edit"
          formData={formData}
          errors={{}}
          warnings={{}}
          autoCalculatedFields={new Set()}
          dateConstraints={{}}
          validationStates={{}}
          fieldDisabledStates={{}}
          onChange={onChange}
          onDateChange={vi.fn()}
          onBlur={vi.fn()}
          isAutoStatusEnabled={false}
          onAutoStatusToggle={vi.fn()}
          onCaseStatusChange={vi.fn()}
          onProgressStatusChange={vi.fn()}
          suggestedCaseStatus={null}
          suggestedProgressStatus={null}
        >
          <BasicInfoSection />
        </FormSectionProvider>
      );

      expect(container.querySelector<HTMLInputElement>('#caseNumber')?.value).toBe('G-100-24339-516453');
      expect(container.querySelector<HTMLInputElement>('#internalCaseNumber')?.value).toBe('MATTER-2024-001');

      await user.type(container.querySelector<HTMLInputElement>('#internalCaseNumber')!, 'X');
      expect(onChange).toHaveBeenCalledWith('internalCaseNumber', 'MATTER-2024-001X');
    });

    it('says where the DOL number comes from', () => {
      renderWithProviders(<BasicInfoSection values={mockValues} onChange={mockOnChange} />);
      expect(screen.getByText(/from dol/i)).toBeInTheDocument();
    });
  });

  it('shows colored status indicator dot for each case status', () => {
    const { container } = renderWithProviders(<BasicInfoSection values={mockValues} onChange={mockOnChange} />);
    expect(container.querySelector('[class*="w-3"][class*="h-3"][class*="rounded-full"]')).toBeInTheDocument();
  });
});
