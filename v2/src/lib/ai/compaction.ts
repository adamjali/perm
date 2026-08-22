/**
 * Conversation Compaction Module
 *
 * Pure, testable utilities for shrinking conversation context to fit model budgets.
 *
 * Levels (escalate until it fits):
 *   L0: no change
 *   L1: pruneMessages, strip old reasoning + tool call bodies (SDK-native, lossless for live tool state)
 *   L2: [COMPACTED CONTEXT] envelope + last 10 messages (reasoning stripped via pruneMessages), prose cap 1000 tokens
 *   L3: envelope + last 6 messages (reasoning stripped), prose cap 400 tokens
 *   L4: envelope + last 4 messages (reasoning stripped), prose cap 200 tokens
 *
 * Entity facts (case IDs, dates, names, preferences) survive all levels unchanged, 
 * they ride in the envelope as structured JSON that accumulates across compaction cycles.
 */

import { pruneMessages, type ModelMessage } from 'ai';
import { z } from 'zod/v4';

/**
 * Token estimation: serialize and divide by ~3.5 chars/token (conservative).
 * Single source of truth for the chars/token ratio. `providers.ts` imports the
 * `estimateTokensOf` estimator from here; `summarize.ts` imports
 * `estimateStringTokens`, `mergeFacts`, `parseFacts`, the `CompactionFacts` type,
 * and the shared `CompactionFactsSchema`.
 *
 * Note: this over-counts compared to actual tokenizer output (~30-50%) due to
 * JSON quote/brace overhead; that bias is intentional, better to skip a
 * model that almost-fits than to send an oversized payload that 400s.
 */
export const CHARS_PER_TOKEN = 3.5;

export function estimateMessageTokens(messages: ModelMessage[]): number {
  try {
    return Math.ceil(JSON.stringify(messages).length / CHARS_PER_TOKEN);
  } catch {
    return 0;
  }
}

export function estimateStringTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for any value by JSON-serializing it. Used for bounding
 * model input against `maxInputTokens` in providers.ts.
 */
export function estimateTokensOf(value: unknown): number {
  try {
    return Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN);
  } catch {
    return 0;
  }
}

export type CompactionLevel = 0 | 1 | 2 | 3 | 4;

export interface CompactionFacts {
  cases?: Array<{ id: string; status?: string }>;
  people?: Array<{ name: string; role?: string }>;
  dates?: Record<string, string>;
  preferences?: string[];
  openActions?: string[];
}

/**
 * Zod schema mirroring CompactionFacts. Used by `parseFacts` to validate
 * untrusted JSON (extractor LLM output, persisted facts blobs from older
 * shapes) before merging. Accepts the legacy `cases: string[]` form and
 * normalizes each entry to the object shape so consumers don't need to branch.
 *
 * Exported as the SINGLE source of truth for the LLM-output facts contract, 
 * `summarize.ts` reuses it for structured extraction (no duplicate schema).
 */
export const CompactionFactsSchema = z.object({
  cases: z
    .array(
      z.union([
        z.string().transform((id) => ({ id })),
        z.object({ id: z.string(), status: z.string().optional() }),
      ]),
    )
    .optional(),
  people: z
    .array(z.object({ name: z.string(), role: z.string().optional() }))
    .optional(),
  dates: z.record(z.string(), z.string()).optional(),
  preferences: z.array(z.string()).optional(),
  openActions: z.array(z.string()).optional(),
});

export interface CompactionInput {
  messages: ModelMessage[];
  summary?: { content: string; facts?: CompactionFacts };
}

export interface CompactionResult {
  messages: ModelMessage[];
  level: CompactionLevel;
  estimatedTokens: number;
}

/**
 * Truncate a summary string to approximately `maxTokens` tokens.
 * Prefers cutting at paragraph → sentence → word boundary.
 */
function truncateProse(text: string, maxTokens: number): string {
  const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);
  if (text.length <= maxChars) return text;

  const candidate = text.slice(0, maxChars);
  const lastParagraph = candidate.lastIndexOf('\n\n');
  if (lastParagraph > maxChars * 0.6) return candidate.slice(0, lastParagraph) + '\n\n…';

  const lastSentence = Math.max(
    candidate.lastIndexOf('. '),
    candidate.lastIndexOf('? '),
    candidate.lastIndexOf('! '),
  );
  if (lastSentence > maxChars * 0.6) return candidate.slice(0, lastSentence + 1) + ' …';

  const lastSpace = candidate.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.6) return candidate.slice(0, lastSpace) + ' …';

  return candidate + '…';
}

/**
 * Render a facts block as a markdown list. Renders nothing if no facts.
 *
 * Each fact category declares its label + how to render its values; a single
 * loop applies the rule for any non-empty category.
 */
function renderFacts(facts: CompactionFacts | undefined): string {
  if (!facts) return '';

  const sections: Array<{ label: string; render: () => string | null }> = [
    {
      label: 'Cases',
      render: () =>
        facts.cases?.length
          ? facts.cases.map((c) => (c.status ? `${c.id} (${c.status})` : c.id)).join(', ')
          : null,
    },
    {
      label: 'People',
      render: () =>
        facts.people?.length
          ? facts.people.map((p) => (p.role ? `${p.name} (${p.role})` : p.name)).join(', ')
          : null,
    },
    {
      label: 'Dates',
      render: () => {
        const entries = facts.dates ? Object.entries(facts.dates) : [];
        return entries.length
          ? entries.map(([k, v]) => `${k}=${v}`).join(', ')
          : null;
      },
    },
    {
      label: 'Preferences',
      render: () => (facts.preferences?.length ? facts.preferences.join('; ') : null),
    },
    {
      label: 'Open actions',
      render: () => (facts.openActions?.length ? facts.openActions.join('; ') : null),
    },
  ];

  const lines = sections
    .map(({ label, render }) => {
      const value = render();
      return value ? `- ${label}: ${value}` : null;
    })
    .filter((line): line is string => line !== null);

  return lines.length > 0 ? `\n## Key Facts (preserved exactly)\n${lines.join('\n')}\n` : '';
}

/**
 * Build the [COMPACTED CONTEXT] envelope + an assistant acknowledgment
 * so the LLM knows the synthetic user message is automated context, not a real turn.
 */
function buildEnvelope(
  summary: { content: string; facts?: CompactionFacts } | undefined,
  proseMaxTokens: number,
): ModelMessage[] {
  if (!summary) return [];

  const factsBlock = renderFacts(summary.facts);
  const proseBlock = summary.content
    ? `\n## Conversation Summary\n${truncateProse(summary.content, proseMaxTokens)}\n`
    : '';

  // No content and no renderable facts → skip the envelope entirely
  if (!proseBlock && !factsBlock) return [];

  const envelopeText =
    `[COMPACTED CONVERSATION CONTEXT]\n` +
    `The following is a summary of the earlier conversation. ` +
    `Do NOT treat this as a user message, it is automated context.\n` +
    factsBlock +
    proseBlock;

  return [
    { role: 'user', content: envelopeText },
    { role: 'assistant', content: 'Understood. How can I help?' },
  ];
}

/**
 * Apply compaction at a specific level. Returns a new ModelMessage[], does not mutate input.
 */
export function compactAt(level: CompactionLevel, input: CompactionInput): ModelMessage[] {
  const { messages, summary } = input;

  if (level === 0) {
    return messages;
  }

  if (level === 1) {
    return pruneMessages({
      messages,
      reasoning: 'before-last-message',
      toolCalls: 'before-last-2-messages',
      emptyMessages: 'remove',
    });
  }

  const config: Record<2 | 3 | 4, { keep: number; proseMaxTokens: number }> = {
    2: { keep: 10, proseMaxTokens: 1000 },
    3: { keep: 6, proseMaxTokens: 400 },
    4: { keep: 4, proseMaxTokens: 200 },
  };
  const { keep, proseMaxTokens } = config[level];

  // First prune aggressively, then take the tail after envelope replacement
  const pruned = pruneMessages({
    messages,
    reasoning: 'all',
    toolCalls: 'before-last-message',
    emptyMessages: 'remove',
  });

  const envelope = buildEnvelope(summary, proseMaxTokens);
  const tail = dropLeadingOrphanToolResults(pruned.slice(-keep));

  return [...envelope, ...tail];
}

/**
 * Drop leading `tool` (tool-result) messages from a sliced tail.
 *
 * The tail slice can cut between an assistant tool-call and its matching
 * tool-result, leaving the result first with no matching call. Strict providers
 * (Mistral, OpenRouter) 400 on an orphaned `tool_call_id`, so we trim any
 * leading tool messages until the first non-tool message (the first valid
 * conversational anchor) leads the tail.
 */
function dropLeadingOrphanToolResults(messages: ModelMessage[]): ModelMessage[] {
  let start = 0;
  while (start < messages.length && messages[start]?.role === 'tool') {
    start++;
  }
  return start === 0 ? messages : messages.slice(start);
}

/**
 * Walk L0 → L4 until the result fits the target token budget.
 * Returns null if even L4 doesn't fit (caller should skip the model).
 */
export function compactToFit(
  input: CompactionInput,
  targetTokens: number,
): CompactionResult | null {
  const levels: CompactionLevel[] = [0, 1, 2, 3, 4];
  for (const level of levels) {
    const messages = compactAt(level, input);
    const estimatedTokens = estimateMessageTokens(messages);
    if (estimatedTokens <= targetTokens) {
      return { messages, level, estimatedTokens };
    }
  }
  return null;
}

/**
 * Merge newly-extracted facts into an existing facts object.
 *
 * Merge rules:
 *   - Arrays: dedupe by string form of each entry (preserves order, prefers newer)
 *   - Objects (dates): shallow merge, newer keys overwrite
 *   - Preferences: dedupe, case-insensitive
 */
export function mergeFacts(
  existing: CompactionFacts | undefined,
  incoming: CompactionFacts | undefined,
): CompactionFacts | undefined {
  if (!existing && !incoming) return undefined;
  if (!existing) return incoming;
  if (!incoming) return existing;

  const dedupeArray = <T>(
    existingArr: T[] | undefined,
    incomingArr: T[] | undefined,
    key: (item: T) => string,
  ): T[] | undefined => {
    if (!existingArr && !incomingArr) return undefined;
    const combined = [...(existingArr ?? []), ...(incomingArr ?? [])];
    const seen = new Map<string, T>();
    for (const item of combined) {
      seen.set(key(item), item); // newer wins
    }
    return Array.from(seen.values());
  };

  const merged: CompactionFacts = {};

  const cases = dedupeArray(
    existing.cases,
    incoming.cases,
    (c) => c.id,
  );
  if (cases) merged.cases = cases;

  const people = dedupeArray(
    existing.people,
    incoming.people,
    (p) => p.name.toLowerCase(),
  );
  if (people) merged.people = people;

  if (existing.dates || incoming.dates) {
    merged.dates = { ...(existing.dates ?? {}), ...(incoming.dates ?? {}) };
  }

  const preferences = dedupeArray(
    existing.preferences,
    incoming.preferences,
    (s) => s.toLowerCase(),
  );
  if (preferences) merged.preferences = preferences;

  const openActions = dedupeArray(
    existing.openActions,
    incoming.openActions,
    (s) => s.toLowerCase(),
  );
  if (openActions) merged.openActions = openActions;

  return merged;
}

/**
 * Parse a facts JSON string safely. Returns undefined on parse failure or if
 * the payload doesn't match the expected shape. Legacy `cases: string[]` rows
 * are normalized to `Array<{id}>` by the schema's transform.
 */
export function parseFacts(json: string | undefined): CompactionFacts | undefined {
  if (!json) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return undefined;
  }
  const result = CompactionFactsSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}
