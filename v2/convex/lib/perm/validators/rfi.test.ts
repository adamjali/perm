import { describe, it, expect } from 'vitest';
import { validateRFI } from './rfi';
import type { ValidationResult } from '../types';

describe('RFI Validator', () => {
  describe('V-RFI-01: RFI received date must be after ETA 9089 filing date', () => {
    it('should pass when RFI received is after ETA 9089 filing', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: '2026-01-15',
        rfi_received_date: '2026-03-20',
        rfi_due_date: null,
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when RFI received is before ETA 9089 filing', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: '2026-03-20',
        rfi_received_date: '2026-01-15',
        rfi_due_date: null,
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-RFI-01');
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].field).toBe('rfi_received_date');
      expect(result.errors[0].message).toContain(
        'RFI received date must be after ETA 9089 filing date'
      );
    });

    it('should skip validation when dates are null', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: null,
        rfi_due_date: null,
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-RFI-02: RFI due date must be EXACTLY received + 30 days', () => {
    it('should pass when due date is exactly 30 days after received', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: '2026-01-15',
        rfi_due_date: '2026-02-14', // Exactly 30 days
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when due date is not exactly 30 days after received', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: '2026-01-15',
        rfi_due_date: '2026-02-20', // 36 days
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-RFI-02');
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].field).toBe('rfi_due_date');
      expect(result.errors[0].message).toContain(
        'RFI due date must be exactly 30 days after received date'
      );
      expect(result.errors[0].message).toContain('2026-02-14');
    });

    it('should skip validation when dates are null', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: null,
        rfi_due_date: '2026-02-14',
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-RFI-03: RFI submitted date must be after received date', () => {
    it('should pass when submitted is after received', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: '2026-01-15',
        rfi_due_date: null,
        rfi_submitted_date: '2026-02-10',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when submitted is before received', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: '2026-02-10',
        rfi_due_date: null,
        rfi_submitted_date: '2026-01-15',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-RFI-03');
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].field).toBe('rfi_submitted_date');
      expect(result.errors[0].message).toContain(
        'RFI submitted date must be after received date'
      );
    });

    it('should skip validation when dates are null', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: null,
        rfi_due_date: null,
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-RFI-04: Warning if RFI submitted after due date (late submission)', () => {
    it('should warn when submitted is after due date', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: null,
        rfi_due_date: '2026-02-14',
        rfi_submitted_date: '2026-02-20',
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].ruleId).toBe('V-RFI-04');
      expect(result.warnings[0].severity).toBe('warning');
      expect(result.warnings[0].field).toBe('rfi_submitted_date');
      expect(result.warnings[0].message).toContain(
        'RFI was submitted after the due date'
      );
    });

    it('should not warn when submitted is before due date', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: null,
        rfi_due_date: '2026-02-14',
        rfi_submitted_date: '2026-02-10',
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should skip validation when dates are null', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: null,
        rfi_due_date: null,
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('V-RFI-05: Warning if RFI due date is approaching (within 7 days) and not submitted', () => {
    it('should warn when due date is within 7 days and not submitted', () => {
      // Set a due date 5 days in the future
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 5);
      const dueDateStr = futureDate.toISOString().split('T')[0];

      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: null,
        rfi_due_date: dueDateStr,
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].ruleId).toBe('V-RFI-05');
      expect(result.warnings[0].severity).toBe('warning');
      expect(result.warnings[0].field).toBe('rfi_due_date');
      expect(result.warnings[0].message).toContain(
        'RFI due date is approaching'
      );
    });

    it('should not warn when due date is more than 7 days away', () => {
      // Set a due date 10 days in the future
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 10);
      const dueDateStr = futureDate.toISOString().split('T')[0];

      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: null,
        rfi_due_date: dueDateStr,
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should not warn when RFI is already submitted', () => {
      // Set a due date 5 days in the future
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 5);
      const dueDateStr = futureDate.toISOString().split('T')[0];

      // Set submitted date to yesterday (before due date)
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const submittedDateStr = yesterday.toISOString().split('T')[0];

      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: null,
        rfi_due_date: dueDateStr,
        rfi_submitted_date: submittedDateStr,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should skip validation when due date is null', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: null,
        rfi_received_date: null,
        rfi_due_date: null,
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('V-RFI-06: One Active RFI at a Time', () => {
    // NOTE: The "one active RFI at a time" rule from perm_flow.md is ARCHITECTURALLY ENFORCED
    // by the data model. The RFIValidationInput interface only supports a single RFI
    // (rfi_received_date, rfi_due_date, rfi_submitted_date as singular fields).
    //
    // This design decision ensures that:
    // 1. Only one RFI can exist per case at any given time
    // 2. The UI must clear/replace RFI fields to add a new one
    // 3. Historical RFIs would need a separate audit/history table
    //
    // These tests verify that single RFI scenarios are always valid from a "one at a time" perspective.

    it('should pass with a single active RFI (architecturally enforced)', () => {
      // Single active RFI is always valid - the data model prevents multiple RFIs
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: '2026-01-15',
        rfi_received_date: '2026-02-01',
        rfi_due_date: '2026-03-03',
        rfi_submitted_date: null, // Active (not submitted)
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      // No V-RFI-06 error because data model only allows one RFI
    });

    it('should pass with a completed RFI (submitted date set)', () => {
      // Completed RFI is valid - ready for potential replacement
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: '2026-01-15',
        rfi_received_date: '2026-02-01',
        rfi_due_date: '2026-03-03',
        rfi_submitted_date: '2026-02-28', // Submitted (completed)
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with no RFI data (none received yet)', () => {
      // No RFI data is valid - case hasn't received an RFI
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: '2026-01-15',
        rfi_received_date: null,
        rfi_due_date: null,
        rfi_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Multiple validation issues', () => {
    it('should aggregate multiple errors and warnings', () => {
      const result: ValidationResult = validateRFI({
        eta9089_filing_date: '2026-03-20',
        rfi_received_date: '2026-01-15', // V-RFI-01: Before ETA filing
        rfi_due_date: '2026-02-20', // V-RFI-02: Not exactly 30 days (should be 2026-02-14)
        rfi_submitted_date: '2026-02-25', // V-RFI-04: After due date
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2); // V-RFI-01 and V-RFI-02
      expect(result.warnings).toHaveLength(1); // V-RFI-04

      const errorRuleIds = result.errors.map((e) => e.ruleId);
      expect(errorRuleIds).toContain('V-RFI-01');
      expect(errorRuleIds).toContain('V-RFI-02');

      const warningRuleIds = result.warnings.map((w) => w.ruleId);
      expect(warningRuleIds).toContain('V-RFI-04');
    });
  });
});
