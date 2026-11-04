/**
 * What the error screens' reports may spend, per web copy. The route is public, so
 * a stranger can post as many well-formed reports as they like; without these a
 * loop of made-up messages filled the server's whole Sentry hour (sentryBudget.ts,
 * 60 errors) and opened a new issue per message (audit, Nov 4 2026). Reports carry
 * the tag `report: client`, which the server's own budget leaves to this one, so a
 * flood of them can't hide a real server error.
 *
 * Plain state over an injected clock, so the tests drive time directly.
 */

export const PER_MINUTE = 120;
/** From one address a minute (a real screen sends one or two). */
export const PER_ADDRESS_PER_MINUTE = 6;
/** Reports sent to Sentry an hour, and copies of one kind. */
export const SENTRY_PER_HOUR = 30;
export const SENTRY_PER_KEY_PER_HOUR = 3;
/** Kinds of message that get an issue of their own an hour; the rest share one. */
export const NEW_KEYS_PER_HOUR = 10;

export function createClientErrorBudget(now: () => number = Date.now) {
  let minuteStart = now();
  let inMinute = 0;
  const perAddress = new Map<string, number>();
  let hourStart = now();
  let sent = 0;
  const perKey = new Map<string, number>();

  function roll(): void {
    const t = now();
    if (t - minuteStart >= 60_000) {
      minuteStart = t;
      inMinute = 0;
      perAddress.clear();
    }
    if (t - hourStart >= 3_600_000) {
      hourStart = t;
      sent = 0;
      perKey.clear();
    }
  }

  return {
    /** Whether this report is logged at all. */
    admit(address: string): boolean {
      roll();
      if (inMinute >= PER_MINUTE) return false;
      // Only admitted reports are remembered, so the table holds PER_MINUTE at most.
      const seen = perAddress.get(address) ?? 0;
      if (seen >= PER_ADDRESS_PER_MINUTE) return false;
      perAddress.set(address, seen + 1);
      inMinute++;
      return true;
    },
    /**
     * The key to file a report under in Sentry, or null to send it nowhere. A kind
     * of message past the hour's new kinds is filed under `other`.
     */
    sentryKey(key: string): string | null {
      roll();
      if (sent >= SENTRY_PER_HOUR) return null;
      let filed = key;
      if (!perKey.has(key) && perKey.size >= NEW_KEYS_PER_HOUR) filed = "other";
      const copies = perKey.get(filed) ?? 0;
      if (copies >= SENTRY_PER_KEY_PER_HOUR) return null;
      perKey.set(filed, copies + 1);
      sent++;
      return filed;
    },
  };
}
