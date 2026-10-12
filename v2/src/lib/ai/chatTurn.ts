import type { UIMessage } from 'ai';

/**
 * Small pieces of one chat turn, kept pure so they can be tested.
 */

const EASTERN = 'America/New_York';

/** Whether a finished step showed a confirmation card. */
export function stepShowedCard(step: { toolResults?: ReadonlyArray<{ output?: unknown }> }): boolean {
  return (step.toolResults ?? []).some((r) => {
    const out = r?.output;
    return typeof out === 'object' && out !== null && (out as { requiresPermission?: unknown }).requiresPermission === true;
  });
}

function zoneOrEastern(timeZone: string | undefined): string {
  if (!timeZone) return EASTERN;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return EASTERN;
  }
}

/**
 * Today's date and the time in a person's own time zone, for the system
 * prompt: "Monday, October 12, 2026" and "3:56 PM EDT". Eastern when the zone
 * is missing or unknown. The server runs on UTC, so a bare toLocaleDateString
 * put a Monday evening on Tuesday.
 */
export function nowInZone(timeZone?: string, at: Date = new Date()): { currentDate: string; currentTime: string; isoDay: string } {
  const zone = zoneOrEastern(timeZone);
  const currentDate = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(at);
  const currentTime = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(at);
  const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  return { currentDate, currentTime, isoDay };
}

/**
 * Saved turns the chat sends to the model ahead of the session's own: the
 * newest of the conversation, for a session that began after a reload. The
 * summary covers older turns. Read by useChatWithPersistence and the route.
 */
export const HISTORY_FOR_MODEL = 20;

/**
 * The client's saved turns, checked: user and assistant text only, at most
 * HISTORY_FOR_MODEL of them, each cut to 4,000 characters. They are the
 * person's own conversation (the client read them from Convex), so the check
 * is about shape and size, not trust.
 */
export function savedTurns(history: unknown): UIMessage[] {
  if (!Array.isArray(history)) return [];
  const out: UIMessage[] = [];
  for (const item of history.slice(-HISTORY_FOR_MODEL)) {
    if (!item || typeof item !== 'object') continue;
    const m = item as { id?: unknown; role?: unknown; parts?: unknown };
    if ((m.role !== 'user' && m.role !== 'assistant') || !Array.isArray(m.parts)) continue;
    const text = m.parts
      .map((p) => (p && typeof p === 'object' && (p as { type?: unknown }).type === 'text' ? (p as { text?: unknown }).text : null))
      .filter((t): t is string => typeof t === 'string')
      .join('\n\n')
      .slice(0, 4_000)
      .trim();
    if (!text) continue;
    out.push({ id: typeof m.id === 'string' ? m.id : `saved-${out.length}`, role: m.role, parts: [{ type: 'text', text }] });
  }
  return out;
}
