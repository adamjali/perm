import { describe, it, expect } from 'vitest';
import { summarizeToolResult } from '../tool-result-summary';

/**
 * The card under a tool call is the one place a person sees a tool's result,
 * so a limit has to show there as a limit: "No results found" over a spent
 * web-search quota, "340 cases found" over a list that stopped at 100, and
 * "Update failed" over a rate limit each hid what had happened.
 */
describe('summarizeToolResult and limits', () => {
  it('shows a spent web-search quota as that, not "No results found"', () => {
    const r = JSON.stringify({ error: 'Web search is used up for today.', reason: 'quota', resetsAtLocal: '8:00 PM EDT' });
    expect(summarizeToolResult('searchWeb', r)).toBe('Web search is used up for today. Back at 8:00 PM EDT.');
  });

  it('shows a web search that failed as failed', () => {
    const r = JSON.stringify({ error: "Web search didn't answer just now.", reason: 'failed' });
    expect(summarizeToolResult('searchWeb', r)).toBe("Web search didn't answer just now.");
  });

  it('shows a rate limit with its wait, for any tool', () => {
    const r = JSON.stringify({ error: 'Too many case changes in the last minute. Try again in 12 seconds.', reason: 'rate_limited', retryAfterSeconds: 12 });
    expect(summarizeToolResult('updateCase', r)).toBe('Too many case changes in the last minute. Try again in 12 seconds.');
    expect(summarizeToolResult('searchKnowledge', r)).toContain('Try again in 12 seconds');
  });

  it('shows "showing N of M" for a capped case list', () => {
    const r = JSON.stringify({ cases: [], count: 340, note: 'Showing 100 of 340 matching cases.' });
    expect(summarizeToolResult('queryCases', r)).toBe('Showing 100 of 340 matching cases.');
  });

  it('leaves ordinary results as they were', () => {
    expect(summarizeToolResult('queryCases', JSON.stringify({ cases: [{}, {}], count: 2 }))).toBe('2 cases found');
    expect(summarizeToolResult('searchWeb', JSON.stringify({ source: 'tavily', results: [] }))).toBe('No results found');
    expect(summarizeToolResult('updateCase', JSON.stringify({ error: 'Failed to update case' }))).toBe('Update failed');
  });
});
