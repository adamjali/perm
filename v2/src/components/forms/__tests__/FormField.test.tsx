// @vitest-environment jsdom
/**
 * FormField Component Tests (TDD)
 * Tests written BEFORE implementation following TDD methodology.
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../test-utils/render-utils';
import { FormField } from '../FormField';

describe('FormField', () => {
  // ============================================================================
  // BASIC RENDERING
  // ============================================================================

  describe('Basic Rendering', () => {
    it('renders label text', () => {
      renderWithProviders(
        <FormField label="Employer Name" name="employerName">
          <input type="text" />
        </FormField>
      );

      expect(screen.getByText('Employer Name')).toBeInTheDocument();
    });

    it('renders children (input element)', () => {
      renderWithProviders(
        <FormField label="Employer Name" name="employerName">
          <input type="text" data-testid="input" />
        </FormField>
      );

      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('renders hint text when provided', () => {
      renderWithProviders(
        <FormField
          label="PWD Filing Date"
          name="pwdFilingDate"
          hint="Date when PWD application was submitted"
        >
          <input type="date" />
        </FormField>
      );

      expect(screen.getByText('Date when PWD application was submitted')).toBeInTheDocument();
    });

    it('does not render hint when not provided', () => {
      const { container } = renderWithProviders(
        <FormField label="Employer Name" name="employerName">
          <input type="text" />
        </FormField>
      );

      expect(container.querySelector('[data-slot="hint"]')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // REQUIRED FIELD INDICATOR
  // ============================================================================

  describe('Required Field Indicator', () => {
    it('shows red asterisk when required', () => {
      renderWithProviders(
        <FormField label="Employer Name" name="employerName" required>
          <input type="text" />
        </FormField>
      );

      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('does not show asterisk when not required', () => {
      renderWithProviders(
        <FormField label="Notes" name="notes">
          <textarea />
        </FormField>
      );

      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });

    it('asterisk has red color styling', () => {
      const { container } = renderWithProviders(
        <FormField label="Employer Name" name="employerName" required>
          <input type="text" />
        </FormField>
      );

      const asterisk = container.querySelector('[class*="text-destructive"]');
      expect(asterisk).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ERROR STATE
  // ============================================================================

  describe('Error State', () => {
    it('renders error message when error prop provided', () => {
      renderWithProviders(
        <FormField
          label="Employer Name"
          name="employerName"
          error="Employer name is required"
        >
          <input type="text" />
        </FormField>
      );

      expect(screen.getByText('Employer name is required')).toBeInTheDocument();
    });

    it('error message has destructive color styling', () => {
      const { container } = renderWithProviders(
        <FormField
          label="Employer Name"
          name="employerName"
          error="Employer name is required"
        >
          <input type="text" />
        </FormField>
      );

      // Find the p element specifically (not the icon which also has text-destructive)
      const errorMessage = container.querySelector('p[class*="text-destructive"]');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage?.textContent).toContain('Employer name is required');
    });

    it('has shake animation class when error is present', () => {
      const { container } = renderWithProviders(
        <FormField
          label="Employer Name"
          name="employerName"
          error="Employer name is required"
        >
          <input type="text" />
        </FormField>
      );

      // Should have animation class
      const errorElement = container.querySelector('[class*="animate-shake"]') ||
                          container.querySelector('[data-error="true"]');
      expect(errorElement).toBeInTheDocument();
    });

    it('does not show error when no error prop', () => {
      renderWithProviders(
        <FormField label="Employer Name" name="employerName">
          <input type="text" />
        </FormField>
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // AUTO-CALCULATED STATE
  // ============================================================================

  describe('Auto-Calculated State', () => {
    it('shows auto-calculated indicator when autoCalculated is true', () => {
      const { container } = renderWithProviders(
        <FormField
          label="PWD Expiration Date"
          name="pwdExpirationDate"
          autoCalculated
        >
          <input type="date" />
        </FormField>
      );

      // Should have visual indicator for auto-calculated
      const indicator = container.querySelector('[data-auto-calculated="true"]') ||
                       screen.queryByText(/auto/i) ||
                       container.querySelector('[class*="auto"]');
      expect(indicator).toBeInTheDocument();
    });

  });

  // ============================================================================
  // LABEL-INPUT ASSOCIATION
  // ============================================================================

  describe('Label-Input Association', () => {
    it('associates label with input via name', () => {
      renderWithProviders(
        <FormField label="Employer Name" name="employerName">
          <input type="text" id="employerName" />
        </FormField>
      );

      const label = screen.getByText('Employer Name');
      expect(label.closest('label')).toHaveAttribute('for', 'employerName');
    });

    it('has data-slot="label" on label element', () => {
      const { container } = renderWithProviders(
        <FormField label="Employer Name" name="employerName">
          <input type="text" />
        </FormField>
      );

      expect(container.querySelector('[data-slot="label"]')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // STYLING
  // ============================================================================

  describe('Neobrutalist Styling', () => {
    it('has proper spacing between elements', () => {
      const { container } = renderWithProviders(
        <FormField
          label="Employer Name"
          name="employerName"
          hint="Enter the employer's full legal name"
        >
          <input type="text" />
        </FormField>
      );

      // Should have flex column layout with gap
      const wrapper = container.querySelector('[class*="flex"][class*="flex-col"]') ||
                     container.querySelector('[class*="space-y"]');
      expect(wrapper).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      const { container } = renderWithProviders(
        <FormField
          label="Employer Name"
          name="employerName"
          className="custom-class"
        >
          <input type="text" />
        </FormField>
      );

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });
});
