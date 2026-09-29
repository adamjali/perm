import { describe, it, expect, vi } from 'vitest';
import { buildToolError } from '../tool-helpers';

describe('buildToolError', () => {
  it('turns a per-user rate limit into "too many ... try again in N", not the raw error JSON', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const limited = Object.assign(new Error('{"kind":"RateLimited","name":"caseUpdate","retryAfter":12000}'), {
      data: { kind: 'RateLimited', name: 'caseUpdate', retryAfter: 12000 },
    });
    const r = buildToolError('updateCase', limited) as { error: string; suggestion?: string; reason?: string };
    expect(r.error).toBe('Too many case changes in the last minute. Try again in 12 seconds.');
    expect(r.reason).toBe('rate_limited');
    expect(JSON.stringify(r)).not.toContain('"kind"');
  });

  it('keeps the plain failure shape for anything else', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(buildToolError('updateCase', new Error('Case not found'))).toEqual({
      error: 'Failed to update case',
      suggestion: 'Case not found',
    });
  });
});
