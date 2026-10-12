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
