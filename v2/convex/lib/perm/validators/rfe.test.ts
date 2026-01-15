import { describe, it, expect } from 'vitest';
import { validateRFE } from './rfe';
import type { ValidationResult } from '../types';

describe('RFE Validator', () => {
  describe('V-RFE-01: RFE received date must be after I-140 filing date', () => {
    it('should pass when RFE received is after I-140 filing', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: '2026-01-15',
        rfe_received_date: '2026-03-20',
        rfe_due_date: null,
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when RFE received is before I-140 filing', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: '2026-03-20',
        rfe_received_date: '2026-01-15',
        rfe_due_date: null,
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-RFE-01');
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].field).toBe('rfe_received_date');
      expect(result.errors[0].message).toContain(
        'RFE received date must be after I-140 filing date'
      );
    });

    it('should skip validation when dates are null', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: null,
        rfe_due_date: null,
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-RFE-02: RFE due date must be after received date (editable)', () => {
    it('should pass when due date is after received date', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: '2026-01-15',
        rfe_due_date: '2026-02-20', // Any date after received is valid
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when due date is before received date', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: '2026-02-20',
        rfe_due_date: '2026-01-15',
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-RFE-02');
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].field).toBe('rfe_due_date');
      expect(result.errors[0].message).toContain(
        'RFE due date must be after received date'
      );
    });

    it('should skip validation when dates are null', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: null,
        rfe_due_date: '2026-02-14',
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-RFE-03: RFE submitted date must be after received date', () => {
    it('should pass when submitted is after received', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: '2026-01-15',
        rfe_due_date: null,
        rfe_submitted_date: '2026-02-10',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when submitted is before received', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: '2026-02-10',
        rfe_due_date: null,
        rfe_submitted_date: '2026-01-15',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('V-RFE-03');
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].field).toBe('rfe_submitted_date');
      expect(result.errors[0].message).toContain(
        'RFE submitted date must be after received date'
      );
    });

    it('should skip validation when dates are null', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: null,
        rfe_due_date: null,
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('V-RFE-04: Warning if RFE submitted after due date (late submission)', () => {
    it('should warn when submitted is after due date', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: null,
        rfe_due_date: '2026-02-14',
        rfe_submitted_date: '2026-02-20',
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].ruleId).toBe('V-RFE-04');
      expect(result.warnings[0].severity).toBe('warning');
      expect(result.warnings[0].field).toBe('rfe_submitted_date');
      expect(result.warnings[0].message).toContain(
        'RFE was submitted after the due date'
      );
    });

    it('should not warn when submitted is before due date', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: null,
        rfe_due_date: '2026-02-14',
        rfe_submitted_date: '2026-02-10',
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should skip validation when dates are null', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: null,
        rfe_due_date: null,
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('V-RFE-05: Warning if RFE due date is approaching (within 7 days) and not submitted', () => {
    it('should warn when due date is within 7 days and not submitted', () => {
      // Set a due date 5 days in the future
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 5);
      const dueDateStr = futureDate.toISOString().split('T')[0];

      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: null,
        rfe_due_date: dueDateStr,
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].ruleId).toBe('V-RFE-05');
      expect(result.warnings[0].severity).toBe('warning');
      expect(result.warnings[0].field).toBe('rfe_due_date');
      expect(result.warnings[0].message).toContain(
        'RFE due date is approaching'
      );
    });

    it('should not warn when due date is more than 7 days away', () => {
      // Set a due date 10 days in the future
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 10);
      const dueDateStr = futureDate.toISOString().split('T')[0];

      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: null,
        rfe_due_date: dueDateStr,
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should not warn when RFE is already submitted', () => {
      // Set a due date 5 days in the future
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 5);
      const dueDateStr = futureDate.toISOString().split('T')[0];

      // Set submitted date to yesterday (before due date)
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const submittedDateStr = yesterday.toISOString().split('T')[0];

      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: null,
        rfe_due_date: dueDateStr,
        rfe_submitted_date: submittedDateStr,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should skip validation when due date is null', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: null,
        rfe_due_date: null,
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('V-RFE-06: One Active RFE at a Time', () => {
    // NOTE: The "one active RFE at a time" rule from perm_flow.md is ARCHITECTURALLY ENFORCED
    // by the data model. The RFEValidationInput interface only supports a single RFE
    // (rfe_received_date, rfe_due_date, rfe_submitted_date as singular fields).
    //
    // This design decision ensures that:
    // 1. Only one RFE can exist per case at any given time
    // 2. The UI must clear/replace RFE fields to add a new one
    // 3. Historical RFEs would need a separate audit/history table
    //
    // These tests verify that single RFE scenarios are always valid from a "one at a time" perspective.

    it('should pass with a single active RFE (architecturally enforced)', () => {
      // Single active RFE is always valid - the data model prevents multiple RFEs
      const result: ValidationResult = validateRFE({
        i140_filing_date: '2026-01-15',
        rfe_received_date: '2026-02-01',
        rfe_due_date: '2026-03-15',
        rfe_submitted_date: null, // Active (not submitted)
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      // No V-RFE-06 error because data model only allows one RFE
    });

    it('should pass with a completed RFE (submitted date set)', () => {
      // Completed RFE is valid - ready for potential replacement
      const result: ValidationResult = validateRFE({
        i140_filing_date: '2026-01-15',
        rfe_received_date: '2026-02-01',
        rfe_due_date: '2026-03-15',
        rfe_submitted_date: '2026-03-10', // Submitted (completed)
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with no RFE data (none received yet)', () => {
      // No RFE data is valid - case hasn't received an RFE
      const result: ValidationResult = validateRFE({
        i140_filing_date: '2026-01-15',
        rfe_received_date: null,
        rfe_due_date: null,
        rfe_submitted_date: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Multiple validation issues', () => {
    it('should aggregate multiple errors and warnings', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: '2026-03-20',
        rfe_received_date: '2026-01-15', // V-RFE-01: Before I-140 filing
        rfe_due_date: '2026-01-10', // V-RFE-02: Before received date
        rfe_submitted_date: '2026-01-05', // V-RFE-03: Before received date
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3); // V-RFE-01, V-RFE-02, V-RFE-03

      const errorRuleIds = result.errors.map((e) => e.ruleId);
      expect(errorRuleIds).toContain('V-RFE-01');
      expect(errorRuleIds).toContain('V-RFE-02');
      expect(errorRuleIds).toContain('V-RFE-03');
    });

    it('should warn for late submission', () => {
      const result: ValidationResult = validateRFE({
        i140_filing_date: null,
        rfe_received_date: '2026-01-15',
        rfe_due_date: '2026-02-14',
        rfe_submitted_date: '2026-02-20', // V-RFE-04: After due date
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].ruleId).toBe('V-RFE-04');
    });
  });
});
