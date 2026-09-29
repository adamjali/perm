import { describe, it, expect } from 'vitest';
import {
  annotateCaseQuery,
  chatIpLimitBody,
  CHAT_MAX_OUTPUT_TOKENS,
  CHAT_MAX_STEPS,
  chatErrorText,
  cutShortFrom,
  cutShortNotice,
  formatWait,
  queryCapNote,
  rateLimitFrom,
  rateLimitedToolResult,
  webSearchUnavailableResult,
} from '../limits';

/**
 * Every chat limit has to say which limit it hit and what to do, instead of
 * reading as "nothing found", "try rephrasing" or "the AI didn't respond".
 * These pin the words and the decisions; the wiring is tested where it lives.
 */

describe('cutShortFrom', () => {
  it('reads the output cap as "length" and the step cap as "steps"', () => {
    expect(cutShortFrom('length')).toBe('length');
    // stopWhen ends the loop while the model still wants a tool: the last
    // step finished for tool calls.
    expect(cutShortFrom('tool-calls')).toBe('steps');
  });

  it('says nothing for an ordinary finish, an error or no reason', () => {
    for (const r of ['stop', 'error', 'other', 'content-filter', undefined]) {
      expect(cutShortFrom(r)).toBeUndefined();
    }
  });
});

describe('cutShortNotice', () => {
  it('names the limit and the way on', () => {
    expect(cutShortNotice('length')).toMatch(/length limit/);
    expect(cutShortNotice('length')).toMatch(/Continue/);
    expect(cutShortNotice('steps')).toContain(`${CHAT_MAX_STEPS} tool steps`);
    expect(cutShortNotice('steps')).toMatch(/Continue/);
  });
});

describe('caps', () => {
  it('keeps the output cap under the smallest model limit in the chain (Gemini 2.0 Flash, 8,192)', () => {
    expect(CHAT_MAX_OUTPUT_TOKENS).toBeGreaterThan(4000);
    expect(CHAT_MAX_OUTPUT_TOKENS).toBeLessThanOrEqual(8192);
  });
});

describe('formatWait', () => {
  it.each([
    [0, 'a moment'],
    [-5, 'a moment'],
    [400, '1 second'],
    [1000, '1 second'],
    [12_300, '13 seconds'],
    [60_000, '1 minute'],
    [61_000, '2 minutes'],
    [59 * 60_000, '59 minutes'],
    [60 * 60_000, '1 hour'],
    [90 * 60_000, '2 hours'],
  ])('%i ms reads as %s', (ms, text) => {
    expect(formatWait(ms)).toBe(text);
  });
});

describe('rateLimitFrom', () => {
  it('reads the rate limiter component error off a rethrown ConvexError', () => {
    const err = Object.assign(new Error('{"kind":"RateLimited"}'), {
      data: { kind: 'RateLimited', name: 'caseUpdate', retryAfter: 4200 },
    });
    expect(rateLimitFrom(err)).toEqual({ name: 'caseUpdate', retryAfterMs: 4200 });
  });

  it('reads it from the message when only the text survived', () => {
    const err = new Error(
      'Uncaught ConvexError: {"kind":"RateLimited","name":"knowledgeSearch","retryAfter":2500}',
    );
    expect(rateLimitFrom(err)).toEqual({ name: 'knowledgeSearch', retryAfterMs: 2500 });
  });

  it('is null for any other error', () => {
    expect(rateLimitFrom(new Error('Case not found'))).toBeNull();
    expect(rateLimitFrom({ data: { kind: 'Other' } })).toBeNull();
    expect(rateLimitFrom(undefined)).toBeNull();
  });
});

describe('rateLimitedToolResult', () => {
  const err = { data: { kind: 'RateLimited', name: 'caseUpdate', retryAfter: 9000 } };

  it('says what was limited and when to try again, and carries an error key so it is never cached', () => {
    const r = rateLimitedToolResult(err, 'case changes');
    expect(r).not.toBeNull();
    expect(r!.error).toBe('Too many case changes in the last minute. Try again in 9 seconds.');
    expect(r!.reason).toBe('rate_limited');
    expect(r!.retryAfterSeconds).toBe(9);
    expect(r!._ai_instruction).toContain('9 seconds');
    expect(r!._ai_instruction).not.toMatch(/rephras/i);
  });

  it("names the action from the limiter's own name when the caller does not", () => {
    const r = rateLimitedToolResult({ data: { kind: 'RateLimited', name: 'knowledgeSearch', retryAfter: 2000 } });
    expect(r!.error).toBe('Too many knowledge-base searches in the last minute. Try again in 2 seconds.');
  });

  it('is null when the error is not a rate limit', () => {
    expect(rateLimitedToolResult(new Error('boom'), 'case changes')).toBeNull();
  });
});

describe('webSearchUnavailableResult', () => {
  // 3:00 PM EDT on Sep 29 2026: the quota resets at the next UTC midnight,
  // 8:00 PM EDT the same evening.
  const now = new Date('2026-09-29T19:00:00Z');

  it('leaves a real result alone', () => {
    expect(webSearchUnavailableResult({ source: 'tavily', results: [], answer: null }, now)).toBeNull();
  });

  it('says a spent quota is spent, and when it comes back, in Eastern 12-hour time', () => {
    const r = webSearchUnavailableResult(
      { source: 'none', results: [], answer: null, unavailable: 'quota' },
      now,
    );
    expect(r).not.toBeNull();
    expect(r!.error).toMatch(/used up for today/);
    expect(r!.resetsAt).toBe('2026-09-30T00:00:00.000Z');
    expect(r!.resetsAtLocal).toBe('8:00 PM EDT');
    expect(r!._ai_instruction).toContain('8:00 PM EDT');
    // Must never read as an empty search.
    expect(r!._ai_instruction).toMatch(/do not say (the search|it) found nothing/i);
  });

  it('says a failed search failed, not that it found nothing', () => {
    const r = webSearchUnavailableResult(
      { source: 'none', results: [], answer: null, unavailable: 'error' },
      now,
    );
    expect(r!.error).toMatch(/didn.t answer/);
    expect(r!.reason).toBe('failed');
  });

  it('treats an older "none" without a reason as a failure, never as an empty search', () => {
    const r = webSearchUnavailableResult({ source: 'none', results: [], answer: null }, now);
    expect(r).not.toBeNull();
    expect(r!.reason).toBe('failed');
  });
});

describe('queryCapNote', () => {
  it('is empty when every match came back', () => {
    expect(queryCapNote(12, 12)).toBeUndefined();
    expect(queryCapNote(undefined, 100)).toBeUndefined();
  });

  it('says "showing N of M" when the list stops at the cap', () => {
    expect(queryCapNote(340, 100)).toBe('Showing 100 of 340 matching cases.');
  });
});

describe('chatErrorText', () => {
  const generic = chatErrorText(undefined);

  it('shows the per-address limit with its wait, from the route', () => {
    const t = chatErrorText(
      new Error(JSON.stringify({ error: 'rate_limited', message: 'Too many chat messages from this network in the last minute. Try again in 40 seconds.', retryAfter: 40 })),
    );
    expect(t.title).toMatch(/slow down/i);
    expect(t.detail).toContain('40 seconds');
  });

  it("shows nginx's own refusal text for /api", () => {
    const t = chatErrorText(
      new Error('{"error":"rate_limited","message":"Too many requests from this address. Try again in a few seconds.","retryAfter":30}'),
    );
    expect(t.detail).toBe('Too many requests from this address. Try again in a few seconds.');
    const busy = chatErrorText(
      new Error('{"error":"busy","message":"The site is busy for a moment. Try again in about 15 seconds.","retryAfter":15}'),
    );
    expect(busy.detail).toContain('15 seconds');
  });

  it('says a signed-out session is signed out', () => {
    expect(chatErrorText(new Error('{"error":"Unauthorized"}')).title).toMatch(/signed out/i);
  });

  it('keeps a route error sentence as the detail', () => {
    const t = chatErrorText(new Error('{"error":"All AI providers are currently unavailable. Please try again in a moment."}'));
    expect(t.detail).toContain('All AI providers are currently unavailable');
  });

  it('falls back to the plain message for anything it cannot read', () => {
    expect(chatErrorText(new Error('Failed to fetch')).title).toBe(generic.title);
    expect(generic.detail).toMatch(/try again/i);
  });
});

describe('annotateCaseQuery', () => {
  it('tells the model the list stopped at its cap, and to say so', () => {
    const r = annotateCaseQuery({ cases: Array.from({ length: 100 }, (_, i) => ({ i })), count: 340 });
    expect(r.note).toBe('Showing 100 of 340 matching cases.');
    expect(r._ai_instruction).toMatch(/100 of 340/);
    expect(r.cases).toHaveLength(100);
  });

  it('says when the account itself holds more cases than one search covers', () => {
    const r = annotateCaseQuery({ cases: [1, 2], count: 2, accountTruncated: true });
    expect(r.note).toMatch(/oldest were not searched/);
    expect(r._ai_instruction).toMatch(/oldest were not searched/);
  });

  it('leaves a complete list, a count-only answer and an error alone', () => {
    const whole = { cases: [{ a: 1 }], count: 1 };
    expect(annotateCaseQuery(whole)).toEqual(whole);
    expect(annotateCaseQuery({ count: 500 })).toEqual({ count: 500 });
    const err = { error: 'Failed to query cases' };
    expect(annotateCaseQuery(err)).toEqual(err);
  });
});

describe('the system prompt carries the rule', () => {
  it('tells the model to follow a result\'s note and never pass off a capped list or a failed search', async () => {
    const { buildSystemPrompt } = await import('../system-prompt');
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/_ai_instruction/);
    expect(prompt).toMatch(/showing 100 of 340/i);
    expect(prompt).toMatch(/nothing found/i);
  });
});

describe('chatIpLimitBody', () => {
  it("is the same JSON shape nginx answers with, so the panel reads both", () => {
    const b = chatIpLimitBody(38_200, false);
    expect(b.error).toBe('rate_limited');
    expect(b.retryAfter).toBe(39);
    expect(b.message).toBe('Too many chat messages from this network in the last minute. Try again in 39 seconds.');
    expect(chatErrorText(new Error(JSON.stringify(b))).detail).toBe(b.message);
  });

  it('names the longer pause after repeated limits', () => {
    const b = chatIpLimitBody(55 * 60_000, true);
    expect(b.message).toMatch(/paused for this network/);
    expect(b.message).toContain('55 minutes');
  });
});
