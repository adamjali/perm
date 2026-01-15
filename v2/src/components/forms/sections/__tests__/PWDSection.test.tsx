// @vitest-environment jsdom
/**
 * PWDSection Component Tests (TDD)
 * Tests written BEFORE implementation following TDD methodology.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../../test-utils/render-utils';
import { PWDSection } from '../PWDSection';

describe('PWDSection', () => {
  // ============================================================================
  // TEST DATA
  // ============================================================================

  const mockValues = {
    pwdFilingDate: '2024-01-15',
    pwdDeterminationDate: '2024-02-20',
    pwdExpirationDate: '2024-05-20', // Auto-calculated (90 days from determination)
    pwdCaseNumber: 'PWD-2024-001',
    pwdWageAmount: 85000,
    pwdWageLevel: 'Level II',
  };

  const mockOnChange = vi.fn();
  const mockOnDateChange = vi.fn();

  // ============================================================================
  // BASIC RENDERING
  // ============================================================================

  describe('Basic Rendering', () => {
    it('renders section title "PWD (Prevailing Wage Determination)"', () => {
      renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      expect(screen.getByText('PWD (Prevailing Wage Determination)')).toBeInTheDocument();
    });

    it('renders all 6 PWD fields', () => {
      renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      // Check for field labels
      expect(screen.getByText('Filing Date')).toBeInTheDocument();
      expect(screen.getByText('Determination Date')).toBeInTheDocument();
      expect(screen.getByText('Expiration Date')).toBeInTheDocument();
      expect(screen.getByText('PWD Case Number')).toBeInTheDocument();
      expect(screen.getByText('Wage Amount')).toBeInTheDocument();
      expect(screen.getByText('Wage Level')).toBeInTheDocument();
    });

    it('renders filing date as date input', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      const filingDateInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdFilingDate') ||
               (input as HTMLInputElement).value === mockValues.pwdFilingDate;
      });

      expect(filingDateInput).toBeInTheDocument();
    });

    it('renders determination date as date input', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      const determinationInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdDeterminationDate') ||
               (input as HTMLInputElement).value === mockValues.pwdDeterminationDate;
      });

      expect(determinationInput).toBeInTheDocument();
    });

    it('renders expiration date as date input', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      const expirationInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdExpirationDate') ||
               (input as HTMLInputElement).value === mockValues.pwdExpirationDate;
      });

      expect(expirationInput).toBeInTheDocument();
    });

    it('renders PWD case number as text input', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const inputs = container.querySelectorAll('input[type="text"]');
      const caseNumberInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdCaseNumber') ||
               (input as HTMLInputElement).value === mockValues.pwdCaseNumber;
      });

      expect(caseNumberInput).toBeInTheDocument();
    });

    it('renders wage amount as number input', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const inputs = container.querySelectorAll('input[type="number"]');
      const wageAmountInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdWageAmount');
      });

      expect(wageAmountInput).toBeInTheDocument();
    });

    it('renders wage level as select dropdown', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const wageLevelSelect = Array.from(selects).find(select => {
        return select.id?.includes('pwdWageLevel');
      });

      expect(wageLevelSelect).toBeInTheDocument();
    });
  });

  // ============================================================================
  // EXPIRATION FIELD DISABLED STATE
  // ============================================================================

  describe('Expiration Field Disabled State', () => {
    it('expiration date field is disabled/readonly', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      const expirationInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdExpirationDate');
      }) as HTMLInputElement;

      expect(expirationInput).toBeDisabled();
    });

    it('expiration date field has readonly styling', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      const expirationInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdExpirationDate');
      }) as HTMLInputElement;

      // Check for disabled-related classes
      expect(expirationInput?.className).toContain('disabled:');
    });
  });

  // ============================================================================
  // AUTO-CALCULATED FIELD INDICATION
  // ============================================================================

  describe('Auto-calculated Field Indication', () => {
    it('shows "Auto" badge when expiration is in autoCalculatedFields', () => {
      const autoCalculatedFields = new Set(['pwdExpirationDate']);

      renderWithProviders(
        <PWDSection
          values={mockValues}
          onChange={mockOnChange}
          autoCalculatedFields={autoCalculatedFields}
        />
      );

      expect(screen.getByText('Auto')).toBeInTheDocument();
    });

    it('does NOT show "Auto" badge when expiration is NOT in autoCalculatedFields', () => {
      const autoCalculatedFields = new Set<string>();

      renderWithProviders(
        <PWDSection
          values={mockValues}
          onChange={mockOnChange}
          autoCalculatedFields={autoCalculatedFields}
        />
      );

      expect(screen.queryByText('Auto')).not.toBeInTheDocument();
    });

    it('marks expiration field as auto-calculated when in autoCalculatedFields', () => {
      const autoCalculatedFields = new Set(['pwdExpirationDate']);

      const { container } = renderWithProviders(
        <PWDSection
          values={mockValues}
          onChange={mockOnChange}
          autoCalculatedFields={autoCalculatedFields}
        />
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      const expirationInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdExpirationDate');
      });

      // Check for auto-calculated attribute
      const wrapper = expirationInput?.closest('[data-auto-calculated="true"]');
      expect(wrapper).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ERROR DISPLAY
  // ============================================================================

  describe('Error Display', () => {
    it('displays error for filing date', () => {
      renderWithProviders(
        <PWDSection
          values={mockValues}
          onChange={mockOnChange}
          errors={{ pwdFilingDate: 'Cannot be in future' }}
        />
      );

      expect(screen.getByText('Cannot be in future')).toBeInTheDocument();
    });

    it('displays error for determination date', () => {
      renderWithProviders(
        <PWDSection
          values={mockValues}
          onChange={mockOnChange}
          errors={{ pwdDeterminationDate: 'Must be after filing date' }}
        />
      );

      expect(screen.getByText('Must be after filing date')).toBeInTheDocument();
    });

    it('displays multiple errors for different fields', () => {
      renderWithProviders(
        <PWDSection
          values={mockValues}
          onChange={mockOnChange}
          errors={{
            pwdFilingDate: 'Cannot be in future',
            pwdDeterminationDate: 'Must be after filing date',
          }}
        />
      );

      expect(screen.getByText('Cannot be in future')).toBeInTheDocument();
      expect(screen.getByText('Must be after filing date')).toBeInTheDocument();
    });

    it('does not display errors when errors prop is empty', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} errors={{}} />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not display errors when errors prop is undefined', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // ONCHANGE CALLBACKS
  // ============================================================================

  describe('onChange Callbacks', () => {
    it('calls onChange when filing date changes', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={onChange} />
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      const filingDateInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdFilingDate');
      }) as HTMLInputElement;

      expect(filingDateInput).toBeInTheDocument();

      await user.clear(filingDateInput);
      await user.type(filingDateInput, '2024-01-20');

      expect(onChange).toHaveBeenCalled();
    });

    it('calls onChange with correct field name for determination date', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={onChange} />
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      const determinationInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdDeterminationDate');
      }) as HTMLInputElement;

      expect(determinationInput).toBeInTheDocument();

      await user.clear(determinationInput);
      await user.type(determinationInput, '2024-02-25');

      expect(onChange).toHaveBeenCalled();
      // Check that at least one call has 'pwdDeterminationDate' as first arg
      const determinationCalls = onChange.mock.calls.filter(
        call => call[0] === 'pwdDeterminationDate'
      );
      expect(determinationCalls.length).toBeGreaterThan(0);
    });

    it('calls onChange when PWD case number changes', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={onChange} />
      );

      const inputs = container.querySelectorAll('input[type="text"]');
      const caseNumberInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdCaseNumber');
      }) as HTMLInputElement;

      expect(caseNumberInput).toBeInTheDocument();

      await user.clear(caseNumberInput);
      await user.type(caseNumberInput, 'PWD-2024-002');

      expect(onChange).toHaveBeenCalled();
    });

    it('calls onChange when wage amount changes', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={onChange} />
      );

      const inputs = container.querySelectorAll('input[type="number"]');
      const wageAmountInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdWageAmount');
      }) as HTMLInputElement;

      expect(wageAmountInput).toBeInTheDocument();

      await user.clear(wageAmountInput);
      await user.type(wageAmountInput, '90000');

      expect(onChange).toHaveBeenCalled();
    });

    it('calls onChange when wage level changes', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={onChange} />
      );

      const selects = container.querySelectorAll('select');
      const wageLevelSelect = Array.from(selects).find(select => {
        return select.id?.includes('pwdWageLevel');
      }) as HTMLSelectElement;

      expect(wageLevelSelect).toBeInTheDocument();

      await user.selectOptions(wageLevelSelect, 'Level III');

      expect(onChange).toHaveBeenCalledWith('pwdWageLevel', 'Level III');
    });
  });

  // ============================================================================
  // ONDATECHANGE CALLBACK
  // ============================================================================

  describe('onDateChange Callback', () => {
    it('calls onDateChange when determination date changes', async () => {
      const onDateChange = vi.fn();
      const { user, container } = renderWithProviders(
        <PWDSection
          values={mockValues}
          onChange={mockOnChange}
          onDateChange={onDateChange}
        />
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      const determinationInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdDeterminationDate');
      }) as HTMLInputElement;

      await user.clear(determinationInput);
      await user.type(determinationInput, '2024-04-15');

      expect(onDateChange).toHaveBeenCalled();
      const determinationCalls = onDateChange.mock.calls.filter(
        call => call[0] === 'pwdDeterminationDate'
      );
      expect(determinationCalls.length).toBeGreaterThan(0);
    });

    it('calls onDateChange when filing date changes', async () => {
      const onDateChange = vi.fn();
      const { user, container } = renderWithProviders(
        <PWDSection
          values={mockValues}
          onChange={mockOnChange}
          onDateChange={onDateChange}
        />
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      const filingInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdFilingDate');
      }) as HTMLInputElement;

      await user.clear(filingInput);
      await user.type(filingInput, '2024-01-10');

      expect(onDateChange).toHaveBeenCalled();
    });

    it('does NOT call onDateChange when onDateChange prop is not provided', async () => {
      const onChange = vi.fn();
      const { user, container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={onChange} />
      );

      const inputs = container.querySelectorAll('input[type="date"]');
      const determinationInput = Array.from(inputs).find(input => {
        return input.id?.includes('pwdDeterminationDate');
      }) as HTMLInputElement;

      // Should not throw error when onDateChange is undefined
      await user.clear(determinationInput);
      await user.type(determinationInput, '2024-04-15');

      expect(onChange).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // WAGE LEVEL DROPDOWN OPTIONS
  // ============================================================================

  describe('Wage Level Dropdown', () => {
    it('has 4 wage level options', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const wageLevelSelect = Array.from(selects).find(select => {
        return select.id?.includes('pwdWageLevel');
      });

      expect(wageLevelSelect).toBeInTheDocument();
      const options = wageLevelSelect?.querySelectorAll('option');

      // Should have 4 wage level options (excluding placeholder if any)
      const levelOptions = Array.from(options || []).filter(
        opt => opt.value && !opt.disabled
      );
      expect(levelOptions.length).toBe(4);
    });

    it('includes Level I option', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const wageLevelSelect = Array.from(selects).find(select => {
        return select.id?.includes('pwdWageLevel');
      });

      const levelIOption = wageLevelSelect?.querySelector('option[value="Level I"]');
      expect(levelIOption).toBeInTheDocument();
      expect(levelIOption?.textContent).toBe('Level I');
    });

    it('includes Level II option', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const wageLevelSelect = Array.from(selects).find(select => {
        return select.id?.includes('pwdWageLevel');
      });

      const levelIIOption = wageLevelSelect?.querySelector('option[value="Level II"]');
      expect(levelIIOption).toBeInTheDocument();
      expect(levelIIOption?.textContent).toBe('Level II');
    });

    it('includes Level III option', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const wageLevelSelect = Array.from(selects).find(select => {
        return select.id?.includes('pwdWageLevel');
      });

      const levelIIIOption = wageLevelSelect?.querySelector('option[value="Level III"]');
      expect(levelIIIOption).toBeInTheDocument();
      expect(levelIIIOption?.textContent).toBe('Level III');
    });

    it('includes Level IV option', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const selects = container.querySelectorAll('select');
      const wageLevelSelect = Array.from(selects).find(select => {
        return select.id?.includes('pwdWageLevel');
      });

      const levelIVOption = wageLevelSelect?.querySelector('option[value="Level IV"]');
      expect(levelIVOption).toBeInTheDocument();
      expect(levelIVOption?.textContent).toBe('Level IV');
    });

    it('displays selected wage level value', () => {
      const { container } = renderWithProviders(
        <PWDSection
          values={{ ...mockValues, pwdWageLevel: 'Level III' }}
          onChange={mockOnChange}
        />
      );

      const selects = container.querySelectorAll('select');
      const wageLevelSelect = Array.from(selects).find(select => {
        return select.id?.includes('pwdWageLevel');
      }) as HTMLSelectElement;

      expect(wageLevelSelect?.value).toBe('Level III');
    });
  });

  // ============================================================================
  // LAYOUT
  // ============================================================================

  describe('Layout', () => {
    it('uses 3-column grid on desktop', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      // Should have grid with md:grid-cols-3
      const gridElement = container.querySelector('[class*="md:grid-cols-3"]') ||
                         container.querySelector('[class*="grid-cols-3"]');
      expect(gridElement).toBeInTheDocument();
    });

    it('renders date fields in first row (3 columns)', () => {
      const { container } = renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const dateInputs = container.querySelectorAll('input[type="date"]');
      expect(dateInputs.length).toBe(3);
    });
  });

  // ============================================================================
  // CONTEXTUAL HINTS
  // ============================================================================

  describe('Contextual Hints', () => {
    it('shows hint about determination date triggering calculation', () => {
      renderWithProviders(
        <PWDSection values={mockValues} onChange={mockOnChange} />
      );

      const hint = screen.getByText(/Determination date triggers expiration calculation/i);
      expect(hint).toBeInTheDocument();
    });
  });
});
