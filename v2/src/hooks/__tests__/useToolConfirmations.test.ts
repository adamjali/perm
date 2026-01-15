// @vitest-environment jsdom
/**
 * useToolConfirmations Hook Tests
 *
 * Tests for the tool confirmation state management hook.
 *
 * Key behaviors:
 * - registerConfirmation parses permission requests correctly
 * - approve transitions through correct status sequence
 * - approve prevents double-execution via executingRef
 * - deny updates status and calls onPersistResult
 * - clearAll resets all state
 * - hasPendingConfirmation returns correct boolean
 * - getConfirmation returns undefined for unknown IDs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToolConfirmations } from '../useToolConfirmations';
import type { PermissionRequestResult } from '../../lib/ai/tool-confirmation-types';

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
    toolCallId: 'tool-call-123',
    arguments: { caseId: 'case-1', status: 'in_progress' },
    description: 'Update case status to in_progress',
    ...overrides,
  };
}

function createPermissionRequestString(
  overrides: Partial<PermissionRequestResult> = {}
): string {
  return JSON.stringify(createPermissionRequest(overrides));
}

// ============================================================================
// Tests
// ============================================================================

describe('useToolConfirmations', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock fetch for approve/execute calls
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // registerConfirmation
  // --------------------------------------------------------------------------

  describe('registerConfirmation', () => {
    it('parses permission request correctly and returns true', () => {
      const { result } = renderHook(() => useToolConfirmations());

      const resultString = createPermissionRequestString();

      let registered: boolean;
      act(() => {
        registered = result.current.registerConfirmation('tool-call-123', resultString);
      });

      expect(registered!).toBe(true);
      expect(result.current.confirmations.size).toBe(1);

      const confirmation = result.current.getConfirmation('tool-call-123');
      expect(confirmation).toMatchObject({
        toolCallId: 'tool-call-123',
        toolName: 'updateCase',
        arguments: { caseId: 'case-1', status: 'in_progress' },
        description: 'Update case status to in_progress',
        permissionType: 'confirm',
        status: 'pending',
      });
    });

    it('returns false for non-permission results', () => {
      const { result } = renderHook(() => useToolConfirmations());

      const nonPermissionResult = JSON.stringify({ success: true, data: 'some data' });

      let registered: boolean;
      act(() => {
        registered = result.current.registerConfirmation('tool-call-456', nonPermissionResult);
      });

      expect(registered!).toBe(false);
      expect(result.current.confirmations.size).toBe(0);
    });

    it('returns false for invalid JSON', () => {
      const { result } = renderHook(() => useToolConfirmations());

      let registered: boolean;
      act(() => {
        registered = result.current.registerConfirmation('tool-call-789', 'not valid json');
      });

      expect(registered!).toBe(false);
      expect(result.current.confirmations.size).toBe(0);
    });

    it('returns true but does not re-register existing confirmation', () => {
      const { result } = renderHook(() => useToolConfirmations());

      const resultString = createPermissionRequestString();

      act(() => {
        result.current.registerConfirmation('tool-call-123', resultString);
      });

      expect(result.current.confirmations.size).toBe(1);

      // Try to re-register with different data
      const differentResult = createPermissionRequestString({
        description: 'Different description',
      });

      let registered: boolean;
      act(() => {
        registered = result.current.registerConfirmation('tool-call-123', differentResult);
      });

      expect(registered!).toBe(true);
      expect(result.current.confirmations.size).toBe(1);
      // Original description should be preserved
      expect(result.current.getConfirmation('tool-call-123')?.description).toBe(
        'Update case status to in_progress'
      );
    });

    it('handles destructive permission type', () => {
      const { result } = renderHook(() => useToolConfirmations());

      const resultString = createPermissionRequestString({
        permissionType: 'destructive',
        toolName: 'deleteCase',
        description: 'Delete case permanently',
      });

      act(() => {
        result.current.registerConfirmation('tool-call-delete', resultString);
      });

      const confirmation = result.current.getConfirmation('tool-call-delete');
      expect(confirmation?.permissionType).toBe('destructive');
    });
  });

  // --------------------------------------------------------------------------
  // approve
  // --------------------------------------------------------------------------

  describe('approve', () => {
    it('transitions through correct status sequence: pending -> approved -> executing -> done', async () => {
      // Use a slow fetch to ensure we can observe the executing state
      let resolveFetch: (value: unknown) => void;
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      );

      const onExecutionComplete = vi.fn();
      const { result } = renderHook(() =>
        useToolConfirmations({ onExecutionComplete })
      );

      // Register a confirmation
      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      expect(result.current.getConfirmation('tool-call-123')?.status).toBe('pending');

      // Start approval
      let approvePromise: Promise<void>;
      act(() => {
        approvePromise = result.current.approve('tool-call-123');
      });

      // Should transition to 'approved' immediately
      expect(result.current.getConfirmation('tool-call-123')?.status).toBe('approved');

      // Advance timers to trigger executing transition
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.getConfirmation('tool-call-123')?.status).toBe('executing');

      // Now resolve the fetch
      await act(async () => {
        resolveFetch!({
          ok: true,
          json: () => Promise.resolve({ success: true, result: 'executed' }),
        });
        await approvePromise!;
      });

      expect(result.current.getConfirmation('tool-call-123')?.status).toBe('done');
      expect(onExecutionComplete).toHaveBeenCalledWith('tool-call-123', {
        success: true,
        result: 'executed',
      });
    });

    it('transitions to error status on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Execution failed' }),
      });

      const onExecutionError = vi.fn();
      const { result } = renderHook(() =>
        useToolConfirmations({ onExecutionError })
      );

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await result.current.approve('tool-call-123');
      });

      expect(result.current.getConfirmation('tool-call-123')?.status).toBe('error');
      expect(result.current.getConfirmation('tool-call-123')?.error).toBe('Execution failed');
      expect(onExecutionError).toHaveBeenCalledWith('tool-call-123', 'Execution failed');
    });

    it('transitions to error status on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const onExecutionError = vi.fn();
      const { result } = renderHook(() =>
        useToolConfirmations({ onExecutionError })
      );

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await result.current.approve('tool-call-123');
      });

      expect(result.current.getConfirmation('tool-call-123')?.status).toBe('error');
      expect(result.current.getConfirmation('tool-call-123')?.error).toBe('Network error');
      expect(onExecutionError).toHaveBeenCalledWith('tool-call-123', 'Network error');
    });

    it('prevents double-execution via executingRef', async () => {
      // Slow fetch that takes time to complete
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ success: true }),
                }),
              500
            )
          )
      );

      const { result } = renderHook(() => useToolConfirmations());

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      // Call approve twice quickly
      act(() => {
        result.current.approve('tool-call-123');
        result.current.approve('tool-call-123'); // Should be blocked
      });

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Fetch should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does nothing for non-pending confirmations', async () => {
      const { result } = renderHook(() => useToolConfirmations());

      // Try to approve non-existent confirmation
      await act(async () => {
        await result.current.approve('non-existent');
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls onPersistResult on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const onPersistResult = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useToolConfirmations({ onPersistResult })
      );

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await result.current.approve('tool-call-123');
      });

      expect(onPersistResult).toHaveBeenCalledWith(
        'tool-call-123',
        expect.stringContaining('"success":true'),
        'success'
      );
    });

    it('calls onPersistResult with error status on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed' }),
      });

      const onPersistResult = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useToolConfirmations({ onPersistResult })
      );

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await result.current.approve('tool-call-123');
      });

      expect(onPersistResult).toHaveBeenCalledWith(
        'tool-call-123',
        expect.stringContaining('"error":"Failed"'),
        'error'
      );
    });

    it('sends correct payload to execute endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useToolConfirmations());

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await result.current.approve('tool-call-123');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/execute-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolCallId: 'tool-call-123',
          toolName: 'updateCase',
          arguments: { caseId: 'case-1', status: 'in_progress' },
        }),
      });
    });
  });

  // --------------------------------------------------------------------------
  // deny
  // --------------------------------------------------------------------------

  describe('deny', () => {
    it('updates status to denied and calls onPersistResult', async () => {
      const onPersistResult = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useToolConfirmations({ onPersistResult })
      );

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      await act(async () => {
        await result.current.deny('tool-call-123');
      });

      expect(result.current.getConfirmation('tool-call-123')?.status).toBe('denied');
      expect(onPersistResult).toHaveBeenCalledWith(
        'tool-call-123',
        expect.stringContaining('"denied":true'),
        'error'
      );
    });

    it('does nothing for non-pending confirmations', async () => {
      const onPersistResult = vi.fn();
      const { result } = renderHook(() =>
        useToolConfirmations({ onPersistResult })
      );

      await act(async () => {
        await result.current.deny('non-existent');
      });

      expect(onPersistResult).not.toHaveBeenCalled();
    });

    it('does not affect already denied confirmations', async () => {
      const onPersistResult = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useToolConfirmations({ onPersistResult })
      );

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      // Deny once
      await act(async () => {
        await result.current.deny('tool-call-123');
      });

      expect(onPersistResult).toHaveBeenCalledTimes(1);

      // Try to deny again
      await act(async () => {
        await result.current.deny('tool-call-123');
      });

      // Should not call persist again since status is no longer pending
      expect(onPersistResult).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // clearAll
  // --------------------------------------------------------------------------

  describe('clearAll', () => {
    it('resets all state', () => {
      const { result } = renderHook(() => useToolConfirmations());

      // Register multiple confirmations
      act(() => {
        result.current.registerConfirmation(
          'tool-call-1',
          createPermissionRequestString({ toolCallId: 'tool-call-1' })
        );
        result.current.registerConfirmation(
          'tool-call-2',
          createPermissionRequestString({ toolCallId: 'tool-call-2' })
        );
      });

      expect(result.current.confirmations.size).toBe(2);

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.confirmations.size).toBe(0);
      expect(result.current.getConfirmation('tool-call-1')).toBeUndefined();
      expect(result.current.getConfirmation('tool-call-2')).toBeUndefined();
    });

    it('clears executingRef allowing new executions', async () => {
      // Start an execution but don't let it complete
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ success: true }),
                }),
              1000
            )
          )
      );

      const { result } = renderHook(() => useToolConfirmations());

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      // Start approval (won't complete due to slow fetch)
      act(() => {
        result.current.approve('tool-call-123');
      });

      // Clear all
      act(() => {
        result.current.clearAll();
      });

      // Re-register the same confirmation
      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      // Should be able to approve again
      act(() => {
        result.current.approve('tool-call-123');
      });

      // Fetch should be called twice (once before clear, once after)
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // hasPendingConfirmation
  // --------------------------------------------------------------------------

  describe('hasPendingConfirmation', () => {
    it('returns true for pending confirmation', () => {
      const { result } = renderHook(() => useToolConfirmations());

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      expect(result.current.hasPendingConfirmation('tool-call-123')).toBe(true);
    });

    it('returns false for non-pending status', async () => {
      const onPersistResult = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useToolConfirmations({ onPersistResult })
      );

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      await act(async () => {
        await result.current.deny('tool-call-123');
      });

      expect(result.current.hasPendingConfirmation('tool-call-123')).toBe(false);
    });

    it('returns false for unknown ID', () => {
      const { result } = renderHook(() => useToolConfirmations());

      expect(result.current.hasPendingConfirmation('unknown-id')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // getConfirmation
  // --------------------------------------------------------------------------

  describe('getConfirmation', () => {
    it('returns undefined for unknown IDs', () => {
      const { result } = renderHook(() => useToolConfirmations());

      expect(result.current.getConfirmation('unknown-id')).toBeUndefined();
    });

    it('returns confirmation state for known IDs', () => {
      const { result } = renderHook(() => useToolConfirmations());

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      const confirmation = result.current.getConfirmation('tool-call-123');
      expect(confirmation).toBeDefined();
      expect(confirmation?.toolCallId).toBe('tool-call-123');
    });
  });

  // --------------------------------------------------------------------------
  // registerConfirmationFromData
  // --------------------------------------------------------------------------

  describe('registerConfirmationFromData', () => {
    it('registers confirmation from parsed data', () => {
      const { result } = renderHook(() => useToolConfirmations());

      const data = createPermissionRequest({ toolCallId: 'streaming-tool-123' });

      act(() => {
        result.current.registerConfirmationFromData(data);
      });

      const confirmation = result.current.getConfirmation('streaming-tool-123');
      expect(confirmation).toMatchObject({
        toolCallId: 'streaming-tool-123',
        toolName: 'updateCase',
        status: 'pending',
      });
    });

    it('does not re-register existing confirmation', () => {
      const { result } = renderHook(() => useToolConfirmations());

      const data = createPermissionRequest({ toolCallId: 'streaming-tool-123' });

      act(() => {
        result.current.registerConfirmationFromData(data);
      });

      const differentData = createPermissionRequest({
        toolCallId: 'streaming-tool-123',
        description: 'Different description',
      });

      act(() => {
        result.current.registerConfirmationFromData(differentData);
      });

      // Should still have original description
      expect(result.current.getConfirmation('streaming-tool-123')?.description).toBe(
        'Update case status to in_progress'
      );
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles error in onPersistResult gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const onPersistResult = vi.fn().mockRejectedValue(new Error('Persist failed'));
      const onExecutionComplete = vi.fn();
      const { result } = renderHook(() =>
        useToolConfirmations({ onPersistResult, onExecutionComplete })
      );

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
        await result.current.approve('tool-call-123');
      });

      // Should still complete despite persist error
      expect(result.current.getConfirmation('tool-call-123')?.status).toBe('done');
      expect(onExecutionComplete).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('handles missing toolCallId in permission request', () => {
      const { result } = renderHook(() => useToolConfirmations());

      // Create permission request without toolCallId (uses the provided ID)
      const permissionRequest = {
        requiresPermission: true,
        permissionType: 'confirm',
        toolName: 'updateCase',
        arguments: {},
        description: 'Test',
      };

      act(() => {
        result.current.registerConfirmation('fallback-id', JSON.stringify(permissionRequest));
      });

      const confirmation = result.current.getConfirmation('fallback-id');
      expect(confirmation?.toolCallId).toBe('fallback-id');
    });

    it('sets startTime and endTime correctly', async () => {
      // Use controlled fetch to properly observe timing
      let resolveFetch: (value: unknown) => void;
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      );

      const { result } = renderHook(() => useToolConfirmations());

      act(() => {
        result.current.registerConfirmation('tool-call-123', createPermissionRequestString());
      });

      // Start approval
      let approvePromise: Promise<void>;
      act(() => {
        approvePromise = result.current.approve('tool-call-123');
      });

      // Advance to trigger executing state (where startTime is set)
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Check startTime is set
      const confirmationBefore = result.current.getConfirmation('tool-call-123');
      expect(confirmationBefore?.startTime).toBeDefined();

      // Resolve fetch to trigger endTime
      await act(async () => {
        resolveFetch!({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
        await approvePromise!;
      });

      const confirmation = result.current.getConfirmation('tool-call-123');
      expect(confirmation?.status).toBe('done');
      // After done, timing info should be available (discriminated union ensures this)
      if (confirmation?.status === 'done') {
        expect(confirmation.endTime).toBeDefined();
        // startTime is optional on done state but should be set
        expect(confirmation.startTime).toBeDefined();
        expect(confirmation.endTime).toBeGreaterThanOrEqual(confirmation.startTime!);
      }
    });
  });
});
