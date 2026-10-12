/**
 * The approval route runs the change the server recorded for the card, once,
 * and never a tool name or arguments from the browser (Oct 12 2026).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';

const fetchMutation = vi.fn();
const runAction = vi.fn();
vi.mock('convex/nextjs', () => ({ fetchMutation: (...a: unknown[]) => fetchMutation(...a) }));
vi.mock('@convex-dev/auth/nextjs/server', () => ({
  isAuthenticatedNextjs: async () => true,
  convexAuthNextjsToken: async () => 'token',
}));
vi.mock('@/lib/ai/caseActions', () => ({ runAction: (...a: unknown[]) => runAction(...a) }));
vi.mock('@/lib/sentry', () => ({ captureError: vi.fn() }));

import { POST } from '../route';

const post = (body: unknown) =>
  POST(new Request('http://x/api/chat/execute-tool', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  fetchMutation.mockReset();
  runAction.mockReset();
});

describe('POST /api/chat/execute-tool', () => {
  it('runs the stored change, ignoring what the browser sent', async () => {
    fetchMutation.mockImplementation(async (fn: unknown) => {
      if (getFunctionName(fn as never) === 'chatConfirmations:claim') {
        return { ok: true, toolName: 'updateCase', args: JSON.stringify({ id: 'stored', pwdFilingDate: '2026-01-05' }) };
      }
      return null;
    });
    runAction.mockResolvedValue({ ok: true, result: { success: true, message: 'Saved.' }, summary: 'Saved.' });

    const res = await post({ toolCallId: 'tc-1', toolName: 'deleteCase', arguments: { id: 'evil' } });
    expect(res.status).toBe(200);
    expect(runAction).toHaveBeenCalledWith('updateCase', { id: 'stored', pwdFilingDate: '2026-01-05' }, 'token');
    const finish = fetchMutation.mock.calls.find((c) => getFunctionName(c[0]) === 'chatConfirmations:finish');
    expect(finish?.[1]).toEqual({ toolCallId: 'tc-1', ok: true, result: 'Saved.' });
  });

  it('refuses with 409 and runs nothing when the card is already done', async () => {
    fetchMutation.mockResolvedValue({ ok: false, reason: 'already_done', message: 'This change was already made.', result: 'Saved.' });
    const res = await post({ toolCallId: 'tc-1' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ refused: 'already_done', previousResult: 'Saved.' });
    expect(runAction).not.toHaveBeenCalled();
  });

  it('rejects a malformed card id', async () => {
    const res = await post({ toolCallId: '../../x y' });
    expect(res.status).toBe(400);
    expect(fetchMutation).not.toHaveBeenCalled();
  });

  it('records a failed run so the card can be tried again', async () => {
    fetchMutation.mockImplementation(async (fn: unknown) =>
      getFunctionName(fn as never) === 'chatConfirmations:claim' ? { ok: true, toolName: 'updateCase', args: '{}' } : null,
    );
    runAction.mockRejectedValue(new Error('Validation failed: bad date'));
    const res = await post({ toolCallId: 'tc-2' });
    expect(res.status).toBe(500);
    const finish = fetchMutation.mock.calls.find((c) => getFunctionName(c[0]) === 'chatConfirmations:finish');
    expect(finish?.[1]).toMatchObject({ toolCallId: 'tc-2', ok: false });
  });
});
