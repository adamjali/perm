/**
 * Tests for tool-confirmation-types utilities
 *
 * Tests type guards and parsing utilities for tool confirmation flow.
 */

import { describe, it, expect } from 'vitest';
import {
  isPermissionRequest,
  isToolError,
  isToolFailure,
  parseToolResultString,
  extractPermissionRequest,
  type PermissionRequestResult,
  type ToolSuccessResult,
  type ToolErrorResult,
} from '../tool-confirmation-types';

// ============================================================================
// Test Data Factories
// ============================================================================

function createPermissionRequest(
  overrides: Partial<PermissionRequestResult> = {}
): PermissionRequestResult {
  return {
    requiresPermission: true,
    permissionType: 'confirm',
    toolName: 'updateCase',
    toolCallId: 'call_123',
    arguments: { caseId: 'case_456' },
    description: 'Update case status',
    ...overrides,
  };
}

function createSuccessResult(
  overrides: Partial<ToolSuccessResult> = {}
): ToolSuccessResult {
  return {
    success: true,
    data: { id: 'case_123' },
    ...overrides,
  };
}

function createErrorResult(
  overrides: Partial<ToolErrorResult> = {}
): ToolErrorResult {
  return {
    error: 'Something went wrong',
    ...overrides,
  };
}

// ============================================================================
// isPermissionRequest
// ============================================================================

describe('isPermissionRequest', () => {
  it('returns true for valid permission request', () => {
    const result = createPermissionRequest();
    expect(isPermissionRequest(result)).toBe(true);
  });

  it.each([
    ['success result', createSuccessResult()],
    ['error result', createErrorResult()],
    ['result with requiresPermission: false', { requiresPermission: false, data: {} }],
    ['empty object', {}],
    ['null-ish object structure', { requiresPermission: null }],
  ])('returns false for %s', (_, result) => {
    expect(isPermissionRequest(result as ToolSuccessResult)).toBe(false);
  });
});

// ============================================================================
// isToolError
// ============================================================================

describe('isToolError', () => {
  it('returns true for error result with string error', () => {
    const result = createErrorResult();
    expect(isToolError(result)).toBe(true);
  });

  it('returns true for error result with additional properties', () => {
    const result = { ...createErrorResult(), code: 'NOT_FOUND' };
    expect(isToolError(result)).toBe(true);
  });

  it.each([
    ['success result', createSuccessResult()],
    ['permission request', createPermissionRequest()],
    ['object with non-string error', { error: 123 }],
    ['object with undefined error', { error: undefined }],
    ['empty object', {}],
  ])('returns false for %s', (_, result) => {
    expect(isToolError(result as ToolErrorResult)).toBe(false);
  });
});

// ============================================================================
// isToolFailure
// ============================================================================

describe('isToolFailure', () => {
  it('returns true for error result', () => {
    const result = createErrorResult();
    expect(isToolFailure(result)).toBe(true);
  });

  it('returns true for success: false result', () => {
    const result = { success: false, message: 'Failed' } as ToolSuccessResult;
    expect(isToolFailure(result)).toBe(true);
  });

  it.each([
    ['success: true result', createSuccessResult()],
    ['permission request', createPermissionRequest()],
    ['result without success or error', { data: 'something' }],
  ])('returns false for %s', (_, result) => {
    expect(isToolFailure(result as ToolSuccessResult)).toBe(false);
  });
});

// ============================================================================
// parseToolResultString
// ============================================================================

describe('parseToolResultString', () => {
  it('parses valid JSON string into object', () => {
    const input = JSON.stringify({ success: true, id: '123' });
    const result = parseToolResultString(input);
    expect(result).toEqual({ success: true, id: '123' });
  });

  it('parses permission request JSON', () => {
    const permissionRequest = createPermissionRequest();
    const input = JSON.stringify(permissionRequest);
    const result = parseToolResultString(input);
    expect(result).toEqual(permissionRequest);
  });

  it.each([
    ['undefined', undefined],
    ['empty string', ''],
    ['invalid JSON', 'not json'],
    ['partial JSON', '{ "incomplete":'],
    ['plain text', 'hello world'],
  ])('returns null for %s', (_, input) => {
    expect(parseToolResultString(input)).toBeNull();
  });
});

// ============================================================================
// extractPermissionRequest
// ============================================================================

describe('extractPermissionRequest', () => {
  it('extracts permission request from valid JSON string', () => {
    const permissionRequest = createPermissionRequest();
    const input = JSON.stringify(permissionRequest);

    const result = extractPermissionRequest(input);

    expect(result).toEqual(permissionRequest);
  });

  it('extracts permission request with all fields', () => {
    const permissionRequest = createPermissionRequest({
      permissionType: 'destructive',
      toolName: 'deleteCase',
      arguments: { caseId: 'case_789', permanent: true },
      description: 'Permanently delete case',
    });
    const input = JSON.stringify(permissionRequest);

    const result = extractPermissionRequest(input);

    expect(result?.permissionType).toBe('destructive');
    expect(result?.toolName).toBe('deleteCase');
    expect(result?.arguments).toEqual({ caseId: 'case_789', permanent: true });
  });

  it.each([
    ['success result JSON', JSON.stringify(createSuccessResult())],
    ['error result JSON', JSON.stringify(createErrorResult())],
    ['undefined', undefined],
    ['empty string', ''],
    ['invalid JSON', 'not json'],
    ['requiresPermission: false', JSON.stringify({ requiresPermission: false })],
  ])('returns null for %s', (_, input) => {
    expect(extractPermissionRequest(input)).toBeNull();
  });
});
