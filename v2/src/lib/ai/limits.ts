/**
 * The chat's limits, and the words that go with each one.
 *
 * Every limit on the assistant has to say which limit it hit and what to do
 * next. Silent, each misleads: a reply that hits the output cap stops
 * mid-sentence, a spent web-search quota reads as "no results", a
 * knowledge-search rate limit reads as "try rephrasing", the per-address
 * limit reads as "the AI services didn't respond", and a case query that
 * stops at 100 rows gives no sign it did.
 *
 * Pure functions only, so the route, the tools and the panel share one
 * wording and the tests can pin it.
 */

import { EASTERN_TIMEZONE, MS_PER_HOUR, MS_PER_MINUTE } from "@/lib/time";

/** Tool-using steps allowed in one reply (streamText's stopWhen). */
export const CHAT_MAX_STEPS = 10;

/**
 * Output tokens per reply. 8,000 sits under the smallest limit in the model
 * chain: Gemini 2.0 Flash's "Output token limit: 8,192" (ai.google.dev).
 * Groq keeps its own lower cap in providers.ts, because its free
 * tier counts the requested maximum against a 12,000 tokens-a-minute budget.
 */
export const CHAT_MAX_OUTPUT_TOKENS = 8000;

/** Why a reply ended early, as the panel shows it. */
export type CutShort = 'length' | 'steps';

/**
 * A reply's finish reason, read as a cut. "length" is the output cap. A final
 * step that finished for "tool-calls" means the model still wanted a tool when
 * the step cap ended the loop; an ordinary reply finishes with "stop".
 */
export function cutShortFrom(finishReason: string | undefined): CutShort | undefined {
  if (finishReason === 'length') return 'length';
  if (finishReason === 'tool-calls') return 'steps';
  return undefined;
}

export function cutShortNotice(kind: CutShort, maxSteps: number = CHAT_MAX_STEPS): string {
  return kind === 'length'
    ? 'This answer hit the length limit and stopped partway. Continue picks up where it left off.'
    : `The assistant stopped after ${maxSteps} tool steps, its limit for one reply. Continue lets it carry on.`;
}

/** A wait in words: "13 seconds", "2 minutes", "1 hour". Rounded up. */
export function formatWait(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'a moment';
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (ms < MS_PER_MINUTE) return plural(Math.max(1, Math.ceil(ms / 1000)), 'second');
  if (ms < MS_PER_HOUR) return plural(Math.ceil(ms / MS_PER_MINUTE), 'minute');
  return plural(Math.ceil(ms / MS_PER_HOUR), 'hour');
}

/**
 * The rate limiter component's refusal, read off whatever carried it.
 *
 * `@convex-dev/rate-limiter` throws `ConvexError({ kind: "RateLimited", name,
 * retryAfter })`; Convex's HTTP client rethrows it with `.data` attached. When
 * only the text survives (a wrapped or logged error), the same JSON is in the
 * message.
 */
export function rateLimitFrom(error: unknown): { name: string; retryAfterMs: number } | null {
  if (!error || typeof error !== 'object') return null;
  const data = (error as { data?: unknown }).data;
  if (data && typeof data === 'object' && (data as { kind?: unknown }).kind === 'RateLimited') {
    const d = data as { name?: unknown; retryAfter?: unknown };
    return {
      name: typeof d.name === 'string' ? d.name : '',
      retryAfterMs: typeof d.retryAfter === 'number' ? d.retryAfter : 0,
    };
  }
  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') return null;
  const match = message.match(/\{[^{}]*"kind"\s*:\s*"RateLimited"[^{}]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { name?: unknown; retryAfter?: unknown };
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      retryAfterMs: typeof parsed.retryAfter === 'number' ? parsed.retryAfter : 0,
    };
  } catch {
    return null;
  }
}

/** What each per-user limit in convex/rateLimitConfig.ts counts, in words. */
const LIMIT_ACTIONS: Record<string, string> = {
  caseCreate: 'new cases',
  caseUpdate: 'case changes',
  conversationCreate: 'new conversations',
  notificationsMarkAllRead: 'notification changes',
  userCaseOrderSave: 'reorders',
  jobTemplateCreate: 'new templates',
  knowledgeSearch: 'knowledge-base searches',
  pushSubscriptionSave: 'notification setting changes',
};

/**
 * A tool result for a rate-limited call. It carries an `error` key, so the
 * tool cache never stores it, and the confirmation card shows that sentence as
 * it is; `_ai_instruction` tells the model exactly what to say.
 */
export function rateLimitedToolResult(error: unknown, action?: string) {
  const limit = rateLimitFrom(error);
  if (!limit) return null;
  const what = action ?? LIMIT_ACTIONS[limit.name] ?? 'requests';
  const wait = formatWait(limit.retryAfterMs);
  return {
    error: `Too many ${what} in the last minute. Try again in ${wait}.`,
    reason: 'rate_limited' as const,
    retryAfterSeconds: Math.max(1, Math.ceil(limit.retryAfterMs / 1000)),
    _ai_instruction:
      `Tell the person plainly that they've made too many ${what} in a minute and can try again in ${wait}. ` +
      'Do not suggest rewording the request: nothing was wrong with it.',
  };
}

/** Next midnight UTC: when the web-search providers' daily counts reset. */
export function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** "8:00 PM EDT": the owner's clock, 12-hour, with the zone. */
export function formatEastern(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()} ${get('timeZoneName')}`;
}

interface WebSearchLike {
  source?: string;
  results?: unknown[];
  answer?: string | null;
  unavailable?: 'quota' | 'error';
}

/**
 * A web search that could not run, as a tool result the model cannot mistake
 * for an empty search. Null for a search that ran (even one with no hits).
 */
export function webSearchUnavailableResult(result: WebSearchLike | null | undefined, now: Date) {
  if (!result || result.source !== 'none') return null;
  if (result.unavailable === 'quota') {
    const resets = nextUtcMidnight(now);
    const local = formatEastern(resets);
    return {
      error: 'Web search is used up for today.',
      reason: 'quota' as const,
      resetsAt: resets.toISOString(),
      resetsAtLocal: local,
      _ai_instruction:
        `Tell the person web search is used up for today and comes back at ${local}. ` +
        'Do not say the search found nothing. Answer from the knowledge base and what you know, and say that is what you did.',
    };
  }
  return {
    error: "Web search didn't answer just now.",
    reason: 'failed' as const,
    _ai_instruction:
      "Tell the person web search didn't answer just now and they can ask again in a minute. " +
      'Do not say the search found nothing. Answer from the knowledge base and what you know, and say that is what you did.',
  };
}

/** "Showing 100 of 340 matching cases." when a case list stopped at its cap. */
export function queryCapNote(totalCount: number | undefined, shown: number): string | undefined {
  if (typeof totalCount !== 'number' || totalCount <= shown) return undefined;
  return `Showing ${shown.toLocaleString('en-US')} of ${totalCount.toLocaleString('en-US')} matching cases.`;
}

/**
 * A case query's result, with a note when the list stopped at its cap.
 * `chatCaseData.queryCases` returns every match in `count` and at most
 * `limit` (default and maximum 100) in `cases`; without the note the model
 * gets the shorter list with nothing telling it to say so.
 */
export function annotateCaseQuery<T>(result: T): T & { note?: string; _ai_instruction?: string } {
  type Annotated = T & { note?: string; _ai_instruction?: string };
  if (!result || typeof result !== 'object') return result as Annotated;
  const r = result as { cases?: unknown; count?: unknown; accountTruncated?: unknown };
  if (!Array.isArray(r.cases) || typeof r.count !== 'number') return result as Annotated;
  const note = queryCapNote(r.count, r.cases.length);
  // The account holds more cases than one read covers (convex/lib/userCases.ts
  // reads the newest 5,000), so even `count` leaves the oldest out.
  const accountNote =
    r.accountTruncated === true
      ? 'This account holds more cases than one search covers, so the oldest were not searched.'
      : undefined;
  if (!note && !accountNote) return result as Annotated;
  const instructions = [
    note
      ? `The list stopped at ${r.cases.length} of ${r.count} matching cases. Say "showing ${r.cases.length} of ${r.count}" in your answer, ` +
        'and offer to narrow it (by status, employer or deadline) or point them to the Cases page, which lists every case.'
      : '',
    accountNote ? `Also say: "${accountNote}"` : '',
  ].filter(Boolean);
  return {
    ...result,
    note: [note, accountNote].filter(Boolean).join(' '),
    _ai_instruction: instructions.join(' '),
  };
}

/**
 * The chat route's per-address refusal (authRateLimit's ip_chat), in the same
 * JSON shape nginx answers with under /api, so the panel reads both one way
 * and can say how long to wait. A bare `{ error: "Too many requests..." }`
 * carries no wait, and the panel would read it as "the AI services didn't
 * respond".
 */
export function chatIpLimitBody(retryAfterMs: number, blocked: boolean) {
  const wait = formatWait(retryAfterMs);
  return {
    error: 'rate_limited' as const,
    message: blocked
      ? `Chat is paused for this network after repeated limits. Try again in ${wait}.`
      : `Too many chat messages from this network in the last minute. Try again in ${wait}.`,
    retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}

const GENERIC_ERROR = {
  title: 'The assistant couldn’t answer that',
  detail: 'The AI services didn’t respond. Your message is saved; try again in a moment.',
};

/**
 * What the panel shows for a failed turn. The chat transport throws the
 * response body as the message, so a refusal from the route or from nginx
 * arrives as JSON with its own sentence in it; show that sentence.
 */
export function chatErrorText(error: Error | undefined): { title: string; detail: string } {
  if (!error?.message) return GENERIC_ERROR;
  let body: { error?: unknown; message?: unknown } | null = null;
  try {
    const parsed: unknown = JSON.parse(error.message);
    if (parsed && typeof parsed === 'object') body = parsed as { error?: unknown; message?: unknown };
  } catch {
    return GENERIC_ERROR;
  }
  if (!body) return GENERIC_ERROR;
  const code = typeof body.error === 'string' ? body.error : '';
  const message = typeof body.message === 'string' ? body.message : '';
  if (code === 'rate_limited') {
    return { title: 'Slow down for a moment', detail: message || 'Too many messages in a short time. Try again in a minute.' };
  }
  if (code === 'busy') {
    return { title: 'The site is busy', detail: message || 'Try again in a few seconds.' };
  }
  if (code === 'Unauthorized' || code === 'Authentication error') {
    return { title: 'You’re signed out', detail: 'Sign in again, then send your message.' };
  }
  // A sentence from the route ("All AI providers are currently unavailable...").
  if (message) return { title: GENERIC_ERROR.title, detail: message };
  if (code.includes(' ')) return { title: GENERIC_ERROR.title, detail: code };
  return GENERIC_ERROR;
}
