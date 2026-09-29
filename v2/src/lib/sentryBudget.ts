/**
 * A ceiling on what one server process sends to Sentry, per hour.
 *
 * Normal days send about 10 errors and under 1,000 log lines in total. On
 * Sep 29 2026 one database stall sent 2,008 copies of the same error and
 * 21,311 log lines, and a storm like that can spend the plan's monthly
 * allowance, after which Sentry drops everything, including the next real
 * error. The ceilings sit far above normal, so nothing is lost on an ordinary
 * day; in a storm the first copies of each error still arrive, and the next
 * one sent carries how many were held back.
 *
 * Plain functions over an injected clock, so the tests drive time directly.
 */

export const HOUR_MS = 60 * 60 * 1000;
/** Copies of one error (same type and message, digits ignored) per hour. */
export const PER_ERROR_PER_HOUR = 5;
/** All errors together per hour. */
export const ERRORS_PER_HOUR = 60;
/** Log lines per hour. */
export const LOGS_PER_HOUR = 500;

interface ErrorLike {
  message?: string;
  exception?: { values?: Array<{ type?: string; value?: string }> };
  tags?: Record<string, unknown>;
}

/** What makes two errors "the same": type and message, with numbers blanked. */
export function errorKey(event: ErrorLike): string {
  const ex = event.exception?.values?.[0];
  const text = `${ex?.type ?? ""}: ${ex?.value ?? event.message ?? ""}`;
  return text.replace(/\d+/g, "#").slice(0, 200);
}

export function createSentryBudget(now: () => number = Date.now) {
  let windowStart = now();
  let errors = 0;
  let logs = 0;
  let heldErrors = 0;
  let heldLogs = 0;
  const perKey = new Map<string, number>();

  function roll(): void {
    const t = now();
    if (t - windowStart < HOUR_MS) return;
    windowStart = t;
    errors = 0;
    logs = 0;
    perKey.clear();
  }

  return {
    /** Sentry's beforeSend: the event, or null to drop it. */
    error<E extends ErrorLike>(event: E): E | null {
      roll();
      const key = errorKey(event);
      const seen = perKey.get(key) ?? 0;
      if (seen >= PER_ERROR_PER_HOUR || errors >= ERRORS_PER_HOUR) {
        heldErrors++;
        return null;
      }
      perKey.set(key, seen + 1);
      errors++;
      if (heldErrors > 0) {
        event.tags = { ...event.tags, "budget.held_before": heldErrors };
        heldErrors = 0;
      }
      return event;
    },
    /** Sentry's beforeSendLog: the log, or null to drop it. */
    log<L extends { attributes?: Record<string, unknown> }>(log: L): L | null {
      roll();
      if (logs >= LOGS_PER_HOUR) {
        heldLogs++;
        return null;
      }
      logs++;
      if (heldLogs > 0) {
        log.attributes = { ...log.attributes, "budget.held_before": heldLogs };
        heldLogs = 0;
      }
      return log;
    },
  };
}
