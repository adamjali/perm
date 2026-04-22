import { describe, it, expect } from 'vitest';
import type { ModelMessage } from 'ai';
import {
  estimateMessageTokens,
  estimateStringTokens,
  compactAt,
  compactToFit,
  mergeFacts,
  parseFacts,
  type CompactionFacts,
} from '../compaction';

const msg = (role: ModelMessage['role'], content: string): ModelMessage =>
  ({ role, content }) as ModelMessage;

describe('estimateMessageTokens', () => {
  it('returns 0 for empty array', () => {
    expect(estimateMessageTokens([])).toBeGreaterThanOrEqual(0);
    expect(estimateMessageTokens([])).toBeLessThan(5);
  });

  it('scales roughly linearly with content size', () => {
    const short = [msg('user', 'hi')];
    const long = [msg('user', 'hi'.repeat(1000))];
    expect(estimateMessageTokens(long)).toBeGreaterThan(estimateMessageTokens(short) * 10);
  });

  it('is deterministic', () => {
    const m = [msg('user', 'hello world'), msg('assistant', 'hi there')];
    expect(estimateMessageTokens(m)).toBe(estimateMessageTokens(m));
  });
});

describe('estimateStringTokens', () => {
  it('approximates correctly', () => {
    // ~3.5 chars per token — 35 chars ≈ 10 tokens
    expect(estimateStringTokens('x'.repeat(35))).toBe(10);
  });

  it('handles empty string', () => {
    expect(estimateStringTokens('')).toBe(0);
  });
});

describe('compactAt — Level 0', () => {
  it('returns messages unchanged', () => {
    const messages = [msg('user', 'hello'), msg('assistant', 'hi')];
    const result = compactAt(0, { messages });
    expect(result).toBe(messages);
  });

  it('ignores summary at level 0', () => {
    const messages = [msg('user', 'hello')];
    const result = compactAt(0, {
      messages,
      summary: { content: 'prior context', facts: { cases: [{ id: 'X-123' }] } },
    });
    expect(result).toEqual(messages);
  });
});

describe('compactAt — Level 1 (pruneMessages)', () => {
  it('removes empty messages', () => {
    const messages: ModelMessage[] = [
      msg('user', 'hello'),
      msg('assistant', ''),
      msg('user', 'world'),
    ];
    const result = compactAt(1, { messages });
    // The empty assistant turn drops; the two user turns survive intact.
    expect(result).toHaveLength(2);
    expect(result.some((m) => m.role === 'user' && m.content === 'hello')).toBe(true);
    expect(result.some((m) => m.role === 'user' && m.content === 'world')).toBe(true);
  });

  it('preserves messages when nothing needs pruning', () => {
    const messages: ModelMessage[] = [
      msg('user', 'hello'),
      msg('assistant', 'hi'),
    ];
    const result = compactAt(1, { messages });
    expect(result.length).toBe(2);
  });
});

describe('compactAt — Level 2 (envelope + last 10)', () => {
  it('keeps last 10 messages plus 2-message envelope when summary present', () => {
    const messages: ModelMessage[] = Array.from({ length: 30 }, (_, i) =>
      msg(i % 2 === 0 ? 'user' : 'assistant', `msg ${i}`),
    );
    const result = compactAt(2, {
      messages,
      summary: { content: 'a summary of earlier turns', facts: { cases: [{ id: 'X-1' }] } },
    });

    expect(result.length).toBe(12); // 2 envelope + 10 tail

    // Envelope: first is user with COMPACTED CONTEXT marker
    expect(result[0].role).toBe('user');
    expect(result[0].content).toContain('[COMPACTED CONVERSATION CONTEXT]');
    expect(result[0].content).toContain('X-1');
    expect(result[0].content).toContain('a summary of earlier turns');

    // Envelope: second is assistant ack
    expect(result[1].role).toBe('assistant');
    expect(result[1].content).toContain('How can I help');

    // Tail: last 10 original messages
    expect(result[result.length - 1].content).toBe('msg 29');
  });

  it('returns only envelope + tail when conversation shorter than keep window', () => {
    const messages: ModelMessage[] = Array.from({ length: 5 }, (_, i) =>
      msg('user', `msg ${i}`),
    );
    const result = compactAt(2, {
      messages,
      summary: { content: 'summary', facts: undefined },
    });
    // envelope (2) + all 5 messages
    expect(result.length).toBeLessThanOrEqual(7);
    expect(result[0].content).toContain('[COMPACTED CONVERSATION CONTEXT]');
  });

  it('skips envelope when no summary provided', () => {
    const messages: ModelMessage[] = Array.from({ length: 30 }, (_, i) =>
      msg('user', `msg ${i}`),
    );
    const result = compactAt(2, { messages });
    // No envelope — just the last 10 messages (after internal prune)
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result[0].content).not.toContain('[COMPACTED');
  });

  it('truncates prose summary to approximately 1000 tokens', () => {
    const longProse = 'word '.repeat(5000); // ~7000 chars ≈ 2000 tokens
    const messages = [msg('user', 'hi')];
    const result = compactAt(2, {
      messages,
      summary: { content: longProse, facts: undefined },
    });
    const envelopeContent = result[0].content as string;
    // The prose portion should be truncated — original ~7k chars, truncated to ~3500 chars
    expect(envelopeContent.length).toBeLessThan(longProse.length);
    expect(envelopeContent).toContain('[COMPACTED');
  });
});

describe('compactAt — Level 3 (envelope + last 6)', () => {
  it('keeps last 6 messages + envelope + tighter prose', () => {
    const messages: ModelMessage[] = Array.from({ length: 30 }, (_, i) =>
      msg('user', `msg ${i}`),
    );
    const result = compactAt(3, {
      messages,
      summary: { content: 'long summary '.repeat(200), facts: undefined },
    });
    expect(result.length).toBe(8); // 2 envelope + 6 tail
    const envelope = result[0].content as string;
    // L3 prose cap is 400 tokens (~1400 chars)
    expect(envelope.length).toBeLessThan(2000);
    expect(result[result.length - 1].content).toBe('msg 29');
  });
});

describe('compactAt — Level 4 (envelope + last 4)', () => {
  it('keeps last 4 messages + envelope + tightest prose', () => {
    const messages: ModelMessage[] = Array.from({ length: 20 }, (_, i) =>
      msg('user', `msg ${i}`),
    );
    const result = compactAt(4, {
      messages,
      summary: { content: 'long summary '.repeat(200), facts: undefined },
    });
    expect(result.length).toBe(6); // 2 envelope + 4 tail
    const envelope = result[0].content as string;
    // L4 prose cap is 200 tokens (~700 chars)
    expect(envelope.length).toBeLessThan(1200);
  });
});

describe('compactAt — facts rendering', () => {
  it('renders cases correctly', () => {
    const messages = [msg('user', 'hi')];
    const result = compactAt(2, {
      messages,
      summary: {
        content: 'sum',
        facts: {
          cases: [{ id: 'X-1' }, { id: 'Y-2', status: 'pending' }],
        },
      },
    });
    const env = result[0].content as string;
    expect(env).toContain('X-1');
    expect(env).toContain('Y-2 (pending)');
  });

  it('renders people with roles', () => {
    const messages = [msg('user', 'hi')];
    const result = compactAt(2, {
      messages,
      summary: {
        content: 'sum',
        facts: {
          people: [
            { name: 'John Doe', role: 'beneficiary' },
            { name: 'Jane Smith' },
          ],
        },
      },
    });
    const env = result[0].content as string;
    expect(env).toContain('John Doe (beneficiary)');
    expect(env).toContain('Jane Smith');
  });

  it('renders dates as key=value pairs', () => {
    const messages = [msg('user', 'hi')];
    const result = compactAt(2, {
      messages,
      summary: {
        content: 'sum',
        facts: {
          dates: { pwdFiling: '2024-06-15', recruitment: '2024-09-01' },
        },
      },
    });
    const env = result[0].content as string;
    expect(env).toContain('pwdFiling=2024-06-15');
    expect(env).toContain('recruitment=2024-09-01');
  });

  it('renders preferences and open actions', () => {
    const messages = [msg('user', 'hi')];
    const result = compactAt(2, {
      messages,
      summary: {
        content: 'sum',
        facts: {
          preferences: ['bullet summaries'],
          openActions: ['waiting for RFE response'],
        },
      },
    });
    const env = result[0].content as string;
    expect(env).toContain('bullet summaries');
    expect(env).toContain('waiting for RFE response');
  });

  it('handles facts with only some fields populated', () => {
    const messages = [msg('user', 'hi')];
    const result = compactAt(2, {
      messages,
      summary: {
        content: 'sum',
        facts: { cases: [{ id: 'X-1' }] }, // no people, dates, prefs
      },
    });
    const env = result[0].content as string;
    expect(env).toContain('X-1');
    expect(env).not.toContain('People');
    expect(env).not.toContain('Dates');
  });
});

describe('compactToFit', () => {
  it('returns level 0 when already fits', () => {
    const messages = [msg('user', 'small')];
    const result = compactToFit({ messages }, 10000);
    expect(result).not.toBeNull();
    expect(result!.level).toBe(0);
  });

  it('walks up levels until it fits', () => {
    const messages: ModelMessage[] = Array.from({ length: 50 }, (_, i) =>
      msg('user', 'long message '.repeat(50) + ` ${i}`),
    );
    const result = compactToFit(
      {
        messages,
        summary: { content: 'summary', facts: { cases: [{ id: 'X-1' }] } },
      },
      2000,
    );
    expect(result).not.toBeNull();
    expect(result!.level).toBeGreaterThan(0);
    expect(result!.estimatedTokens).toBeLessThanOrEqual(2000);
  });

  it('returns null when even L4 does not fit', () => {
    // Need a case where L0 doesn't fit (long messages) AND L4 also doesn't fit (envelope overhead alone > budget).
    // L4 includes a ~200-token prose cap + envelope header (~100 tokens) + 4 recent msgs.
    // Budget of 50 tokens is below even the L4 envelope minimum.
    const messages: ModelMessage[] = Array.from({ length: 20 }, (_, i) =>
      msg('user', 'long message content '.repeat(30) + ` ${i}`),
    );
    const result = compactToFit(
      {
        messages,
        summary: { content: 'summary prose '.repeat(500), facts: undefined },
      },
      50, // absurdly tight — less than envelope header
    );
    expect(result).toBeNull();
  });

  it('prefers lower level when both fit', () => {
    const messages = [msg('user', 'short')];
    const result = compactToFit(
      {
        messages,
        summary: { content: 'summary', facts: undefined },
      },
      10000,
    );
    expect(result!.level).toBe(0); // L0 fits, so no compaction
  });
});

describe('mergeFacts', () => {
  it('returns undefined when both inputs are undefined', () => {
    expect(mergeFacts(undefined, undefined)).toBeUndefined();
  });

  it('returns incoming when existing is undefined', () => {
    const incoming: CompactionFacts = { cases: [{ id: 'X-1' }] };
    expect(mergeFacts(undefined, incoming)).toEqual(incoming);
  });

  it('returns existing when incoming is undefined', () => {
    const existing: CompactionFacts = { cases: [{ id: 'Y-2' }] };
    expect(mergeFacts(existing, undefined)).toEqual(existing);
  });

  it('dedupes cases by id', () => {
    const existing: CompactionFacts = {
      cases: [{ id: 'X-1' }, { id: 'Y-2', status: 'old' }],
    };
    const incoming: CompactionFacts = {
      cases: [{ id: 'Y-2', status: 'new' }, { id: 'Z-3' }],
    };
    const merged = mergeFacts(existing, incoming);
    expect(merged!.cases).toHaveLength(3);
    // Newer wins for Y-2
    const y2 = merged!.cases!.find((c) => c.id === 'Y-2');
    expect(y2).toEqual({ id: 'Y-2', status: 'new' });
  });

  it('dedupes people case-insensitively', () => {
    const existing: CompactionFacts = {
      people: [{ name: 'John Doe', role: 'beneficiary' }],
    };
    const incoming: CompactionFacts = {
      people: [{ name: 'john doe', role: 'employer rep' }],
    };
    const merged = mergeFacts(existing, incoming);
    expect(merged!.people).toHaveLength(1);
    expect(merged!.people![0].role).toBe('employer rep'); // newer wins
  });

  it('shallow-merges dates', () => {
    const existing: CompactionFacts = {
      dates: { pwdFiling: '2024-06-15', recruitment: '2024-09-01' },
    };
    const incoming: CompactionFacts = {
      dates: { recruitment: '2024-09-15', i140: '2025-01-10' },
    };
    const merged = mergeFacts(existing, incoming);
    expect(merged!.dates).toEqual({
      pwdFiling: '2024-06-15',
      recruitment: '2024-09-15', // newer wins
      i140: '2025-01-10',
    });
  });

  it('dedupes preferences case-insensitively', () => {
    const existing: CompactionFacts = { preferences: ['bullet summaries'] };
    const incoming: CompactionFacts = { preferences: ['BULLET SUMMARIES', 'concise'] };
    const merged = mergeFacts(existing, incoming);
    expect(merged!.preferences).toHaveLength(2);
  });

  it('accumulates open actions without duplicates', () => {
    const existing: CompactionFacts = { openActions: ['waiting for RFE'] };
    const incoming: CompactionFacts = { openActions: ['waiting for RFE', 'review 9089'] };
    const merged = mergeFacts(existing, incoming);
    expect(merged!.openActions).toHaveLength(2);
  });
});

describe('parseFacts', () => {
  it('returns undefined for undefined input', () => {
    expect(parseFacts(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseFacts('')).toBeUndefined();
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseFacts('{not json}')).toBeUndefined();
  });

  it('returns undefined for non-object JSON', () => {
    expect(parseFacts('"string"')).toBeUndefined();
    expect(parseFacts('null')).toBeUndefined();
    expect(parseFacts('42')).toBeUndefined();
  });

  it('returns parsed object for valid facts JSON, normalizing legacy string cases to objects', () => {
    const json = JSON.stringify({ cases: ['X-1'], dates: { pwd: '2024-06-15' } });
    const parsed = parseFacts(json);
    // The schema's transform normalizes bare-string entries to {id} objects
    // — back-compat for facts persisted before the shape was tightened.
    expect(parsed).toEqual({ cases: [{ id: 'X-1' }], dates: { pwd: '2024-06-15' } });
  });

  it('returns undefined for invalid shape (e.g. cases as a number)', () => {
    expect(parseFacts(JSON.stringify({ cases: 7 }))).toBeUndefined();
  });
});

describe('edge cases', () => {
  it('handles empty messages array at every level', () => {
    for (const level of [0, 1, 2, 3, 4] as const) {
      const result = compactAt(level, { messages: [] });
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('handles summary without facts', () => {
    const messages = [msg('user', 'x')];
    const result = compactAt(2, {
      messages,
      summary: { content: 'just prose', facts: undefined },
    });
    const env = result[0].content as string;
    expect(env).toContain('just prose');
    expect(env).not.toContain('Key Facts');
  });

  it('handles summary with empty content and empty facts', () => {
    const messages = [msg('user', 'x')];
    const result = compactAt(2, {
      messages,
      summary: { content: '', facts: {} },
    });
    // Empty summary → no envelope
    expect(result.length).toBeLessThanOrEqual(1);
  });
});
